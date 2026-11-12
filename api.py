# StudyPilot backend (FastAPI). The React frontend talks to these endpoints.
import os
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import agent.config as config
from agent.loop import make_llm, run_agent
from agent.rag import SUPPORTED, NotesIndex
from agent.study import make_cards_data, make_plan_data, make_quiz_data

MAX_ACTIONS = 30          # AI calls per visitor (chat, quiz, cards, plan)
MAX_FILE_MB = 10
MAX_SESSIONS = 50         # the free server has little memory
SESSION_TTL = 2 * 60 * 60  # seconds a visitor can stay idle

index_factory = NotesIndex   # a variable, so tests can swap in a fake
SESSIONS = {}


class Session:
    def __init__(self):
        self.index = index_factory()
        self.history = []
        self.notes_file = Path(tempfile.gettempdir()) / ('studypilot_' + uuid.uuid4().hex + '.txt')
        self.count = 0
        self.last_seen = time.time()


def drop_session(session_id):
    session = SESSIONS.pop(session_id, None)
    if session and session.notes_file.exists():
        session.notes_file.unlink()


def cleanup():
    now = time.time()
    for session_id in [k for k, s in SESSIONS.items() if now - s.last_seen > SESSION_TTL]:
        drop_session(session_id)
    while len(SESSIONS) >= MAX_SESSIONS:   # make room by removing the least recently used visitor
        oldest = min(SESSIONS, key=lambda k: SESSIONS[k].last_seen)
        drop_session(oldest)


def get_session(x_session_id: str = Header(default='')):
    session = SESSIONS.get(x_session_id)
    if session is None:
        raise HTTPException(404, 'Session expired. Please start over.')
    session.last_seen = time.time()
    return session


def run_ai(session, work):
    # Counts one action, runs the work, and turns problems into clear messages
    if session.count >= MAX_ACTIONS:
        raise HTTPException(429, 'You used all ' + str(MAX_ACTIONS) + ' actions for this session. Click Start over.')
    session.count += 1
    try:
        return work()
    except HTTPException:
        session.count -= 1
        raise
    except ValueError as error:
        session.count -= 1
        raise HTTPException(400, str(error))
    except Exception as error:
        session.count -= 1
        print('AI error:', error)   # details stay in the server logs
        raise HTTPException(500, 'Sorry, something went wrong. Please try again.')


def llm():
    client, model = config.create_client()
    return make_llm(client, model)


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class QuizBody(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    num_questions: int = Field(default=5, ge=1, le=10)


class CardsBody(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    num_cards: int = Field(default=8, ge=1, le=15)


class PlanBody(BaseModel):
    days: int = Field(default=5, ge=1, le=14)
    hours_per_day: float = Field(default=2, ge=0.5, le=12)
    focus: str = Field(default='', max_length=200)


app = FastAPI(title='StudyPilot API')
origins = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', '*').split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_methods=['*'], allow_headers=['*'],
)


def status(session):
    return {'files': session.index.files, 'used': session.count, 'max': MAX_ACTIONS}


@app.get('/api/health')
def health():
    return {'ok': True}


@app.post('/api/session')
def create_session():
    cleanup()
    session_id = uuid.uuid4().hex
    SESSIONS[session_id] = Session()
    return {'session_id': session_id, **status(SESSIONS[session_id])}


@app.get('/api/status')
def get_status(session: Session = Depends(get_session)):
    return status(session)


@app.delete('/api/session')
def end_session(x_session_id: str = Header(default='')):
    drop_session(x_session_id)
    return {'ok': True}


@app.post('/api/upload')
def upload(file: UploadFile = File(...), session: Session = Depends(get_session)):
    name = Path(file.filename or '').name
    if not name.lower().endswith(SUPPORTED):
        raise HTTPException(400, 'Please upload a PDF, TXT or MD file.')
    data = file.file.read(MAX_FILE_MB * 1024 * 1024 + 1)
    if len(data) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(400, name + ' is larger than ' + str(MAX_FILE_MB) + ' MB.')
    try:
        pieces = session.index.add_file(name, data)
    except ValueError as error:
        raise HTTPException(400, str(error))
    except Exception as error:
        print('Upload error:', error)
        raise HTTPException(400, 'Could not read ' + name + '. The file may be damaged.')
    return {'name': name, 'pieces': pieces, **status(session)}


@app.post('/api/chat')
def chat(body: ChatBody, session: Session = Depends(get_session)):
    def work():
        answer, steps = run_agent(body.message, session.index, session.history, session.notes_file)
        return answer, steps
    answer, steps = run_ai(session, work)
    steps = [{'tool': s['tool'], 'args': s['args'], 'result': s['result'][:1500]} for s in steps]
    return {'answer': answer, 'steps': steps, **status(session)}


@app.post('/api/quiz')
def quiz(body: QuizBody, session: Session = Depends(get_session)):
    questions = run_ai(session, lambda: make_quiz_data(session.index, llm(), body.topic.strip(), body.num_questions))
    return {'questions': questions, **status(session)}


@app.post('/api/cards')
def cards(body: CardsBody, session: Session = Depends(get_session)):
    result = run_ai(session, lambda: make_cards_data(session.index, llm(), body.topic.strip(), body.num_cards))
    return {'cards': result, **status(session)}


@app.post('/api/plan')
def plan(body: PlanBody, session: Session = Depends(get_session)):
    result = run_ai(session, lambda: make_plan_data(
        session.index, llm(), body.days, body.hours_per_day, body.focus.strip()))
    return {'days': result, **status(session)}
