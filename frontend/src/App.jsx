import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from './api.js';

const TABS = [
  ['chat', '💬 Chat'],
  ['quiz', '📝 Quiz'],
  ['cards', '🃏 Flashcards'],
  ['plan', '🗓️ Study plan'],
];
const SUGGESTIONS = [
  'What are the most important topics in my notes?',
  'Explain the first unit in simple words',
  'Summarize one chapter as a revision sheet',
  'Explain a concept like I am new to it',
];
const DAY_COLORS = ['#ede9fe', '#fce7f3', '#d1fae5', '#ffedd5', '#e0f2fe'];

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f9a8d4', '#c4b5fd', '#a7f3d0', '#bae6fd', '#fed7aa', '#fde68a'];
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i');
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    piece.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}

function Ring({ value, size = 90, color = '#a78bfa', children }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ede9fe" strokeWidth="12" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(Math.max(value, 0), 1))}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{children}</div>
    </div>
  );
}

function NeedNotes() {
  return (
    <div className="panel empty view">
      <span className="big">📄</span>
      <h3>Upload your notes first</h3>
      <p className="muted">Drop a PDF, TXT or MD file in the box on the left, and this tab comes alive.</p>
    </div>
  );
}

/* ---------------- Upload panel ---------------- */
function UploadPanel({ session, files, onUpload, onReset, busyFiles }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const pick = (list) => list && list.length && onUpload(Array.from(list));
  return (
    <aside className="panel">
      <h3>📄 Your notes</h3>
      <div
        className={'drop' + (over ? ' over' : '')}
        onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
      >
        <span className="big">☁️</span>
        <b>Drop files here</b><br />
        <small>or tap to choose · PDF, TXT, MD · up to 10 MB</small>
        <input ref={input} type="file" multiple accept=".pdf,.txt,.md" hidden
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      </div>
      <div className="chips">
        {busyFiles.map((name) => <span key={name} className="chip busy">⏳ {name}</span>)}
        {files.map((name) => <span key={name} className="chip">✅ {name}</span>)}
      </div>
      <div className="meter"><div style={{ width: (session.used / session.max) * 100 + '%' }} /></div>
      <div className="muted">{session.used} / {session.max} AI actions used</div>
      <p className="muted">Your notes stay private to this session and vanish when you leave.</p>
      <button className="btn ghost small" onClick={onReset}>🧹 Start over</button>
    </aside>
  );
}

/* ---------------- Chat ---------------- */
function ChatTab({ hasNotes, messages, busy, onSend }) {
  const [text, setText] = useState('');
  const bottom = useRef(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <div className="panel view">
      <div className="chat-box">
        {messages.length === 0 && (
          <div className="empty">
            <span className="big">🧠</span>
            <h3>Ask anything about your notes</h3>
            <p className="muted">{hasNotes ? 'Try one of these:' : 'Upload your notes first, then ask away.'}</p>
            {hasNotes && (
              <div className="suggest">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => onSend(s)}>{s}</button>)}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'bubble ' + (m.role === 'user' ? 'user' : 'bot')}>
            {m.role === 'user' ? m.text : <ReactMarkdown>{m.text}</ReactMarkdown>}
            {m.steps && m.steps.length > 0 && (
              <>
                <div className="tools">{m.steps.map((s, j) => <span key={j} className="tool">🔧 {s.tool}</span>)}</div>
                {m.steps.filter((s) => s.tool === 'search_notes').map((s, j) => (
                  <details key={j} className="src">
                    <summary>Passages found in your notes</summary>
                    <pre>{s.result}</pre>
                  </details>
                ))}
              </>
            )}
          </div>
        ))}
        {busy && <div className="bubble bot typing"><i /><i /><i /></div>}
        <div ref={bottom} />
      </div>
      <form className="row" onSubmit={submit} style={{ marginTop: 12, marginBottom: 0 }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Ask StudyPilot something..." maxLength={2000} />
        <button className="btn" disabled={busy || !text.trim()}>Send ✨</button>
      </form>
    </div>
  );
}

