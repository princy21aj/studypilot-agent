import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from './api.js';
import Landscape from './Landscape.jsx';

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
const DAY_COLORS = ['#e1eee1', '#f5e1d8', '#d8ede3', '#f5e9d1', '#dcebea'];

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#eaa092', '#a7cdb5', '#d8ede3', '#b6d9d3', '#f1d7ae', '#e8c879'];
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

function Ring({ value, size = 90, color = '#4d9276', children }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e4ebe2" strokeWidth="12" />
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
        role="button"
        tabIndex={0}
        aria-label="Choose notes to upload"
        onClick={() => input.current.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.current.click();
          }
        }}
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
        {busy && <div className="bubble bot typing" role="status" aria-label="StudyPilot is thinking"><i /><i /><i /></div>}
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
function QuizTab({ hasNotes, quiz, setQuiz, busy, onMake, onComplete }) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  if (!hasNotes) return <NeedNotes />;
  const questions = quiz?.questions;
  const score = quiz?.done ? questions.filter((q, i) => quiz.answers[i] === q.answer).length : 0;
  const check = () => {
    setQuiz({ ...quiz, done: true });
    const s = questions.filter((q, i) => quiz.answers[i] === q.answer).length;
    if (s / questions.length >= 0.8) confetti();
    onComplete(s, questions.length);
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
                aria-pressed={quiz.answers[i] === n}
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
          <Ring value={score / questions.length} color={score / questions.length >= 0.8 ? '#4d9276' : '#dc7266'}>
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
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) || e.target.isContentEditable) return;
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
            <Ring value={deck.known.length / total} size={64} color="#4d9276">{deck.known.length}/{total}</Ring>
            <span className="muted">Card {deck.i + 1} of {total} · tap the card, or use ← → and space</span>
          </div>
          <div className="scene">
            <div
              className={'flip' + (deck.flipped ? ' flipped' : '')}
              role="button"
              tabIndex={0}
              aria-label="Flashcard. Press Enter or Space to flip."
              aria-pressed={deck.flipped}
              onClick={flip}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  flip();
                }
              }}
            >
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
            <Ring value={total ? done / total : 0} color="#4d9276">{Math.round((total ? done / total : 0) * 100)}%</Ring>
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

const FEATURE_CARDS = [
  ['upload', 'Upload Notes', 'PDF, TXT & MD files', '↥'],
  ['chat', 'Ask Questions', 'Get AI-powered answers', '✧'],
  ['quiz', 'Take Quizzes', 'Test your knowledge', '▤'],
  ['cards', 'Create Flashcards', 'Learn anywhere', '▱'],
  ['plan', 'Plan Your Study', 'Stay on track', '◷'],
];

