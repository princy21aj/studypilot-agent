import tempfile
import uuid
from pathlib import Path

import streamlit as st

from agent.config import create_client
from agent.loop import make_llm, run_agent
from agent.rag import SUPPORTED, NotesIndex
from agent.study import make_cards_data, make_plan_data, make_quiz_data
from ui import CSS, card, flashcard, hero

MAX_ACTIONS = 30           # limit per visitor (chat messages + quizzes + cards + plans)
MAX_FILE_MB = 10
EXAMPLES = [
    'Explain the main idea of the first unit',
    'Summarize one chapter as a revision sheet',
    'What are the most important topics in my notes?',
    'Explain one concept like I am new to it',
]

st.set_page_config(page_title='StudyPilot', page_icon='📚', layout='wide')
st.markdown(CSS, unsafe_allow_html=True)


def reset_session():
    st.session_state.history = []
    st.session_state.chat = []
    st.session_state.count = 0
    st.session_state.index = NotesIndex()    # each visitor gets their own notes index
    st.session_state.notes_file = Path(tempfile.gettempdir()) / ('studypilot_' + uuid.uuid4().hex + '.txt')
    st.session_state.quiz = None
    st.session_state.cards = None
    st.session_state.plan = None


def use_credit():
    # Every AI call costs quota, so each visitor has a limit
    if st.session_state.count >= MAX_ACTIONS:
        card('You have used all ' + str(MAX_ACTIONS) + ' actions for this session. '
             'Click "Clear everything" in the sidebar to start again.', 'peach')
        return False
    st.session_state.count += 1
    return True


def get_llm():
    client, model = create_client()
    return make_llm(client, model)


def need_notes():
    if not st.session_state.index.files:
        card('Upload your notes in the sidebar first ✨', 'sky')
        return True
    return False


def run_generator(label, function, state_key, *args):
    # Runs one generator (quiz, cards or plan) and keeps the result in session_state
    if not use_credit():
        return
    try:
        with st.spinner(label):
            st.session_state[state_key] = function(st.session_state.index, get_llm(), *args)
        return True
    except ValueError as error:
        card(str(error), 'pink')
    except Exception as error:
        print('Generator error:', error)    # details stay in the server logs
        card('Sorry, something went wrong. Please try again.', 'pink')


if 'history' not in st.session_state:
    reset_session()

index = st.session_state.index

# ---------- Sidebar ----------
with st.sidebar:
    st.header('📄 Your notes')
    uploads = st.file_uploader(
        'Upload PDF, TXT or MD', type=[s.strip('.') for s in SUPPORTED], accept_multiple_files=True
    )
    for upload in uploads or []:
        if upload.name in index.files:
            continue
        if upload.size > MAX_FILE_MB * 1024 * 1024:
            st.error(upload.name + ' is larger than ' + str(MAX_FILE_MB) + ' MB.')
            continue
        try:
            with st.spinner('Reading ' + upload.name + '...'):
                added = index.add_file(upload.name, upload.getvalue())
            st.success(upload.name + ': ' + str(added) + ' pieces stored')
        except Exception as error:
            st.error(str(error))
    if index.files:
        st.caption('Loaded: ' + ', '.join(index.files))
    st.progress(min(st.session_state.count / MAX_ACTIONS, 1.0))
    st.caption(str(st.session_state.count) + ' / ' + str(MAX_ACTIONS) + ' actions used')
    if st.button('Clear everything'):
        reset_session()
        st.rerun()

hero()
chat_tab, quiz_tab, cards_tab, plan_tab = st.tabs(['💬 Chat', '📝 Quiz', '🃏 Flashcards', '🗓️ Study plan'])

# ---------- Chat ----------
with chat_tab:
    for message in st.session_state.chat:
        with st.chat_message(message['role']):
            st.markdown(message['text'])
            for step in message.get('steps') or []:
                with st.expander('Tool used: ' + step['tool']):
                    st.write('Input:', step['args'])
                    if step['tool'] == 'search_notes':
                        st.write('Passages found in your notes:')
                        st.text(step['result'][:1500])

    prompt = st.chat_input('Ask StudyPilot something...')
    if not st.session_state.chat:
        st.write('Try one of these:')
        columns = st.columns(2)
        for i, example in enumerate(EXAMPLES):
            if columns[i % 2].button(example, key='example_' + str(i)):
                prompt = example

    if prompt and use_credit():
        st.session_state.chat.append({'role': 'user', 'text': prompt})
        try:
            with st.spinner('Thinking...'):
                answer, steps = run_agent(
                    prompt, index, st.session_state.history, notes_file=st.session_state.notes_file
                )
        except Exception as error:
            print('Agent error:', error)
            answer, steps = 'Sorry, something went wrong. Please try again.', []
        st.session_state.chat.append({'role': 'assistant', 'text': answer, 'steps': steps})
        st.rerun()

