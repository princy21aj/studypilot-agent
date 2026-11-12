# Interactive study features: quiz, flashcards and plan as structured data (JSON),
# so the web page can show them as clickable cards instead of plain text.
import json
import re

from agent.rag import format_hits
from agent.toolkit import NO_NOTES

QUIZ_SYSTEM = (
    'You write exam questions. Use ONLY the study material given. Reply with JSON only, '
    'no extra words, in exactly this shape: '
    '{"questions": [{"question": "...", "options": ["...", "...", "...", "..."], '
    '"answer": 0, "explanation": "..."}]}. '
    'Give 4 options without letters. "answer" is the index (0 to 3) of the correct option.'
)
CARDS_SYSTEM = (
    'You make flashcards from study material. Use ONLY the material given. Reply with JSON only '
    'in exactly this shape: {"cards": [{"front": "term or short question", "back": "short answer"}]}. '
    'Keep every back under 25 words.'
)
PLAN_SYSTEM = (
    'You are a study planner. Use ONLY the topics visible in the material. Reply with JSON only '
    'in exactly this shape: {"days": [{"day": 1, "title": "...", "tasks": ["...", "..."]}]}. '
    'Make exactly the number of days asked, 2 to 4 short tasks per day, harder topics first, '
    'and keep the last day for revision and practice.'
)


def parse_json(text):
    # LLMs sometimes wrap JSON in ``` fences or add a sentence. Cut out the JSON part.
    text = re.sub(r'```(?:json)?', '', text or '')
    start, end = text.find('{'), text.rfind('}')
    if start == -1 or end <= start:
        raise ValueError('The AI did not return structured data. Please try again.')
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        raise ValueError('The AI answer could not be read. Please try again.')


def make_quiz_data(index, llm, topic, num_questions=5):
    num_questions = max(1, min(int(num_questions), 10))
    hits = index.search(topic, k=5)
    if not hits:
        raise ValueError(NO_NOTES)
    user = 'Write ' + str(num_questions) + ' questions on: ' + topic + '\n\nStudy material:\n' + format_hits(hits)
    data = parse_json(llm(QUIZ_SYSTEM, user))
    questions = []
    for item in data.get('questions', []):
        options = item.get('options')
        answer = item.get('answer')
        if (item.get('question') and isinstance(options, list) and len(options) >= 2
                and isinstance(answer, int) and 0 <= answer < len(options)):
            questions.append({
                'question': str(item['question']),
                'options': [str(o) for o in options],
                'answer': answer,
                'explanation': str(item.get('explanation', '')),
            })
    if not questions:
        raise ValueError('No valid questions were made. Please try again.')
    return questions[:num_questions]


def make_cards_data(index, llm, topic, num_cards=8):
    num_cards = max(1, min(int(num_cards), 15))
    hits = index.search(topic, k=6)
    if not hits:
        raise ValueError(NO_NOTES)
    user = 'Make ' + str(num_cards) + ' flashcards on: ' + topic + '\n\nStudy material:\n' + format_hits(hits)
    data = parse_json(llm(CARDS_SYSTEM, user))
    cards = [
        {'front': str(c['front']), 'back': str(c['back'])}
        for c in data.get('cards', []) if c.get('front') and c.get('back')
    ]
    if not cards:
        raise ValueError('No flashcards were made. Please try again.')
    return cards[:num_cards]


def make_plan_data(index, llm, days, hours_per_day=2, focus=''):
    days = max(1, min(int(days), 14))
    hours = max(0.5, min(float(hours_per_day), 12))
    pieces = index.overview(max_chunks=10)
    if focus:
        pieces = index.search(focus, k=5) + pieces
    if not pieces:
        raise ValueError(NO_NOTES)
    user = (
        'Number of days: ' + str(days) + '\nHours per day: ' + str(hours)
        + ('\nFocus on: ' + focus if focus else '')
        + '\n\nMaterial samples:\n' + format_hits(pieces)
    )
    data = parse_json(llm(PLAN_SYSTEM, user))
    plan = []
    for number, item in enumerate(data.get('days', []), start=1):
        tasks = [str(t) for t in item.get('tasks', []) if t]
        if tasks:
            plan.append({'day': number, 'title': str(item.get('title', 'Day ' + str(number))), 'tasks': tasks})
    if not plan:
        raise ValueError('No plan was made. Please try again.')
    return plan[:days]
