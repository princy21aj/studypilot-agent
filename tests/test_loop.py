import json
from types import SimpleNamespace as NS

import agent.loop as loop
from tests.test_rag import make_index


class FakeClient:
    """Pretends to be the LLM: first asks for search_notes, then answers."""

    def __init__(self):
        self.calls = 0
        self.chat = NS(completions=NS(create=self.create))

    def create(self, **kwargs):
        self.calls += 1
        if self.calls == 1:
            call = NS(id='1', function=NS(name='search_notes', arguments=json.dumps({'query': 'normalization'})))
            msg = NS(content=None, tool_calls=[call])
        else:
            msg = NS(content='Normalization removes redundancy [dbms.txt p.1]', tool_calls=None)
        return NS(choices=[NS(message=msg)])


def test_agent_uses_tool_then_answers(monkeypatch, tmp_path):
    monkeypatch.setattr(loop, 'create_client', lambda: (FakeClient(), 'fake-model'))
    index = make_index()
    index.add_file('dbms.txt', b'normalization removes redundancy using normal forms')
    history = []
    answer, steps = loop.run_agent('What is normalization?', index, history, tmp_path / 'n.txt')
    assert 'redundancy' in answer
    assert steps[0]['tool'] == 'search_notes'
    assert '[dbms.txt p.1]' in steps[0]['result']
    assert len(history) == 2


def test_unknown_tool_does_not_crash(monkeypatch, tmp_path):
    class BadClient(FakeClient):
        def create(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                call = NS(id='1', function=NS(name='nope', arguments='{}'))
                return NS(choices=[NS(message=NS(content=None, tool_calls=[call]))])
            return NS(choices=[NS(message=NS(content='ok', tool_calls=None))])

    monkeypatch.setattr(loop, 'create_client', lambda: (BadClient(), 'm'))
    answer, steps = loop.run_agent('hi', make_index(), [], tmp_path / 'n.txt')
    assert answer == 'ok' and steps[0]['result'].startswith('Error')


def test_step_limit(monkeypatch, tmp_path):
    class LoopClient(FakeClient):
        def create(self, **kwargs):
            call = NS(id='1', function=NS(name='get_current_time', arguments='{}'))
            return NS(choices=[NS(message=NS(content=None, tool_calls=[call]))])

    monkeypatch.setattr(loop, 'create_client', lambda: (LoopClient(), 'm'))
    answer, steps = loop.run_agent('hi', make_index(), [], tmp_path / 'n.txt')
    assert answer.startswith('Stopped') and len(steps) == loop.MAX_STEPS
