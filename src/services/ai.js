import { api } from './api';

export function getAiDesk() {
  return api('/api/ai/desk');
}

export function askAi(message, history = []) {
  return api('/api/ai/ask', { method: 'POST', body: { message, history } });
}

export function draftAi(kind, studentId) {
  return api('/api/ai/draft', { method: 'POST', body: { kind, studentId } });
}