function Dashboard({ session, files, busyFiles, activity, quiz, plan, deck, onFeature }) {
  const taskTotal = plan ? plan.days.reduce((total, day) => total + day.tasks.length, 0) : 0;
  const taskDone = plan ? Object.values(plan.done).filter(Boolean).length : 0;
  const knownCards = deck?.known.length || 0;
  const totalCards = deck?.items.length || 0;
  const quizScore = quiz?.done && quiz.questions.length
    ? Math.round((quiz.questions.filter((question, index) => quiz.answers[index] === question.answer).length / quiz.questions.length) * 100)
    : null;

  return (
    <section className="dashboard-section" id="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-inner">
        <div className="dashboard-heading">
          <div>
            <span className="section-kicker">YOUR LEARNING, AT A GLANCE</span>
            <h2 id="dashboard-title">Your study <em>dashboard.</em></h2>
            <p>A little progress, made visible. Everything here reflects this study session.</p>
          </div>
          <span className="session-badge"><i /> Session active</span>
        </div>

        <div className="dashboard-stats">
          <article className="stat-card">
            <span className="stat-icon">▤</span>
            <span className="stat-label">Notes in your library</span>
            <strong>{files.length}</strong>
            <small>{files.length === 1 ? 'document ready to explore' : 'documents ready to explore'}</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">✧</span>
            <span className="stat-label">AI actions this session</span>
            <strong>{session.used}<small> / {session.max}</small></strong>
            <small>Questions, quizzes, cards and plans</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">▱</span>
            <span className="stat-label">Flashcards learned</span>
            <strong>{totalCards ? `${knownCards} / ${totalCards}` : '—'}</strong>
            <small>{totalCards ? 'marked “Got it” in your deck' : 'Create a deck to begin'}</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">◎</span>
            <span className="stat-label">Latest quiz score</span>
            <strong>{quizScore === null ? '—' : `${quizScore}%`}</strong>
            <small>{quizScore === null ? 'Complete a quiz to see your score' : 'Based on your latest quiz'}</small>
          </article>
        </div>

        <div className="dashboard-columns">
          <article className="dash-panel study-progress">
            <div className="dash-panel-heading">
              <div><span className="section-kicker">KEEP YOUR MOMENTUM</span><h3>Study progress</h3></div>
              {taskTotal > 0 && <span className="progress-percent">{Math.round((taskDone / taskTotal) * 100)}%</span>}
            </div>
            {plan ? (
              <>
                <div className="dashboard-progress-track" role="progressbar" aria-label="Study plan tasks completed"
                  aria-valuemin="0" aria-valuemax={taskTotal} aria-valuenow={taskDone}>
                  <span style={{ width: `${taskTotal ? (taskDone / taskTotal) * 100 : 0}%` }} />
                </div>
                <p className="dash-support">{taskDone} of {taskTotal} planned tasks complete</p>
                <button className="dashboard-link" onClick={() => onFeature('plan')}>Continue your plan <span aria-hidden="true">→</span></button>
              </>
            ) : (
              <div className="dashboard-empty">
                <span aria-hidden="true">✦</span>
                <p>Your progress starts with a plan made for your notes.</p>
                <button className="dashboard-link" onClick={() => onFeature('plan')}>Build a study plan <span aria-hidden="true">→</span></button>
              </div>
            )}
          </article>

          <article className="dash-panel documents-panel">
            <div className="dash-panel-heading">
              <div><span className="section-kicker">YOUR MATERIALS</span><h3>Notes & documents</h3></div>
              <button className="dashboard-link" onClick={() => onFeature('upload')}>Add notes <span aria-hidden="true">+</span></button>
            </div>
            {files.length || busyFiles.length ? (
              <ul className="document-list">
                {busyFiles.map((name, index) => (
                  <li className="document-item uploading" key={`busy-${name}-${index}`}>
                    <span className="document-type" aria-hidden="true">…</span><span className="document-name">{name}</span><span className="document-status">Uploading</span>
                  </li>
                ))}
                {files.map((name) => (
                  <li className="document-item" key={name}>
                    <span className="document-type" aria-hidden="true">{name.split('.').pop().toUpperCase().slice(0, 3)}</span>
                    <span className="document-name">{name}</span><span className="document-status">Ready</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dashboard-empty documents-empty">
                <span aria-hidden="true">▤</span>
                <p>Your uploaded notes will appear here.</p>
                <button className="dashboard-link" onClick={() => onFeature('upload')}>Upload a document <span aria-hidden="true">→</span></button>
              </div>
            )}
          </article>
        </div>

        <div className="dashboard-bottom">
          <section className="quick-actions" aria-labelledby="quick-actions-title">
            <div className="dash-panel-heading">
              <div><span className="section-kicker">PICK UP A TOOL</span><h3 id="quick-actions-title">Quick actions</h3></div>
            </div>
            <div className="quick-action-grid">
              {FEATURE_CARDS.slice(1).map(([id, title, caption, icon]) => (
                <button key={id} className="quick-action" onClick={() => onFeature(id)}>
                  <span className="quick-action-icon">{icon}</span><span><b>{title}</b><small>{caption}</small></span><span className="quick-action-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </section>

          <section className="recent-activity dash-panel" aria-labelledby="recent-activity-title">
            <div className="dash-panel-heading">
              <div><span className="section-kicker">RECENT IN THIS SESSION</span><h3 id="recent-activity-title">Recent activity</h3></div>
            </div>
            {activity.length ? (
              <ol className="activity-list">
                {activity.map((item) => (
                  <li className="activity-item" key={item.id}>
                    <span className="activity-dot" aria-hidden="true" />
                    <span className="activity-copy"><b>{item.title}</b><small>{item.detail}</small></span>
                    <time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="dashboard-empty activity-empty">
                <span aria-hidden="true">◷</span>
                <p>Your completed study actions will show up here.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

function Reveal({ children, className = '' }) {
  const element = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      element.current?.classList.add('is-visible');
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={element} className={'reveal ' + className}>{children}</div>;
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
  const [heroQuestion, setHeroQuestion] = useState('');
  const [activity, setActivity] = useState([]);
  const [theme, setTheme] = useState('light');
  const activityCounter = useRef(0);

  const recordActivity = (title, detail) => {
    const id = ++activityCounter.current;
    setActivity((items) => [{ id, title, detail, at: Date.now() }, ...items].slice(0, 5));
  };

  const start = useCallback(async () => {
    setStartError('');
    try {
      const data = await api.createSession();
      setSession({ id: data.session_id, used: data.used, max: data.max });
      setFiles([]); setMessages([]); setQuiz(null); setDeck(null); setPlan(null);
      setActivity([]);
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
        recordActivity('Notes uploaded', file.name);
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
    if (data) {
      setMessages((m) => [...m, { role: 'bot', text: data.answer, steps: data.steps }]);
      recordActivity('Question answered', text);
    }
  };
  const makeQuiz = async (topic, count) => {
    const data = await guard('quiz', () => api.quiz(session.id, topic, count));
    if (data) {
      setQuiz({ questions: data.questions, answers: {}, done: false });
      recordActivity('Quiz created', topic);
    }
  };
  const makeCards = async (topic, count) => {
    const data = await guard('cards', () => api.cards(session.id, topic, count));
    if (data) {
      setDeck({ items: data.cards, i: 0, flipped: false, known: [] });
      recordActivity('Flashcards created', `${data.cards.length} cards · ${topic}`);
    }
  };
  const makePlan = async (days, hours, focus) => {
    const data = await guard('plan', () => api.plan(session.id, days, hours, focus));
    if (data) {
      setPlan({ days: data.days, done: {} });
      recordActivity('Study plan created', `${data.days.length} days${focus ? ` · ${focus}` : ''}`);
    }
  };
  const recordQuizScore = (score, total) => recordActivity('Quiz completed', `${score} of ${total} correct`);

  const selectFeature = (feature) => {
    if (feature === 'upload') {
      scrollTo('notes');
      return;
    }
    setTab(feature);
    scrollTo('workspace');
  };

  const askFromHero = (event) => {
    event.preventDefault();
    const question = heroQuestion.trim();
    if (!question) return;
    if (!files.length) {
      setToast('Upload your notes first, then ask StudyPilot anything about them.');
      scrollTo('notes');
      return;
    }
    setTab('chat');
    setHeroQuestion('');
    send(question);
    scrollTo('workspace');
  };

  if (!session) {
    return (
      <>
        <div className="loading-screen">
          <div>
            <span className="big">📚</span>
            <h2>{startError ? 'Could not start StudyPilot' : 'Waking up StudyPilot...'}</h2>
            <p className="muted">{startError || 'The free server can take up to a minute to wake up.'}</p>
            {startError && <button className="btn" onClick={start}>Try again</button>}
            {!startError && <div className="loading-skeleton" aria-hidden="true"><i /><i /><i /></div>}
          </div>
        </div>
      </>
    );
  }

  const hasNotes = files.length > 0;
  return (
    <>
      <div className="app" data-theme={theme}>
        <section className="hero" id="home">
          <Landscape />
          <div className="hero-shade" />
          <header className="site-header">
            <a className="brand" href="#home" aria-label="StudyPilot AI home">
              <span className="brand-mark" aria-hidden="true">✦</span>
              <span>StudyPilot <b>AI</b></span>
            </a>
            <nav className="site-nav" aria-label="Main navigation">
              <a className="current" href="#home">Home</a>
              <a href="#features">Features</a>
              <a href="#dashboard">Dashboard</a>
              <a href="#about">About</a>
              <a href="#workspace">Learn</a>
              <a href="#contact">Contact</a>
            </nav>
            <button className="theme-toggle" type="button" aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>
              <span aria-hidden="true">{theme === 'dark' ? '☼' : '◐'}</span>
            </button>
            <a className="header-cta" href="#workspace">Open my study space <span aria-hidden="true">↗</span></a>
          </header>
          <div className="hero-content">
            <span className="eyebrow"><span aria-hidden="true">✧</span> YOUR NOTES, A WHOLE NEW WORLD</span>
            <h1>Welcome to<br /><span>StudyPilot AI</span></h1>
            <p className="hero-tagline">Study Smarter. Learn Faster. Achieve More.</p>
            <form className="hero-search" onSubmit={askFromHero}>
              <span className="search-icon" aria-hidden="true">⌕</span>
              <label className="sr-only" htmlFor="hero-question">Ask anything from your notes</label>
              <input
                id="hero-question"
                value={heroQuestion}
                onChange={(event) => setHeroQuestion(event.target.value)}
                placeholder="Ask anything from your notes..."
                maxLength={2000}
              />
              <button type="submit">Go <span aria-hidden="true">→</span></button>
            </form>
            {!hasNotes && <p className="hero-hint">Start by adding your notes to unlock your AI study companion.</p>}
          </div>
          <div className="hero-features" aria-label="Study tools">
            {FEATURE_CARDS.map(([id, title, caption, icon]) => (
              <button key={id} className="hero-feature" onClick={() => selectFeature(id)}>
                <span className="feature-icon">{icon}</span>
                <span className="feature-title">{title}</span>
                <span className="feature-caption">{caption}</span>
              </button>
            ))}
          </div>
          <a className="scroll-cue" href="#features"><span aria-hidden="true">↓</span> Scroll to explore</a>
        </section>

        <Dashboard
          session={session}
          files={files}
          busyFiles={busyFiles}
          activity={activity}
          quiz={quiz}
          plan={plan}
          deck={deck}
          onFeature={selectFeature}
        />

        <section className="feature-section section-wrap" id="features">
          <Reveal>
            <div className="section-heading">
              <span className="section-kicker">A LITTLE MAGIC. A LOT OF MOMENTUM.</span>
              <h2>Everything you need to <em>find your flow.</em></h2>
              <p>Turn the notes you already have into a study routine that feels clear, calm, and entirely yours.</p>
            </div>
            <div className="feature-grid">
              {FEATURE_CARDS.map(([id, title, caption, icon], index) => (
                <button key={id} className="feature-card" onClick={() => selectFeature(id)}>
                  <span className="feature-number">0{index + 1}</span>
                  <span className="feature-icon">{icon}</span>
                  <h3>{title}</h3>
                  <p>{caption}</p>
                  <span className="feature-link">Explore tool <span aria-hidden="true">↗</span></span>
                </button>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="about-section" id="about">
          <Reveal className="about-inner">
            <div className="about-art" aria-hidden="true">
              <span className="orbit orbit-one" /><span className="orbit orbit-two" />
              <span className="about-book">✧</span>
              <span className="about-spark spark-one">✦</span><span className="about-spark spark-two">✧</span>
            </div>
            <div className="about-copy">
              <span className="section-kicker">YOUR LEARNING, REIMAGINED</span>
              <h2>Make room for the <em>aha moments.</em></h2>
              <p>StudyPilot turns your own course materials into thoughtful answers, focused practice, and a plan you can actually follow. One set of notes, four ways to make it stick.</p>
              <p className="about-note">Your notes stay private to your current study session.</p>
              <a className="text-link" href="#workspace">Step into your workspace <span aria-hidden="true">→</span></a>
            </div>
          </Reveal>
        </section>

        <section className="how-section section-wrap">
          <Reveal>
            <div className="section-heading">
              <span className="section-kicker">A CLEAR PATH THROUGH THE CLOUDS</span>
              <h2>From notes to <em>know-how.</em></h2>
            </div>
            <div className="steps-grid">
              <article className="step-card"><span>01</span><h3>Bring your notes</h3><p>Upload your PDFs, text, or Markdown files into a private study session.</p></article>
              <article className="step-card"><span>02</span><h3>Choose your path</h3><p>Ask a question, make a quiz, build flashcards, or map out your study time.</p></article>
              <article className="step-card"><span>03</span><h3>Keep your momentum</h3><p>Practice at your pace and track the little wins as you work through your plan.</p></article>
            </div>
          </Reveal>
        </section>

        <section className="tools-section" aria-labelledby="tools-heading">
          <Reveal className="tools-inner">
            <div>
              <span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span>
              <h2 id="tools-heading">Your study tools,<br /><em>all in one place.</em></h2>
              <p>Upload your notes. Chat, take quizzes, flip flashcards and tick off your study plan.</p>
            </div>
            <div className="tool-list">
              {FEATURE_CARDS.slice(1).map(([id, title, caption, icon]) => (
                <button key={id} className="tool-row" onClick={() => selectFeature(id)}>
                  <span className="tool-icon">{icon}</span><span><b>{title}</b><small>{caption}</small></span><span className="tool-arrow">→</span>
                </button>
              ))}
              <button className="tool-row" onClick={() => selectFeature('upload')}>
                <span className="tool-icon">{FEATURE_CARDS[0][3]}</span><span><b>{FEATURE_CARDS[0][1]}</b><small>{FEATURE_CARDS[0][2]}</small></span><span className="tool-arrow">→</span>
              </button>
            </div>
          </Reveal>
        </section>

        <section className="workspace-section" id="workspace">
          <div className="workspace-inner">
            <div className="workspace-heading">
              <div><span className="section-kicker">YOUR QUIET CORNER TO LEARN</span><h2>Welcome to your <em>study space.</em></h2></div>
              <span className="session-badge"><i /> Private session</span>
            </div>
            <div className="layout">
              <div id="notes">
                <UploadPanel session={session} files={files} busyFiles={busyFiles} onUpload={upload} onReset={reset} />
              </div>
              <main>
                <nav className="tabs" aria-label="Study tools">
                  {TABS.map(([id, label]) => (
                    <button key={id} className={'tab' + (tab === id ? ' active' : '')} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
                  ))}
                </nav>
                {tab === 'chat' && <ChatTab hasNotes={hasNotes} messages={messages} busy={busy === 'chat'} onSend={send} />}
                {tab === 'quiz' && <QuizTab hasNotes={hasNotes} quiz={quiz} setQuiz={setQuiz} busy={busy === 'quiz'} onMake={makeQuiz} onComplete={recordQuizScore} />}
                {tab === 'cards' && <CardsTab hasNotes={hasNotes} deck={deck} setDeck={setDeck} busy={busy === 'cards'} onMake={makeCards} active={tab === 'cards'} />}
                {tab === 'plan' && <PlanTab hasNotes={hasNotes} plan={plan} setPlan={setPlan} busy={busy === 'plan'} onMake={makePlan} />}
              </main>
            </div>
          </div>
        </section>

        <footer className="site-footer" id="contact">
          <a className="brand" href="#home"><span className="brand-mark" aria-hidden="true">✦</span><span>StudyPilot <b>AI</b></span></a>
          <p>May your next big idea be just one question away.</p>
          <a href="#home">Back to the beginning ↑</a>
        </footer>
      </div>
      {toast && <div className="toast" role="status" aria-live="polite"><span>{toast}</span><button aria-label="Dismiss message" onClick={() => setToast('')}>×</button></div>}
    </>
  );
}
