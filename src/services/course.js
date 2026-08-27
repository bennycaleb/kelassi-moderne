import { api } from './api';

export function getCourses() {
  return api('/api/courses');
}

export function createCourse(payload) {
  return api('/api/courses', { method: 'POST', body: payload });
}

export function updateCourse(id, payload) {
  return api(`/api/courses/${id}`, { method: 'PUT', body: payload });
}

export function deleteCourse(id) {
  return api(`/api/courses/${id}`, { method: 'DELETE' });
}
