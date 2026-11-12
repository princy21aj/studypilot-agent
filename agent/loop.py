import json

from agent.config import create_client
from agent.toolkit import DEFAULT_NOTES_FILE, TOOLS, build_tool_functions

MAX_STEPS = 5       # the agent can never loop forever
MEMORY_SIZE = 10    # how many past messages to remember

SYSTEM_PROMPT = (
    'You are StudyPilot, a study assistant for college students. '
    'The student uploads their notes. For any question about the subject, call search_notes '
    'first and answer ONLY from what it returns. If the notes do not contain the answer, '
    'say so clearly instead of guessing. Always cite sources in the form [file p.N]. '
    'Use make_quiz, summarize_topic and make_study_plan when the student asks for practice, '
    'a revision sheet or a plan. Explain in simple words, keep answers short and clear.'
)


def make_llm(client, model):
    """A small helper so tools can ask the LLM to write text (quiz, summary, plan)."""
    def llm(system, user):
        response = client.chat.completions.create(
            model=model,
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        )
        return response.choices[0].message.content or ''
    return llm


def run_agent(user_message, index, history=None, notes_file=DEFAULT_NOTES_FILE, on_tool_step=None):
    # history is a list of past messages. It is updated in place, so it works as memory.
    # Returns (answer, steps). Each step is a dict: step, tool, args, result.
    if history is None:
        history = []
    client, model = create_client()
    tool_functions = build_tool_functions(index, make_llm(client, model), notes_file)

    messages = (
        [{'role': 'system', 'content': SYSTEM_PROMPT}]
        + history[-MEMORY_SIZE:]
        + [{'role': 'user', 'content': user_message}]
    )
    steps = []

    for step_number in range(1, MAX_STEPS + 1):
        response = client.chat.completions.create(model=model, messages=messages, tools=TOOLS)
        message = response.choices[0].message

        # No tool requested: this is the final answer
        if not message.tool_calls:
            answer = message.content or ''
            history.append({'role': 'user', 'content': user_message})
            history.append({'role': 'assistant', 'content': answer})
            return answer, steps

        # The LLM asked for tools: run each one and send the results back
        messages.append(message)
        for call in message.tool_calls:
            name = call.function.name
            args = {}
            try:
                args = json.loads(call.function.arguments or '{}')
                result = tool_functions[name](**args)
            except Exception as error:
                result = 'Error: ' + str(error)   # the LLM can read the error and recover
            step = {'step': step_number, 'tool': name, 'args': args, 'result': str(result)}
            steps.append(step)
            if on_tool_step:
                on_tool_step(step)
            messages.append({'role': 'tool', 'tool_call_id': call.id, 'content': str(result)})

    return 'Stopped: reached the maximum number of steps.', steps
