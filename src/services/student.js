import { api } from './api';

export function getStudents(query = '') {
  return api(`/api/students${query}`);
}

export function createStudent(payload) {
  return api('/api/students', { method: 'POST', body: payload });
}

export function updateStudent(id, payload) {
  return api(`/api/students/${id}`, { method: 'PUT', body: payload });
}

export function resetStudentPassword(id) {
  return api(`/api/students/${id}/reset-password`, { method: 'POST' });
}

export function deleteStudent(id) {
  return api(`/api/students/${id}`, { method: 'DELETE' });
}
