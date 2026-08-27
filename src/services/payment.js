import { api } from './api';

export function getPayments() {
  return api('/api/payments');
}

export function createPayment(payload) {
  return api('/api/payments', { method: 'POST', body: payload });
}

export function updatePayment(id, payload) {
  return api(`/api/payments/${id}`, { method: 'PUT', body: payload });
}

export function settlePayment(payload) {
  return api('/api/payments/settle', { method: 'POST', body: payload });
}

export function deletePayment(id) {
  return api(`/api/payments/${id}`, { method: 'DELETE' });
}
