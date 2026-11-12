from datetime import datetime

from agent.toolkit import NO_NOTES, TOOLS, build_tool_functions
from tests.test_rag import make_index


def fake_llm(system, user):
    return 'LLM saw: ' + user


def make_tools(tmp_path, with_notes=True):
    index = make_index()
    if with_notes:
        index.add_file('dbms.txt', b'normalization removes redundancy using normal forms like 1NF 2NF 3NF')
    return build_tool_functions(index, fake_llm, tmp_path / 'notes.txt')


def test_every_tool_schema_has_a_function(tmp_path):
    tools = make_tools(tmp_path)
    assert {t['function']['name'] for t in TOOLS} == set(tools)


def test_search_notes_returns_source_label(tmp_path):
    assert '[dbms.txt p.1]' in make_tools(tmp_path)['search_notes']('normalization')


def test_tools_say_so_when_no_notes(tmp_path):
    tools = make_tools(tmp_path, with_notes=False)
    assert tools['search_notes']('x') == NO_NOTES
    assert tools['make_quiz']('x') == NO_NOTES
    assert tools['summarize_topic']('x') == NO_NOTES
    assert tools['make_study_plan'](5) == NO_NOTES


def test_quiz_uses_the_notes_and_count(tmp_path):
    result = make_tools(tmp_path)['make_quiz']('normalization', 3)
    assert 'Write 3 questions' in result and 'redundancy' in result


def test_quiz_count_is_capped(tmp_path):
    assert 'Write 10 questions' in make_tools(tmp_path)['make_quiz']('normalization', 99)


def test_study_plan_includes_days_and_hours(tmp_path):
    result = make_tools(tmp_path)['make_study_plan'](5, 2)
    assert 'Days until exam: 5' in result and 'Hours per day: 2.0' in result


def test_save_and_read_personal_notes(tmp_path):
    tools = make_tools(tmp_path)
    assert tools['read_notes']() == 'No saved notes yet.'
    tools['save_note']('learn 3NF definition')
    assert 'learn 3NF definition' in tools['read_notes']()


def test_current_time_format(tmp_path):
    datetime.strptime(make_tools(tmp_path)['get_current_time'](), '%Y-%m-%d %H:%M:%S')
