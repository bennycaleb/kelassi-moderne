import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';

function Secretaries() {
  const [secretaries, setSecretaries] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const current = (() => {
    try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}'); } catch { return {}; }
  })();
  const canManage = ['admin', 'superadmin', 'director'].includes(current.role);

  async function refresh() {
    const data = await api('/api/users');
    setSecretaries((data.users || []).filter((user) => user.role === 'secretary'));
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

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
          <h1>Secrétariat</h1>
          <p>Vous pouvez créer <b>plusieurs secrétaires</b>. Ils travaillent tous sur la même école : si l’une inscrit un élève, l’autre le voit tout de suite dans la liste.</p>
        </div>
        {canManage && <button type="button" className="btn" onClick={openCreate}>➕ Ajouter un secrétaire</button>}
      </div>
      {credentials && (
        <div className="credentials-box">
          <p>Email : <b>{credentials.email}</b> — Mot de passe : <b>{credentials.password}</b></p>
          <p>Remettez ces identifiants à la secrétaire. Elle se connecte sur la même page que l’admin.</p>
        </div>
      )}
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {secretaries.length === 0 ? (
                <tr><td colSpan="3">Aucun compte secrétaire pour le moment. Cliquez sur « Ajouter un secrétaire ».</td></tr>
              ) : secretaries.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td>
                  <td>
                    <div className="row-actions">
                      {canManage && (
                        <>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => resetPassword(user)}>Mot de passe</button>
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

export default Secretaries;
