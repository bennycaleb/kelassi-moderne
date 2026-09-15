import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { ROLE_LABELS } from '../../constants';
import { api } from '../../services/api';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const current = (() => {
    try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}'); } catch { return {}; }
  })();
  const canCreate = ['admin', 'superadmin', 'director'].includes(current.role);

  async function refresh() {
    setUsers((await api('/api/users')).users);
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  function openCreate() {
    setError('');
    setForm({ firstName: '', lastName: '', email: '', password: '' });
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/api/users', { method: 'POST', body: { ...form, role: 'secretary' } });
      setCredentials(result.credentials);
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(user) {
    if (!window.confirm(`Réinitialiser le mot de passe de ${user.name} ?`)) return;
    try {
      const result = await api(`/api/users/${user.id}/reset-password`, { method: 'POST' });
      setCredentials(result.credentials);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Utilisateurs & rôles</h1>
          <p>Créez le compte secrétaire ici, puis remettez-lui l’e-mail et le mot de passe.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn" onClick={openCreate}>➕ Ajouter un secrétaire</button>
        )}
      </div>
      {credentials && (
        <div className="credentials-box">
          <p>Email : <b>{credentials.email}</b> — Mot de passe : <b>{credentials.password}</b></p>
          <p>Remettez ces identifiants à la personne. Elle se connecte sur la même page que vous.</p>
        </div>
      )}
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th></th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <select value={user.role} onChange={async (event) => { await api(`/api/users/${user.id}/role`, { method: 'PUT', body: { role: event.target.value } }); refresh(); }}>
                    {Object.keys(ROLE_LABELS).filter((role) => role !== 'owner').map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                  </select>
                </td>
                <td>
                  {user.id === current.id ? 'Compte actuel' : (
                    <div className="row-actions">
                      {canCreate && user.role !== 'owner' && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => resetPassword(user)}>Mot de passe</button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          if (!window.confirm(`Supprimer le compte de ${user.name} ?`)) return;
                          await api(`/api/users/${user.id}`, { method: 'DELETE' });
                          refresh();
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Ajouter un secrétaire" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Prénom</label><input name="firstName" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></div>
              <div className="form-field"><label>Nom</label><input name="lastName" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></div>
              <div className="form-field"><label>Email</label><input type="email" name="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
              <div className="form-field"><label>Mot de passe</label><input name="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Auto si vide" /></div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Créer le compte</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default UsersPage;
