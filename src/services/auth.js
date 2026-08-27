const API_URL = 'http://localhost:5001';

export async function adminLogin(username, password) {
  const response = await fetch(`${API_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username,
      password
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Erreur de connexion');
  }

  return data;
}

export async function getCurrentAdmin(token) {
  const response = await fetch(`${API_URL}/api/auth/admin/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Session invalide');
  }

  return data;
}

export async function adminLogout(token) {
  await fetch(`${API_URL}/api/auth/admin/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
