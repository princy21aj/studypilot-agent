import json
from pathlib import Path

from streamlit.testing.v1 import AppTest

import agent.config
import agent.rag
from tests.test_rag import make_index


def fake_llm_client():
    from types import SimpleNamespace as NS

    def create(**kwargs):
        system = kwargs['messages'][0]['content']
        if 'exam questions' in system:
            text = json.dumps({'questions': [{'question': 'What removes redundancy?', 'options': ['Normalization', 'Indexing', 'Joins', 'Views'], 'answer': 0, 'explanation': 'Normal forms.'}]})
        elif 'flashcards' in system:
            text = json.dumps({'cards': [{'front': 'What is 1NF?', 'back': 'Atomic values'}, {'front': 'What is 2NF?', 'back': 'No partial dependency'}]})
        else:
            text = json.dumps({'days': [{'day': 1, 'title': 'Basics', 'tasks': ['Read unit 1', 'Do 5 questions']}]})
        return NS(choices=[NS(message=NS(content=text, tool_calls=None))])

    return NS(chat=NS(completions=NS(create=create))), 'fake'


def load_app(monkeypatch):
    def fake_index():
        index = make_index()
        index.add_file('dbms.txt', b'normalization removes redundancy using normal forms like 1NF 2NF 3NF')
        return index

    monkeypatch.setattr(agent.rag, 'NotesIndex', lambda: fake_index())
    monkeypatch.setattr(agent.config, 'create_client', fake_llm_client)
    return AppTest.from_file(str(Path(__file__).resolve().parent.parent / 'streamlit_app.py'), default_timeout=30).run()


def test_page_loads_with_four_tabs(monkeypatch):
    at = load_app(monkeypatch)
    assert not at.exception
    assert len(at.tabs) == 4


def test_quiz_flow(monkeypatch):
    at = load_app(monkeypatch)
    at.text_input(key='quiz_topic').set_value('normalization')
    at.button(key='make_quiz').click().run()
    assert not at.exception
    at.radio(key='q_0').set_value('A) Normalization')
    at.button(key='check_quiz').click().run()
    assert not at.exception
    assert any('Your score: 1 / 1' in m.value for m in at.markdown)


def test_flashcards_flip_and_next(monkeypatch):
    at = load_app(monkeypatch)
    at.text_input(key='cards_topic').set_value('normal forms')
    at.button(key='make_cards').click().run()
    at.button(key='card_flip').click().run()
    at.button(key='card_next').click().run()
    assert not at.exception
    assert at.session_state.card_i == 1


def test_plan_checklist(monkeypatch):
    at = load_app(monkeypatch)
    at.button(key='make_plan').click().run()
    assert not at.exception
    at.checkbox(key='task_1_0').check().run()
    assert any('1 of 2 tasks done' in c.value for c in at.caption)
