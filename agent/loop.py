import json

from agent.config import create_client
from agent.toolkit import (
    DEFAULT_NOTES_FILE,
    LEGACY_TOOLS,
    TOOLS,
    TOOL_FUNCTIONS,
    build_tool_functions,
    format_weather_data,
    get_weather_data,
    read_notes,
    save_note,
)

MAX_STEPS = 5
MAX_HISTORY_MESSAGES = 20

LEGACY_SYSTEM_PROMPT = (
    "You are TaskPilot, a helpful assistant. Use your tools when needed. "
    "In your final answer, always include the actual data you found "
    "(numbers, facts, saved text), not just a statement that you did the task. "
    "Keep answers short and clear."
)
SYSTEM_PROMPT = (
    'You are StudyPilot, a study assistant for college students. '
    'The student uploads their notes. For any question about the subject, call search_notes '
    'first and answer ONLY from what it returns. If the notes do not contain the answer, '
    'say so clearly instead of guessing. Always cite sources in the form [file p.N]. '
    'Use make_quiz, summarize_topic and make_study_plan when the student asks for practice, '
    'a revision sheet or a plan. Explain in simple words, keep answers short and clear.'
)


def make_llm(client, model):
    def llm(system, user):
        response = client.chat.completions.create(
            model=model,
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        )
        return response.choices[0].message.content or ''

    return llm


def run_agent(
    user_message,
    history_or_index=None,
    history=None,
    notes=None,
    client=None,
    model=None,
    on_tool_step=None,
    on_tool_call=None,
    on_tool_result=None,
    include_tool_results=False,
    notes_file=DEFAULT_NOTES_FILE,
):
    if isinstance(history_or_index, list):
        legacy_history = history_or_index
        index = None
        legacy_notes = notes
        legacy_client = client
        legacy_model = model
        use_legacy = True
    else:
        index = history_or_index
        history = history or []
        legacy_history = history
        legacy_notes = None
        legacy_client = None
        legacy_model = None
        use_legacy = index is None

    if use_legacy:
        if legacy_client is None:
            legacy_client, configured_model = create_client()
            if legacy_model is None:
                legacy_model = configured_model

        tool_functions = TOOL_FUNCTIONS.copy()
        if legacy_notes is not None:
            tool_functions['save_note'] = lambda text: save_note(text, notes=legacy_notes)
            tool_functions['read_notes'] = lambda: read_notes(notes=legacy_notes)

        messages = (
            [{'role': 'system', 'content': LEGACY_SYSTEM_PROMPT}]
            + legacy_history[-MAX_HISTORY_MESSAGES:]
            + [{'role': 'user', 'content': user_message}]
        )
        tool_steps = []
        tool_results = []

        for step in range(1, MAX_STEPS + 1):
            response = legacy_client.chat.completions.create(
                model=legacy_model, messages=messages, tools=LEGACY_TOOLS
            )
            msg = response.choices[0].message

            if not msg.tool_calls:
                answer = msg.content or ''
                legacy_history.extend([
                    {'role': 'user', 'content': user_message},
                    {'role': 'assistant', 'content': answer},
                ])
                del legacy_history[:-MAX_HISTORY_MESSAGES]
                if include_tool_results:
                    return answer, tool_steps, tool_results
                return answer, tool_steps

            messages.append(msg)
            for call in msg.tool_calls:
                name = call.function.name
                args = json.loads(call.function.arguments or '{}')
                tool_step = f'Using tool: {name}'
                tool_steps.append(tool_step)
                if on_tool_step:
                    on_tool_step(tool_step)
                if on_tool_call:
                    on_tool_call(name, args)
                try:
                    if name == 'get_weather':
                        result = get_weather_data(**args)
                        response_content = format_weather_data(result)
                    else:
                        result = tool_functions[name](**args)
                        response_content = str(result)
                except Exception as e:
                    result = f'Error: {e}'
                    response_content = result
                tool_result = {'name': name, 'args': args, 'result': result}
                tool_results.append(tool_result)
                if on_tool_result:
                    on_tool_result(name, args, result)
                messages.append({
                    'role': 'tool',
                    'tool_call_id': call.id,
                    'content': response_content,
                })
        answer = 'Stopped: reached the maximum number of steps.'
        if include_tool_results:
            return answer, tool_steps, tool_results
        return answer, tool_steps

    if client is None:
        client, configured_model = create_client()
        if model is None:
            model = configured_model

    if model is None:
        raise ValueError('Model is required when using the StudyPilot agent.')

    tool_functions = build_tool_functions(index, make_llm(client, model), notes_file)
    messages = (
        [{'role': 'system', 'content': SYSTEM_PROMPT}]
        + history[-MAX_HISTORY_MESSAGES:]
        + [{'role': 'user', 'content': user_message}]
    )
    steps = []

    for step_number in range(1, MAX_STEPS + 1):
        response = client.chat.completions.create(model=model, messages=messages, tools=TOOLS)
        message = response.choices[0].message

        if not message.tool_calls:
            answer = message.content or ''
            history.append({'role': 'user', 'content': user_message})
            history.append({'role': 'assistant', 'content': answer})
            return answer, steps

        messages.append(message)
        for call in message.tool_calls:
            name = call.function.name
            args = {}
            try:
                args = json.loads(call.function.arguments or '{}')
                result = tool_functions[name](**args)
            except Exception as error:
                result = 'Error: ' + str(error)
            step = {'step': step_number, 'tool': name, 'args': args, 'result': str(result)}
            steps.append(step)
            if on_tool_step:
                on_tool_step(step)
            messages.append({'role': 'tool', 'tool_call_id': call.id, 'content': str(result)})

    return 'Stopped: reached the maximum number of steps.', steps
