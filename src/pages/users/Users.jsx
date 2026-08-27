import React, { useEffect, useState } from 'react';
import { ROLE_LABELS } from '../../constants';
import { api } from '../../services/api';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const current = (() => {
    try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}'); } catch { return {}; }
  })();

  async function refresh() {
    setUsers((await api('/api/users')).users);
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  return (
    <div>
      <div className="page-header"><h1>Utilisateurs & rôles</h1><p>Super Admin, Direction, Secrétariat, Comptabilité, Enseignant, Étudiant, Parent.</p></div>
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
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UsersPage;
