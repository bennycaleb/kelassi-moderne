import React, { useState } from 'react';
import { API_URL } from '../services/api';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Erreur authentification');

      onLogin({ ...data.user, token: data.token });
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Impossible de joindre le serveur.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">K</div>
        <h1>Kelassi Moderne</h1>
        <p>Entreprise, administration d’école, enseignant, étudiant ou parent.</p>

        <form onSubmit={submit}>
          <div className="form-field">
            <label>Email</label>
            <input
              placeholder="ex. admin@kelassi.com"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="form-field" style={{ marginTop: 14 }}>
            <label>Mot de passe</label>
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn" style={{ width: '100%', marginTop: 18 }} disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
