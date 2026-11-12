import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

let files;
let used;

function reply(data, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) });
}

beforeEach(() => {
  files = [];
  used = 0;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = window.matchMedia || (() => ({ matches: true }));
  globalThis.fetch = vi.fn((url, options) => {
    const path = url.replace('http://localhost:8000', '');
    if (path === '/api/session' && options.method === 'POST') return reply({ session_id: 's1', files, used, max: 30 });
    if (path === '/api/upload') { files = ['dbms.txt']; return reply({ name: 'dbms.txt', pieces: 1, files, used, max: 30 }); }
    if (path === '/api/quiz') {
      used += 1;
      return reply({ used, max: 30, questions: [{ question: 'What removes redundancy?', options: ['Normalization', 'Indexing', 'Joins', 'Views'], answer: 0, explanation: 'Normal forms.' }] });
    }
    if (path === '/api/cards') {
      used += 1;
      return reply({ used, max: 30, cards: [{ front: 'What is 1NF?', back: 'Atomic values' }, { front: 'What is 2NF?', back: 'No partial dependency' }] });
    }
    if (path === '/api/plan') {
      used += 1;
      return reply({ used, max: 30, days: [{ day: 1, title: 'Basics', tasks: ['Read unit 1', 'Do 5 questions'] }] });
    }
    if (path === '/api/chat') {
      used += 1;
      return reply({ used, max: 30, answer: 'Normalization removes **redundancy**.', steps: [{ tool: 'search_notes', args: {}, result: '[dbms.txt p.1] text' }] });
    }
    return reply({ detail: 'Not found' }, 404);
  });
});

afterEach(() => vi.restoreAllMocks());

async function uploadNotes() {
  const input = document.querySelector('input[type=file]');
  fireEvent.change(input, { target: { files: [new File(['notes'], 'dbms.txt', { type: 'text/plain' })] } });
  await screen.findByText(/dbms.txt/);
}

test('shows the app after the session starts', async () => {
  render(<App />);
  expect(await screen.findByText('Upload your notes. Chat, take quizzes, flip flashcards and tick off your study plan.')).toBeTruthy();
});

test('tabs ask for notes before upload', async () => {
  render(<App />);
  fireEvent.click(await screen.findByText('📝 Quiz'));
  expect(await screen.findByText('Upload your notes first')).toBeTruthy();
});

test('chat answers and shows the tool used', async () => {
  render(<App />);
  await screen.findByText('StudyPilot');
  await uploadNotes();
  fireEvent.change(screen.getByPlaceholderText('Ask StudyPilot something...'), { target: { value: 'What is normalization?' } });
  fireEvent.click(screen.getByText('Send ✨'));
  expect(await screen.findByText('redundancy')).toBeTruthy();
  expect(await screen.findByText('🔧 search_notes')).toBeTruthy();
});

test('quiz: pick, check, see score', async () => {
  render(<App />);
  await screen.findByText('StudyPilot');
  await uploadNotes();
  fireEvent.click(screen.getByText('📝 Quiz'));
  fireEvent.change(screen.getByPlaceholderText(/Quiz topic/), { target: { value: 'normalization' } });
  fireEvent.click(screen.getByText('Make quiz ✨'));
  fireEvent.click(await screen.findByText('Normalization'));
  fireEvent.click(screen.getByText('Check my answers 🎯'));
  expect(await screen.findByText('Amazing work! 🎉')).toBeTruthy();
  expect(screen.getByText('💡 Normal forms.')).toBeTruthy();
});

test('flashcards: flip and next', async () => {
  render(<App />);
  await screen.findByText('StudyPilot');
  await uploadNotes();
  fireEvent.click(screen.getByText('🃏 Flashcards'));
  fireEvent.change(screen.getByPlaceholderText(/Flashcard topic/), { target: { value: 'normal forms' } });
  fireEvent.click(screen.getByText('Make cards ✨'));
  await screen.findByText(/Card 1 of 2/);
  fireEvent.click(screen.getByText('Next ➡️'));
  await screen.findByText(/Card 2 of 2/);
  fireEvent.click(screen.getByText('✅ Got it'));
  await screen.findByText(/Card 1 of 2/);
});

test('plan: tick tasks updates progress', async () => {
  render(<App />);
  await screen.findByText('StudyPilot');
  await uploadNotes();
  fireEvent.click(screen.getByText('🗓️ Study plan'));
  fireEvent.click(screen.getByText('Build my plan ✨'));
  fireEvent.click(await screen.findByText('Read unit 1'));
  await waitFor(() => expect(screen.getByText('1 of 2 tasks done')).toBeTruthy());
});

test('a backend error shows a friendly message', async () => {
  render(<App />);
  await screen.findByText('StudyPilot');
  globalThis.fetch = vi.fn(() => reply({ detail: 'Please upload a file first.' }, 400));
  await uploadNotesIgnoringResult();
});

async function uploadNotesIgnoringResult() {
  const input = document.querySelector('input[type=file]');
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.txt')] } });
  expect(await screen.findByText('Please upload a file first.')).toBeTruthy();
}
