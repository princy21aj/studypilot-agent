// All calls to the StudyPilot backend live here.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request(path, { method = 'POST', sessionId, json, form } = {}) {
  const headers = {};
  if (sessionId) headers['X-Session-Id'] = sessionId;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  let response;
  try {
    response = await fetch(BASE + path, { method, headers, body });
  } catch {
    throw new Error('Cannot reach the server. It may be waking up, so wait a few seconds and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? 'Please check your input.' : data.detail;
    const error = new Error(detail || 'Something went wrong.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  createSession: () => request('/api/session'),
  endSession: (id) => request('/api/session', { method: 'DELETE', sessionId: id }),
  upload: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/upload', { sessionId: id, form });
  },
  chat: (id, message) => request('/api/chat', { sessionId: id, json: { message } }),
  quiz: (id, topic, num_questions) => request('/api/quiz', { sessionId: id, json: { topic, num_questions } }),
  cards: (id, topic, num_cards) => request('/api/cards', { sessionId: id, json: { topic, num_cards } }),
  plan: (id, days, hours_per_day, focus) =>
    request('/api/plan', { sessionId: id, json: { days, hours_per_day, focus } }),
};
