const API_URL = import.meta.env.VITE_API_URL || '';

function clearSession() {
  if (!localStorage.getItem('kelassi_token') && !localStorage.getItem('kelassi_user')) return;
  localStorage.removeItem('kelassi_token');
  localStorage.removeItem('kelassi_user');
  window.dispatchEvent(new Event('kelassi-logout'));
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('kelassi_token');
  const year = localStorage.getItem('kelassi_year');
  const { body, headers, skipYear, ...rest } = options;
  const isLogin = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/admin/login');
  let url = path;

  if (!isLogin && !token) {
    throw new Error('Non authentifié');
  }

  if (year && !skipYear && !path.startsWith('/api/auth') && !url.includes('year=')) {
    url += `${url.includes('?') ? '&' : '?'}year=${encodeURIComponent(year)}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearSession();
    throw new Error('Session expirée. Reconnectez-vous.');
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Erreur serveur');
  }
  return data;
}

export { API_URL };

export function money(value, currency = 'FC') {
  return `${Number(value || 0).toLocaleString('fr-FR')} ${currency}`;
}

export function readPhoto(file, onLoad) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result);
  reader.readAsDataURL(file);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
    reader.readAsDataURL(file);
  });
}

export async function downloadAuthFile(path, filename) {
  const token = localStorage.getItem('kelassi_token');
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Téléchargement impossible');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'document.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
