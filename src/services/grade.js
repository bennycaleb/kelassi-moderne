import { api } from './api';

export function getGrades(query = '') {
  return api(`/api/grades${query}`);
}

export function createGrade(payload) {
  return api('/api/grades', { method: 'POST', body: payload });
}

export function deleteGrade(id) {
  return api(`/api/grades/${id}`, { method: 'DELETE' });
}
