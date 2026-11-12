---
title: StudyPilot API
emoji: 📚
sdk: docker
app_port: 7860
---

# StudyPilot 📚

An AI study assistant. Upload your notes (PDF, TXT or MD), then chat, take quizzes, flip flashcards and follow a study plan. Answers come from your own notes and show their source, such as `[notes.pdf p.3]`.

**Live app:** add your Netlify link here

## How it works

1. **RAG:** notes are split into overlapping pieces, stored in ChromaDB, and searched for each question, so the LLM answers from your notes instead of guessing.
2. **Agent with tools:** the LLM chooses a tool (`search_notes`, `make_quiz`, `summarize_topic`, `make_study_plan`, `save_note`, `read_notes`, `get_current_time`), my code runs it, and the result goes back to the LLM (max 5 steps).
3. **Structured study tools:** quiz, flashcards and plan are generated as JSON and validated, so the frontend can show them as interactive cards.

## Structure

```
api.py              FastAPI backend (sessions, upload, chat, quiz, cards, plan)
agent/              config, rag, toolkit, loop, study
frontend/           React + Vite app (pastel UI)
streamlit_app.py    first version of the UI (still works)
tests/              pytest tests for the backend
```

## Run it locally

Backend (Python 3.11 or 3.12):

```
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements-api.txt
copy .env.example .env      (add your GROQ_API_KEY)
python -m uvicorn api:app --reload --port 8000
```

Frontend (in a second terminal):

```
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

Tests: `python -m pytest` (backend) and `cd frontend && npm test` (frontend).

## Deploy

- **Backend:** Hugging Face Space (SDK: Docker). Add `GROQ_API_KEY` as a Space secret and `ALLOWED_ORIGINS` set to your Netlify URL.
- **Frontend:** Netlify, base directory `frontend`, environment variable `VITE_API_URL` set to the Space URL.

## Safety and limits

Each visitor gets a private in-memory index that is removed after 2 hours idle. Limits: 30 AI actions per session, 10 MB per file, 50 sessions at once. Scanned (image-only) PDFs are not supported.

## Next steps

Evaluate answers on real subjects, add OCR for scanned PDFs, and expose the tools as an MCP server.
