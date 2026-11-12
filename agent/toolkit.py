from datetime import datetime
from pathlib import Path

import requests

from agent.rag import format_hits

NOTES_FILE = Path("notes.txt")
DEFAULT_NOTES_FILE = NOTES_FILE
HEADERS = {"User-Agent": "TaskPilot/0.1 (student project)"}

NO_NOTES = "No study notes have been uploaded yet. Ask the student to upload a PDF, TXT or MD file first."
QUIZ_SYSTEM = (
    "You are an exam question writer. Use ONLY the study material given. "
    "Write the requested number of multiple-choice questions. For each: the question, "
    "options A to D, the correct answer, and a one-line explanation. "
    "Cite the source label such as [notes.pdf p.3] after each explanation."
)
SUMMARY_SYSTEM = (
    "You write revision sheets for students. Use ONLY the study material given. "
    "Give: 1) a 2-line overview, 2) key points as short bullets, 3) important terms with "
    "one-line meanings. Cite source labels such as [notes.pdf p.3]."
)
PLAN_SYSTEM = (
    "You are a study planner. Using ONLY the topics visible in the material, build a "
    "day-by-day revision plan that fits the days and hours given. Put harder or larger "
    "topics earlier, and keep the last day for revision and practice. Keep it short."
)


# Legacy TaskPilot utilities kept for compatibility with the older tests and app.
def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def save_note(text, notes=None, notes_file=None):
    if notes is not None:
        notes.append(f"[{get_current_time()}] {text}")
        return "Note saved."

    if notes_file is None:
        notes_file = NOTES_FILE
    notes_file = Path(notes_file)
    with open(notes_file, "a", encoding="utf-8") as f:
        f.write(f"[{get_current_time()}] {text}\n")
    return "Note saved."


def read_notes(notes=None, notes_file=None):
    if notes is not None:
        return "\n".join(notes) if notes else "No notes yet."

    if notes_file is None:
        notes_file = NOTES_FILE
    notes_file = Path(notes_file)
    if not notes_file.exists():
        return "No notes yet."
    return notes_file.read_text(encoding="utf-8")


def get_weather_data(city):
    geo = requests.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        params={"name": city, "count": 1},
        headers=HEADERS,
        timeout=10,
    ).json()
    if not geo.get("results"):
        return {
            "city": city,
            "country": "",
            "temperature": None,
            "humidity": None,
            "wind": None,
            "latitude": None,
            "longitude": None,
        }
    place = geo["results"][0]
    weather = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        },
        headers=HEADERS,
        timeout=10,
    ).json()
    cur = weather["current"]
    return {
        "city": place["name"],
        "country": place.get("country", ""),
        "temperature": cur["temperature_2m"],
        "humidity": cur["relative_humidity_2m"],
        "wind": cur["wind_speed_10m"],
        "latitude": place["latitude"],
        "longitude": place["longitude"],
    }


def format_weather_data(data):
    if data["temperature"] is None:
        return f"Could not find a city named {data['city']}."

    country = f", {data['country']}" if data["country"] else ""
    return (
        f"{data['city']}{country}: {data['temperature']} °C, "
        f"humidity {data['humidity']}%, wind {data['wind']} km/h"
    )


def get_weather(city):
    return format_weather_data(get_weather_data(city))


def search_wikipedia(query):
    data = requests.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": query,
            "gsrlimit": 3,
            "prop": "extracts",
            "exintro": 1,
            "explaintext": 1,
        },
        headers=HEADERS,
        timeout=10,
    ).json()
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return "No results found."
    results = []
    for page in pages.values():
        results.append(f"{page['title']}: {page.get('extract', '')[:500]}")
    return "\n\n".join(results)


