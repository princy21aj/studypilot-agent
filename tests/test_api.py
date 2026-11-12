import pytest
from fastapi.testclient import TestClient

import agent.config
import agent.loop
import api
from tests.test_app import fake_llm_client
from tests.test_loop import FakeClient
from tests.test_rag import make_index


@pytest.fixture
def client(monkeypatch):
    api.SESSIONS.clear()
    monkeypatch.setattr(api, 'index_factory', make_index)
    monkeypatch.setattr(agent.config, 'create_client', fake_llm_client)
    return TestClient(api.app)


def start(client):
    response = client.post('/api/session')
    assert response.status_code == 200
    return {'X-Session-Id': response.json()['session_id']}


def upload_notes(client, headers):
    files = {'file': ('dbms.txt', b'normalization removes redundancy using normal forms like 1NF 2NF 3NF', 'text/plain')}
    return client.post('/api/upload', files=files, headers=headers)


def test_health(client):
    assert client.get('/api/health').json() == {'ok': True}


def test_requests_need_a_session(client):
    assert client.post('/api/quiz', json={'topic': 'x'}).status_code == 404
    assert client.post('/api/quiz', json={'topic': 'x'}, headers={'X-Session-Id': 'bad'}).status_code == 404


def test_upload_and_status(client):
    headers = start(client)
    result = upload_notes(client, headers)
    assert result.status_code == 200 and result.json()['pieces'] == 1
    assert client.get('/api/status', headers=headers).json()['files'] == ['dbms.txt']


def test_upload_rejects_wrong_type_and_empty_file(client):
    headers = start(client)
    bad = client.post('/api/upload', files={'file': ('a.exe', b'x', 'application/octet-stream')}, headers=headers)
    assert bad.status_code == 400
    empty = client.post('/api/upload', files={'file': ('a.txt', b'   ', 'text/plain')}, headers=headers)
    assert empty.status_code == 400


def test_upload_rejects_big_file(client, monkeypatch):
    monkeypatch.setattr(api, 'MAX_FILE_MB', 0)
    headers = start(client)
    assert upload_notes(client, headers).status_code == 400


def test_quiz_cards_plan(client):
    headers = start(client)
    upload_notes(client, headers)
    quiz = client.post('/api/quiz', json={'topic': 'normalization', 'num_questions': 3}, headers=headers).json()
    assert quiz['questions'][0]['answer'] == 0 and quiz['used'] == 1
    cards = client.post('/api/cards', json={'topic': 'normal forms'}, headers=headers).json()
    assert len(cards['cards']) == 2
    plan = client.post('/api/plan', json={'days': 3, 'hours_per_day': 2}, headers=headers).json()
    assert plan['days'][0]['tasks'] == ['Read unit 1', 'Do 5 questions'] and plan['used'] == 3


def test_quiz_without_notes_is_a_clear_error_and_not_counted(client):
    headers = start(client)
    response = client.post('/api/quiz', json={'topic': 'x'}, headers=headers)
    assert response.status_code == 400 and 'upload' in response.json()['detail'].lower()
    assert client.get('/api/status', headers=headers).json()['used'] == 0


def test_validation(client):
    headers = start(client)
    assert client.post('/api/quiz', json={'topic': ''}, headers=headers).status_code == 422
    assert client.post('/api/chat', json={'message': 'x' * 3000}, headers=headers).status_code == 422


def test_chat_uses_agent(client, monkeypatch):
    monkeypatch.setattr(agent.loop, 'create_client', lambda: (FakeClient(), 'fake'))
    headers = start(client)
    upload_notes(client, headers)
    result = client.post('/api/chat', json={'message': 'What is normalization?'}, headers=headers).json()
    assert 'redundancy' in result['answer'] and result['steps'][0]['tool'] == 'search_notes'


def test_action_limit(client, monkeypatch):
    monkeypatch.setattr(api, 'MAX_ACTIONS', 1)
    headers = start(client)
    upload_notes(client, headers)
    assert client.post('/api/cards', json={'topic': 'n'}, headers=headers).status_code == 200
    assert client.post('/api/cards', json={'topic': 'n'}, headers=headers).status_code == 429


def test_sessions_are_private(client):
    one, two = start(client), start(client)
    upload_notes(client, one)
    assert client.get('/api/status', headers=two).json()['files'] == []


def test_end_session_and_session_cap(client, monkeypatch):
    headers = start(client)
    client.delete('/api/session', headers=headers)
    assert client.get('/api/status', headers=headers).status_code == 404
    monkeypatch.setattr(api, 'MAX_SESSIONS', 2)
    for _ in range(5):
        start(client)
    assert len(api.SESSIONS) <= 2
