import { api } from './api';

export function getTeachers() {
  return api('/api/teachers');
}

export function createTeacher(payload) {
  return api('/api/teachers', { method: 'POST', body: payload });
}

export function updateTeacher(id, payload) {
  return api(`/api/teachers/${id}`, { method: 'PUT', body: payload });
}

export function resetTeacherPassword(id) {
  return api(`/api/teachers/${id}/reset-password`, { method: 'POST' });
}

export function deleteTeacher(id) {
  return api(`/api/teachers/${id}`, { method: 'DELETE' });
}
