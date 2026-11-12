import json

import pytest

from agent.study import make_cards_data, make_plan_data, make_quiz_data, parse_json
from tests.test_rag import make_index


def index_with_notes():
    index = make_index()
    index.add_file('dbms.txt', b'normalization removes redundancy using normal forms like 1NF 2NF 3NF')
    return index


def test_parse_json_handles_fences_and_extra_text():
    assert parse_json('Sure! ```json\n{"a": 1}\n``` done') == {'a': 1}


def test_parse_json_rejects_garbage():
    with pytest.raises(ValueError):
        parse_json('no json here')
    with pytest.raises(ValueError):
        parse_json('{broken')


def test_quiz_drops_invalid_questions():
    data = {'questions': [
        {'question': 'Q1', 'options': ['a', 'b', 'c', 'd'], 'answer': 2, 'explanation': 'e'},
        {'question': 'bad', 'options': ['a', 'b'], 'answer': 5},
        {'options': ['a', 'b'], 'answer': 0},
    ]}
    result = make_quiz_data(index_with_notes(), lambda s, u: json.dumps(data), 'normalization', 5)
    assert len(result) == 1 and result[0]['answer'] == 2


def test_quiz_without_notes_raises():
    with pytest.raises(ValueError):
        make_quiz_data(make_index(), lambda s, u: '{}', 'x')


def test_quiz_with_no_valid_questions_raises():
    with pytest.raises(ValueError):
        make_quiz_data(index_with_notes(), lambda s, u: '{"questions": []}', 'normalization')


def test_cards_and_plan():
    cards = make_cards_data(index_with_notes(), lambda s, u: '{"cards": [{"front": "f", "back": "b"}, {"front": "x"}]}', 'n')
    assert cards == [{'front': 'f', 'back': 'b'}]
    plan = make_plan_data(index_with_notes(), lambda s, u: '{"days": [{"title": "T", "tasks": ["a", "b"]}]}', 3, 2)
    assert plan == [{'day': 1, 'title': 'T', 'tasks': ['a', 'b']}]
