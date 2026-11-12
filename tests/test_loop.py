from types import SimpleNamespace

from agent.loop import run_agent


class FakeCompletions:
    def __init__(self, responses):
        self.responses = iter(responses)

    def create(self, **kwargs):
        return next(self.responses)


def test_run_agent_returns_tool_steps_and_uses_session_notes():
    tool_call = SimpleNamespace(
        id="call-1",
        function=SimpleNamespace(name="save_note", arguments='{"text":"Buy milk"}'),
    )
    responses = [
        SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[tool_call]))]
        ),
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(tool_calls=None, content="Note saved.")
                )
            ]
        ),
    ]
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions(responses))
    )
    history = []
    notes = []
    tool_steps = []
    tool_calls = []

    answer, steps = run_agent(
        "Save a note to buy milk.",
        history,
        notes=notes,
        client=client,
        model="test-model",
        on_tool_step=tool_steps.append,
        on_tool_call=lambda name, arguments: tool_calls.append((name, arguments)),
    )

    assert answer == "Note saved."
    assert steps == ["Using tool: save_note"]
    assert tool_steps == steps
    assert tool_calls == [("save_note", {"text": "Buy milk"})]
    assert "Buy milk" in notes[0]
    assert [message["role"] for message in history] == ["user", "assistant"]


def test_run_agent_can_return_tool_results():
    tool_call = SimpleNamespace(
        id="call-1",
        function=SimpleNamespace(name="save_note", arguments='{"text":"Call Sam"}'),
    )
    responses = [
        SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[tool_call]))]
        ),
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(tool_calls=None, content="Saved.")
                )
            ]
        ),
    ]
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions(responses))
    )

    answer, steps, results = run_agent(
        "Save a note to call Sam.",
        [],
        notes=[],
        client=client,
        model="test-model",
        include_tool_results=True,
    )

    assert answer == "Saved."
    assert steps == ["Using tool: save_note"]
    assert results == [
        {
            "name": "save_note",
            "args": {"text": "Call Sam"},
            "result": "Note saved.",
        }
    ]


def test_run_agent_returns_structured_weather_result(monkeypatch):
    weather_data = {
        "city": "Chennai",
        "country": "India",
        "temperature": 31.5,
        "humidity": 68,
        "wind": 12.3,
        "latitude": 13.08,
        "longitude": 80.27,
    }
    monkeypatch.setattr("agent.loop.get_weather_data", lambda city: weather_data)
    tool_call = SimpleNamespace(
        id="call-weather",
        function=SimpleNamespace(name="get_weather", arguments='{"city":"Chennai"}'),
    )
    responses = [
        SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[tool_call]))]
        ),
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(tool_calls=None, content="It is 31.5 °C.")
                )
            ]
        ),
    ]
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions(responses))
    )

    answer, _, results = run_agent(
        "What's the weather in Chennai?",
        [],
        client=client,
        model="test-model",
        include_tool_results=True,
    )

    assert answer == "It is 31.5 °C."
    assert results == [
        {
            "name": "get_weather",
            "args": {"city": "Chennai"},
            "result": weather_data,
        }
    ]