/* ---------------- Quiz ---------------- */
function QuizTab({ hasNotes, quiz, setQuiz, busy, onMake }) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  if (!hasNotes) return <NeedNotes />;
  const questions = quiz?.questions;
  const score = quiz?.done ? questions.filter((q, i) => quiz.answers[i] === q.answer).length : 0;
  const check = () => {
    setQuiz({ ...quiz, done: true });
    const s = questions.filter((q, i) => quiz.answers[i] === q.answer).length;
    if (s / questions.length >= 0.8) confetti();
  };
  return (
    <div className="view">
      <div className="panel" style={{ marginBottom: 16 }}>
        <form className="row" style={{ marginBottom: 0 }}
          onSubmit={(e) => { e.preventDefault(); if (topic.trim() && !busy) onMake(topic.trim(), count); }}>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Quiz topic, for example: normalization" maxLength={200} />
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} questions</option>)}
          </select>
          <button className="btn" disabled={busy || !topic.trim()}>{busy ? 'Writing...' : 'Make quiz ✨'}</button>
        </form>
      </div>
      {questions && questions.map((q, i) => (
        <div className="q-card" key={i} style={{ animationDelay: i * 0.07 + 's' }}>
          <h4>{i + 1}. {q.question}</h4>
          {q.options.map((option, n) => {
            let state = quiz.answers[i] === n ? ' picked' : '';
            if (quiz.done && n === q.answer) state = ' right';
            else if (quiz.done && quiz.answers[i] === n) state = ' wrong';
            return (
              <button key={n} className={'opt' + state} disabled={quiz.done}
                onClick={() => setQuiz({ ...quiz, answers: { ...quiz.answers, [i]: n } })}>
                <span className="letter">{String.fromCharCode(65 + n)}</span>{option}
              </button>
            );
          })}
          {quiz.done && q.explanation && <div className="explain">💡 {q.explanation}</div>}
        </div>
      ))}
      {questions && !quiz.done && (
        <div style={{ textAlign: 'center' }}>
          <button className="btn mint" disabled={Object.keys(quiz.answers).length === 0} onClick={check}>
            Check my answers 🎯
          </button>
        </div>
      )}
      {questions && quiz.done && (
        <div className="score">
          <Ring value={score / questions.length} color={score / questions.length >= 0.8 ? '#34d399' : '#f472b6'}>
            {score}/{questions.length}
          </Ring>
          <div>
            <div className="ring-text">
              {score / questions.length >= 0.8 ? 'Amazing work! 🎉' : score / questions.length >= 0.5 ? 'Nice, keep going! 💪' : 'Good start, review and retry! 🌱'}
            </div>
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => setQuiz(null)}>New quiz</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Flashcards ---------------- */
function CardsTab({ hasNotes, deck, setDeck, busy, onMake, active }) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const total = deck?.items.length || 0;
  const go = useCallback((step) => setDeck((d) => d && ({ ...d, i: (d.i + step + d.items.length) % d.items.length, flipped: false })), [setDeck]);
  const flip = useCallback(() => setDeck((d) => d && ({ ...d, flipped: !d.flipped })), [setDeck]);
  const toggleKnown = () => {
    const known = deck.known.includes(deck.i) ? deck.known.filter((k) => k !== deck.i) : [...deck.known, deck.i];
    setDeck({ ...deck, known });
    if (known.length === total) confetti();
    else if (!deck.known.includes(deck.i)) go(1);
  };
  useEffect(() => {
    if (!active || !deck) return undefined;
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, deck, go, flip]);
  if (!hasNotes) return <NeedNotes />;
  const card = deck?.items[deck.i];
  return (
    <div className="view">
      <div className="panel" style={{ marginBottom: 16 }}>
        <form className="row" style={{ marginBottom: 0 }}
          onSubmit={(e) => { e.preventDefault(); if (topic.trim() && !busy) onMake(topic.trim(), count); }}>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Flashcard topic, for example: process scheduling" maxLength={200} />
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[6, 8, 10, 15].map((n) => <option key={n} value={n}>{n} cards</option>)}
          </select>
          <button className="btn" disabled={busy || !topic.trim()}>{busy ? 'Making...' : 'Make cards ✨'}</button>
        </form>
      </div>
      {card && (
        <div className="panel">
          <div className="progress-top" style={{ justifyContent: 'center' }}>
            <Ring value={deck.known.length / total} size={64} color="#34d399">{deck.known.length}/{total}</Ring>
            <span className="muted">Card {deck.i + 1} of {total} · tap the card, or use ← → and space</span>
          </div>
          <div className="scene">
            <div className={'flip' + (deck.flipped ? ' flipped' : '')} onClick={flip}>
              <div className="face front">
                {deck.known.includes(deck.i) && <span className="known-badge">✅</span>}
                {card.front}<small>tap to flip</small>
              </div>
              <div className="face back">{card.back}<small>tap to flip back</small></div>
            </div>
          </div>
          <div className="controls">
            <button className="btn ghost" onClick={() => go(-1)}>⬅️ Back</button>
            <button className="btn" onClick={flip}>🔄 Flip</button>
            <button className="btn mint" onClick={toggleKnown}>
              {deck.known.includes(deck.i) ? '↩️ Not yet' : '✅ Got it'}
            </button>
            <button className="btn ghost" onClick={() => go(1)}>Next ➡️</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Study plan ---------------- */
function PlanTab({ hasNotes, plan, setPlan, busy, onMake }) {
  const [days, setDays] = useState(5);
  const [hours, setHours] = useState(2);
  const [focus, setFocus] = useState('');
  const celebrated = useRef(false);
  const total = plan ? plan.days.reduce((n, d) => n + d.tasks.length, 0) : 0;
  const done = plan ? Object.values(plan.done).filter(Boolean).length : 0;
  useEffect(() => {
    if (total > 0 && done === total && !celebrated.current) { celebrated.current = true; confetti(); }
    if (done < total) celebrated.current = false;
  }, [done, total]);
  if (!hasNotes) return <NeedNotes />;
  return (
    <div className="view">
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="row">
          <div className="slider-box">
            <label><span>Days until exam</span><span>{days}</span></label>
            <input type="range" min="1" max="14" value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div className="slider-box">
            <label><span>Hours per day</span><span>{hours}</span></label>
            <input type="range" min="0.5" max="8" step="0.5" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>
        </div>
        <form className="row" style={{ marginBottom: 0 }}
          onSubmit={(e) => { e.preventDefault(); if (!busy) onMake(days, hours, focus.trim()); }}>
          <input className="input" value={focus} onChange={(e) => setFocus(e.target.value)}
            placeholder="Focus on (optional): a topic you find hard" maxLength={200} />
          <button className="btn" disabled={busy}>{busy ? 'Planning...' : 'Build my plan ✨'}</button>
        </form>
      </div>
      {plan && (
        <>
          <div className="panel progress-top">
            <Ring value={total ? done / total : 0} color="#34d399">{Math.round((total ? done / total : 0) * 100)}%</Ring>
            <div>
              <div className="ring-text">{done} of {total} tasks done</div>
              <div className="muted">{done === total ? 'Plan complete! Time to rest 🌸' : 'Tick tasks as you finish them'}</div>
            </div>
          </div>
          <div style={{ height: 14 }} />
          {plan.days.map((d, di) => (
            <div className="day" key={d.day} style={{ background: DAY_COLORS[di % DAY_COLORS.length], animationDelay: di * 0.07 + 's' }}>
              <h4>Day {d.day}: {d.title}</h4>
              {d.tasks.map((task, ti) => {
                const key = d.day + '_' + ti;
                return (
                  <label className="task" key={key}>
                    <input type="checkbox" checked={!!plan.done[key]}
                      onChange={(e) => setPlan({ ...plan, done: { ...plan.done, [key]: e.target.checked } })} />
                    <span className="box">✓</span>
                    <span className="t">{task}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [session, setSession] = useState(null);   // { id, used, max }
  const [startError, setStartError] = useState('');
  const [files, setFiles] = useState([]);
  const [busyFiles, setBusyFiles] = useState([]);
  const [tab, setTab] = useState('chat');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');           // which feature is working
  const [messages, setMessages] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [deck, setDeck] = useState(null);
  const [plan, setPlan] = useState(null);

  const start = useCallback(async () => {
    setStartError('');
    try {
      const data = await api.createSession();
      setSession({ id: data.session_id, used: data.used, max: data.max });
      setFiles([]); setMessages([]); setQuiz(null); setDeck(null); setPlan(null);
    } catch (error) {
      setStartError(error.message);
    }
  }, []);

  useEffect(() => { start(); }, [start]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const reset = async () => {
    if (session) api.endSession(session.id).catch(() => {});
    setSession(null);
    await start();
  };

  // Runs one backend call. Shows errors as a toast and restarts the session if it expired.
  const guard = async (name, work) => {
    setBusy(name);
    try {
      const data = await work();
      if (data && data.used !== undefined) setSession((s) => s && ({ ...s, used: data.used, max: data.max }));
      return data;
    } catch (error) {
      if (error.status === 404) {
        setToast('Your session expired, so I started a new one. Please upload your notes again.');
        await start();
      } else {
        setToast(error.message);
      }
      return null;
    } finally {
      setBusy('');
    }
  };

  const upload = async (list) => {
    for (const file of list) {
      setBusyFiles((b) => [...b, file.name]);
      try {
        const data = await api.upload(session.id, file);
        setFiles(data.files);
        setSession((s) => ({ ...s, used: data.used, max: data.max }));
      } catch (error) {
        if (error.status === 404) { setToast('Your session expired. Please try again.'); await start(); break; }
        setToast(error.message);
      } finally {
        setBusyFiles((b) => b.filter((n) => n !== file.name));
      }
    }
  };

  const send = async (text) => {
    setMessages((m) => [...m, { role: 'user', text }]);
    const data = await guard('chat', () => api.chat(session.id, text));
    if (data) setMessages((m) => [...m, { role: 'bot', text: data.answer, steps: data.steps }]);
  };
  const makeQuiz = async (topic, count) => {
    const data = await guard('quiz', () => api.quiz(session.id, topic, count));
    if (data) setQuiz({ questions: data.questions, answers: {}, done: false });
  };
  const makeCards = async (topic, count) => {
    const data = await guard('cards', () => api.cards(session.id, topic, count));
    if (data) setDeck({ items: data.cards, i: 0, flipped: false, known: [] });
  };
  const makePlan = async (days, hours, focus) => {
    const data = await guard('plan', () => api.plan(session.id, days, hours, focus));
    if (data) setPlan({ days: data.days, done: {} });
  };

  if (!session) {
    return (
      <>
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="loading-screen">
          <div>
            <span className="big">📚</span>
            <h2>{startError ? 'Could not start StudyPilot' : 'Waking up StudyPilot...'}</h2>
            <p className="muted">{startError || 'The free server can take up to a minute to wake up.'}</p>
            {startError && <button className="btn" onClick={start}>Try again</button>}
          </div>
        </div>
      </>
    );
  }

  const hasNotes = files.length > 0;
  return (
    <>
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="app">
        <header className="hero">
          <span className="logo">📚</span>
          <div>
            <h1>StudyPilot</h1>
            <p>Upload your notes. Chat, take quizzes, flip flashcards and tick off your study plan.</p>
          </div>
        </header>
        <div className="layout">
          <UploadPanel session={session} files={files} busyFiles={busyFiles} onUpload={upload} onReset={reset} />
          <main>
            <nav className="tabs">
              {TABS.map(([id, label]) => (
                <button key={id} className={'tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>{label}</button>
              ))}
            </nav>
            {tab === 'chat' && <ChatTab hasNotes={hasNotes} messages={messages} busy={busy === 'chat'} onSend={send} />}
            {tab === 'quiz' && <QuizTab hasNotes={hasNotes} quiz={quiz} setQuiz={setQuiz} busy={busy === 'quiz'} onMake={makeQuiz} />}
            {tab === 'cards' && <CardsTab hasNotes={hasNotes} deck={deck} setDeck={setDeck} busy={busy === 'cards'} onMake={makeCards} active={tab === 'cards'} />}
            {tab === 'plan' && <PlanTab hasNotes={hasNotes} plan={plan} setPlan={setPlan} busy={busy === 'plan'} onMake={makePlan} />}
          </main>
        </div>
      </div>
      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
    </>
  );
}
