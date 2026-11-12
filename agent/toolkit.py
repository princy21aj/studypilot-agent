# The tools StudyPilot can use, plus the descriptions the LLM reads to choose between them.
from datetime import datetime
from pathlib import Path

from agent.rag import format_hits

DEFAULT_NOTES_FILE = Path('notes.txt')
NO_NOTES = 'No study notes have been uploaded yet. Ask the student to upload a PDF, TXT or MD file first.'

QUIZ_SYSTEM = (
    'You are an exam question writer. Use ONLY the study material given. '
    'Write the requested number of multiple-choice questions. For each: the question, '
    'options A to D, the correct answer, and a one-line explanation. '
    'Cite the source label such as [notes.pdf p.3] after each explanation.'
)
SUMMARY_SYSTEM = (
    'You write revision sheets for students. Use ONLY the study material given. '
    'Give: 1) a 2-line overview, 2) key points as short bullets, 3) important terms with '
    'one-line meanings. Cite source labels such as [notes.pdf p.3].'
)
PLAN_SYSTEM = (
    'You are a study planner. Using ONLY the topics visible in the material, build a '
    'day-by-day revision plan that fits the days and hours given. Put harder or larger '
    'topics earlier, and keep the last day for revision and practice. Keep it short.'
)


def get_current_time():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def build_tool_functions(index, llm, notes_file=DEFAULT_NOTES_FILE):
    """index: NotesIndex. llm: function (system, user) -> text. notes_file: revision notes."""
    notes_file = Path(notes_file)

    def search_notes(query):
        hits = index.search(query, k=4)
        if not hits:
            return NO_NOTES
        return format_hits(hits)

    def make_quiz(topic, num_questions=5):
        num_questions = max(1, min(int(num_questions), 10))
        hits = index.search(topic, k=5)
        if not hits:
            return NO_NOTES
        user = 'Write ' + str(num_questions) + ' questions on: ' + topic + '\n\nStudy material:\n' + format_hits(hits)
        return llm(QUIZ_SYSTEM, user)

    def summarize_topic(topic):
        hits = index.search(topic, k=6)
        if not hits:
            return NO_NOTES
        user = 'Revision sheet for: ' + topic + '\n\nStudy material:\n' + format_hits(hits)
        return llm(SUMMARY_SYSTEM, user)

    def make_study_plan(days, hours_per_day=2, focus=''):
        days = max(1, min(int(days), 60))
        hours = max(0.5, min(float(hours_per_day), 12))
        pieces = index.overview(max_chunks=10)
        if focus:
            pieces = index.search(focus, k=5) + pieces
        if not pieces:
            return NO_NOTES
        user = (
            'Days until exam: ' + str(days) + '\nHours per day: ' + str(hours)
            + '\nToday: ' + get_current_time()[:10]
            + ('\nFocus on: ' + focus if focus else '')
            + '\n\nMaterial samples:\n' + format_hits(pieces)
        )
        return llm(PLAN_SYSTEM, user)

    def save_note(text):
        with open(notes_file, 'a', encoding='utf-8') as f:
            f.write('[' + get_current_time() + '] ' + text + '\n')
        return 'Note saved.'

    def read_notes():
        if not notes_file.exists():
            return 'No saved notes yet.'
        return notes_file.read_text(encoding='utf-8')

    # Tool name -> real function
    return {
        'get_current_time': get_current_time,
        'search_notes': search_notes,
        'make_quiz': make_quiz,
        'summarize_topic': summarize_topic,
        'make_study_plan': make_study_plan,
        'save_note': save_note,
        'read_notes': read_notes,
    }


def _tool(name, description, properties=None, required=None):
    parameters = {'type': 'object', 'properties': properties or {}}
    if required:
        parameters['required'] = required
    return {
        'type': 'function',
        'function': {'name': name, 'description': description, 'parameters': parameters},
    }


# The menu the LLM reads. Clear descriptions help it choose the right tool.
TOOLS = [
    _tool('get_current_time', 'Get the current date and time.'),
    _tool(
        'search_notes',
        'Find the parts of the uploaded study notes that answer a question. Use this first '
        'for any question about the syllabus or notes. Returns text with [file p.N] labels.',
        {'query': {'type': 'string', 'description': 'The question or topic to look for'}},
        ['query'],
    ),
    _tool(
        'make_quiz',
        'Create multiple-choice practice questions from the uploaded notes on a topic.',
        {
            'topic': {'type': 'string', 'description': 'Topic to be tested on'},
            'num_questions': {'type': 'integer', 'description': 'How many questions, 1 to 10'},
        },
        ['topic'],
    ),
    _tool(
        'summarize_topic',
        'Create a short revision sheet (key points and terms) for a topic from the uploaded notes.',
        {'topic': {'type': 'string', 'description': 'Topic or chapter to summarize'}},
        ['topic'],
    ),
    _tool(
        'make_study_plan',
        'Build a day-by-day revision plan from the uploaded notes before an exam.',
        {
            'days': {'type': 'integer', 'description': 'Days left until the exam'},
            'hours_per_day': {'type': 'number', 'description': 'Study hours available per day'},
            'focus': {'type': 'string', 'description': 'Optional topic to focus on'},
        },
        ['days'],
    ),
    _tool(
        'save_note',
        'Save a short personal revision note, such as a formula or a reminder.',
        {'text': {'type': 'string', 'description': 'The note text'}},
        ['text'],
    ),
    _tool('read_notes', 'Read all personal revision notes the student saved before.'),
]