# ---------- Quiz ----------
with quiz_tab:
    if not need_notes():
        left, right = st.columns([3, 1])
        topic = left.text_input('Quiz topic', key='quiz_topic', placeholder='for example: normalization')
        count = right.slider('Questions', 3, 10, 5, key='quiz_count')
        if st.button('Make quiz ✨', key='make_quiz') and topic.strip():
            for key in [k for k in st.session_state if str(k).startswith('q_')]:
                del st.session_state[key]
            st.session_state.quiz_done = False
            run_generator('Writing your questions...', make_quiz_data, 'quiz', topic.strip(), count)

        questions = st.session_state.quiz
        if questions:
            def submit_quiz():
                # Save the answers before the radio buttons change, so scoring is reliable
                st.session_state.quiz_answers = {
                    n: st.session_state.get('q_' + str(n)) for n in range(len(questions))
                }
                st.session_state.quiz_done = True

            done = st.session_state.get('quiz_done', False)
            answers = st.session_state.get('quiz_answers', {})
            for n, q in enumerate(questions):
                st.markdown('**' + str(n + 1) + '. ' + q['question'] + '**')
                options = q['options']
                if not done:
                    st.radio(
                        'Choose one', range(len(options)), index=None, key='q_' + str(n),
                        format_func=lambda i, options=options: chr(65 + i) + ') ' + options[i],
                        label_visibility='collapsed',
                    )
                else:
                    picked = answers.get(n)
                    right_text = chr(65 + q['answer']) + ') ' + options[q['answer']]
                    if picked == q['answer']:
                        card('Correct! ' + right_text + '. ' + q['explanation'], 'mint')
                    elif picked is None:
                        card('Skipped. Correct answer: ' + right_text + '. ' + q['explanation'], 'peach')
                    else:
                        card('Not quite. You chose ' + chr(65 + picked) + ') ' + options[picked]
                             + '. Correct answer: ' + right_text + '. ' + q['explanation'], 'pink')
            if not done:
                st.button('Check my answers 🎯', key='check_quiz', on_click=submit_quiz)
            else:
                score = sum(1 for n, q in enumerate(questions) if answers.get(n) == q['answer'])
                st.progress(score / len(questions))
                card('Your score: ' + str(score) + ' / ' + str(len(questions)), 'lav')
                if score / len(questions) >= 0.8:
                    st.balloons()

# ---------- Flashcards ----------
with cards_tab:
    if not need_notes():
        left, right = st.columns([3, 1])
        topic = left.text_input('Flashcard topic', key='cards_topic', placeholder='for example: process scheduling')
        count = right.slider('Cards', 4, 15, 8, key='cards_count')
        if st.button('Make flashcards ✨', key='make_cards') and topic.strip():
            if run_generator('Making your cards...', make_cards_data, 'cards', topic.strip(), count):
                st.session_state.card_i = 0
                st.session_state.card_flipped = False
                st.session_state.card_known = set()

        cards = st.session_state.cards
        if cards:
            i = st.session_state.get('card_i', 0)
            flipped = st.session_state.get('card_flipped', False)
            known = st.session_state.get('card_known', set())
            st.progress(len(known) / len(cards))
            st.caption('Card ' + str(i + 1) + ' of ' + str(len(cards)) + ' · Known: ' + str(len(known)))
            flashcard(cards[i]['back'] if flipped else cards[i]['front'], 'back' if flipped else 'front')

            def go(step):
                st.session_state.card_i = (st.session_state.card_i + step) % len(cards)
                st.session_state.card_flipped = False

            def flip():
                st.session_state.card_flipped = not st.session_state.card_flipped

            def mark_known():
                st.session_state.card_known.add(st.session_state.card_i)
                go(1)

            a, b, c, d = st.columns(4)
            a.button('⬅️ Back', on_click=go, args=(-1,), key='card_prev')
            b.button('🔄 Flip', on_click=flip, key='card_flip')
            c.button('Next ➡️', on_click=go, args=(1,), key='card_next')
            d.button('✅ Got it', on_click=mark_known, key='card_known_btn')
            if len(known) == len(cards):
                card('You know all the cards. Great work! 🎉', 'mint')
                st.balloons()

# ---------- Study plan ----------
with plan_tab:
    if not need_notes():
        a, b = st.columns(2)
        days = a.slider('Days until exam', 1, 14, 5, key='plan_days')
        hours = b.slider('Hours per day', 1.0, 8.0, 2.0, 0.5, key='plan_hours')
        focus = st.text_input('Focus on (optional)', key='plan_focus', placeholder='a topic you find hard')
        if st.button('Build my plan ✨', key='make_plan'):
            for key in [k for k in st.session_state if str(k).startswith('task_')]:
                del st.session_state[key]
            run_generator('Planning your days...', make_plan_data, 'plan', days, hours, focus.strip())

        plan = st.session_state.plan
        if plan:
            keys = [(d['day'], t) for d in plan for t in range(len(d['tasks']))]
            ticked = sum(1 for dn, t in keys if st.session_state.get('task_' + str(dn) + '_' + str(t)))
            st.progress(ticked / len(keys))
            st.caption(str(ticked) + ' of ' + str(len(keys)) + ' tasks done')
            colors = ['lav', 'pink', 'mint', 'peach', 'sky']
            for d in plan:
                card('Day ' + str(d['day']) + ': ' + d['title'], colors[(d['day'] - 1) % len(colors)])
                for t, task in enumerate(d['tasks']):
                    st.checkbox(task, key='task_' + str(d['day']) + '_' + str(t))
            if ticked == len(keys):
                card('Plan complete! Time to rest 🌸', 'mint')
