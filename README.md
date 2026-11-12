# StudyPilot 📚

An AI study assistant for college students. Upload your notes (PDF, TXT or MD), then ask questions, get practice quizzes, revision sheets and a day-by-day study plan. Every answer comes from your own notes and shows its source, such as `[notes.pdf p.3]`.

**Live demo:** add your Streamlit link here

## How it works

1. **RAG (retrieval):** your notes are split into small overlapping pieces and stored in ChromaDB. For each question, the most relevant pieces are found and given to the LLM, so it answers from your notes instead of guessing.
2. **Agent with tools:** the LLM decides which tool to use, my code runs it, and the result goes back to the LLM. This repeats (at most 5 steps) until it can answer.
3. **Tools:** `search_notes`, `make_quiz`, `summarize_topic`, `make_study_plan`, `save_note`, `read_notes`, `get_current_time`.

## Tech stack

Python, Groq or OpenAI API (function calling), ChromaDB, pypdf, Streamlit, pytest

## Run it

```
git clone https://github.com/princy21aj/studypilot-agent
cd studypilot-agent
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements.txt
copy .env.example .env
```

Add your Groq key to `.env` (never commit it), then:

```
python -m streamlit run streamlit_app.py
python -m pytest
```

Use Python 3.11 or 3.12. ChromaDB downloads a small embedding model the first time you ask a question.

## Safety and limits

- Each visitor gets a private in-memory index and notes file.
- 20 messages per session, 10 MB per file, scanned (image-only) PDFs are not supported.
- If the notes do not contain the answer, the assistant says so.

## Next steps

Evaluate answer quality on real subjects, add OCR for scanned PDFs, and expose the tools as an MCP server.