LEGACY_TOOL_FUNCTIONS = {
    "get_current_time": get_current_time,
    "save_note": save_note,
    "read_notes": read_notes,
    "get_weather": get_weather,
    "search_wikipedia": search_wikipedia,
}
LEGACY_TOOLS = [
    {"type": "function", "function": {
        "name": "get_current_time",
        "description": "Get the current date and time.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "save_note",
        "description": "Save a short note for the user to a file.",
        "parameters": {
            "type": "object",
            "properties": {"text": {"type": "string", "description": "The note text"}},
            "required": ["text"],
        },
    }},
    {"type": "function", "function": {
        "name": "read_notes",
        "description": "Read all notes the user has saved before.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "City name, e.g. Chennai"}},
            "required": ["city"],
        },
    }},
    {"type": "function", "function": {
        "name": "search_wikipedia",
        "description": "Look up facts about a person, place, concept, or event on Wikipedia.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "What to look up"}},
            "required": ["query"],
        },
    }},
]
TOOL_FUNCTIONS = LEGACY_TOOL_FUNCTIONS.copy()


def build_tool_functions(index, llm, notes_file=DEFAULT_NOTES_FILE):
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
        user = "Write " + str(num_questions) + " questions on: " + topic + "\n\nStudy material:\n" + format_hits(hits)
        return llm(QUIZ_SYSTEM, user)

    def summarize_topic(topic):
        hits = index.search(topic, k=6)
        if not hits:
            return NO_NOTES
        user = "Revision sheet for: " + topic + "\n\nStudy material:\n" + format_hits(hits)
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
            "Days until exam: " + str(days) + "\nHours per day: " + str(hours)
            + "\nToday: " + get_current_time()[:10]
            + ("\nFocus on: " + focus if focus else "")
            + "\n\nMaterial samples:\n" + format_hits(pieces)
        )
        return llm(PLAN_SYSTEM, user)

    def save_note_study(text):
        with open(notes_file, "a", encoding="utf-8") as f:
            f.write("[" + get_current_time() + "] " + text + "\n")
        return "Note saved."

    def read_notes_study():
        if not notes_file.exists():
            return "No saved notes yet."
        return notes_file.read_text(encoding="utf-8")

    return {
        "get_current_time": get_current_time,
        "search_notes": search_notes,
        "make_quiz": make_quiz,
        "summarize_topic": summarize_topic,
        "make_study_plan": make_study_plan,
        "save_note": save_note_study,
        "read_notes": read_notes_study,
    }


def _tool(name, description, properties=None, required=None):
    parameters = {"type": "object", "properties": properties or {}}
    if required:
        parameters["required"] = required
    return {
        "type": "function",
        "function": {"name": name, "description": description, "parameters": parameters},
    }


TOOLS = [
    _tool("get_current_time", "Get the current date and time."),
    _tool(
        "search_notes",
        "Find the parts of the uploaded study notes that answer a question. Use this first "
        "for any question about the syllabus or notes. Returns text with [file p.N] labels.",
        {"query": {"type": "string", "description": "The question or topic to look for"}},
        ["query"],
    ),
    _tool(
        "make_quiz",
        "Create multiple-choice practice questions from the uploaded notes on a topic.",
        {
            "topic": {"type": "string", "description": "Topic to be tested on"},
            "num_questions": {"type": "integer", "description": "How many questions, 1 to 10"},
        },
        ["topic"],
    ),
    _tool(
        "summarize_topic",
        "Create a short revision sheet (key points and terms) for a topic from the uploaded notes.",
        {"topic": {"type": "string", "description": "Topic or chapter to summarize"}},
        ["topic"],
    ),
    _tool(
        "make_study_plan",
        "Build a day-by-day revision plan from the uploaded notes before an exam.",
        {
            "days": {"type": "integer", "description": "Days left until the exam"},
            "hours_per_day": {"type": "number", "description": "Study hours available per day"},
            "focus": {"type": "string", "description": "Optional topic to focus on"},
        },
        ["days"],
    ),
    _tool(
        "save_note",
        "Save a short personal revision note, such as a formula or a reminder.",
        {"text": {"type": "string", "description": "The note text"}},
        ["text"],
    ),
    _tool("read_notes", "Read all personal revision notes the student saved before."),
]
