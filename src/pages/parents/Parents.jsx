import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

function Parents() {
  const { year } = useSchool();
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', childrenIds: [] });
  const [credentials, setCredentials] = useState(null);

  async function refresh() {
    const [parentData, studentData] = await Promise.all([api('/api/parents'), api('/api/students')]);
    setParents(parentData.parents);
    setStudents(studentData.students);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  async function submit(event) {
    event.preventDefault();
    const result = await api('/api/parents', { method: 'POST', body: form });
    setCredentials(result.credentials);
    setOpen(false);
    refresh();
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header"><h1>Parents / tuteurs</h1><p>Ouvrez un espace parent lié aux enfants.</p></div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>Ouvrir un compte parent</button>
      </div>
      {credentials && <div className="credentials-box">Email : <b>{credentials.email}</b> — Mot de passe : <b>{credentials.password}</b></div>}
      <div className="panel">
        <table>
          <thead><tr><th>Parent</th><th>Email</th><th>Enfants</th><th></th></tr></thead>
          <tbody>
            {parents.map((parent) => (
              <tr key={parent.id}>
                <td>{parent.firstName} {parent.lastName}</td>
                <td>{parent.email}</td>
                <td>{(parent.children || []).map((child) => `${child.firstName} ${child.lastName}`).join(', ') || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={async () => {
                      if (!window.confirm(`Supprimer le compte de ${parent.firstName} ${parent.lastName} ?`)) return;
                      await api(`/api/parents/${parent.id}`, { method: 'DELETE' });
                      refresh();
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Nouveau parent" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Prénom</label><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></div>
              <div className="form-field"><label>Nom</label><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></div>
              <div className="form-field"><label>Email</label><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
              <div className="form-field"><label>Téléphone</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              <div className="form-field full">
                <label>Enfants</label>
                <select multiple value={form.childrenIds} onChange={(event) => setForm({ ...form, childrenIds: Array.from(event.target.selectedOptions).map((item) => item.value) })}>
                  {students.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn" type="submit">Ouvrir le compte</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Parents;
