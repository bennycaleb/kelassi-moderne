import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

function childPicker(students, childrenIds, onToggle) {
  return (
    <div className="check-list">
      {students.length === 0 ? <p className="muted-line">Aucun élève inscrit pour le moment.</p> : students.map((item) => (
        <label key={item.id}>
          <input
            type="checkbox"
            checked={childrenIds.includes(item.id)}
            onChange={() => onToggle(item.id)}
          />
          {item.firstName} {item.lastName} {item.className ? `· ${item.className}` : ''}
        </label>
      ))}
    </div>
  );
}

function Parents() {
  const { year } = useSchool();
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', childrenIds: [] });
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    const [parentData, studentData] = await Promise.all([api('/api/parents'), api('/api/students')]);
    setParents(parentData.parents);
    setStudents(studentData.students);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  function toggleChild(studentId) {
    setForm((current) => ({
      ...current,
      childrenIds: current.childrenIds.includes(studentId)
        ? current.childrenIds.filter((id) => id !== studentId)
        : current.childrenIds.concat(studentId)
    }));
  }

  function openCreate() {
    setEditing(null);
    setError('');
    setForm({ firstName: '', lastName: '', email: '', phone: '', childrenIds: [] });
    setOpen(true);
  }

  function openEdit(parent) {
    setEditing(parent);
    setError('');
    setForm({
      firstName: parent.firstName || '',
      lastName: parent.lastName || '',
      email: parent.email || '',
      phone: parent.phone || '',
      childrenIds: parent.childrenIds || (parent.children || []).map((child) => child.id)
    });
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (editing) {
        await api(`/api/parents/${editing.id}`, { method: 'PUT', body: form });
      } else {
        const result = await api('/api/parents', { method: 'POST', body: form });
        setCredentials(result.credentials);
        if (!(form.childrenIds || []).length) {
          setError('Compte ouvert. Pensez à lier au moins un enfant (bouton Lier les enfants).');
        }
      }
      setOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Parents / tuteurs</h1>
          <p>Cochez les enfants : sans ce lien, le parent ne voit rien dans son espace.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>Ouvrir un compte parent</button>
      </div>
      {credentials && <div className="credentials-box">Email : <b>{credentials.email}</b> — Mot de passe : <b>{credentials.password}</b></div>}
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Parent</th><th>Email</th><th>Enfants liés</th><th></th></tr></thead>
          <tbody>
            {parents.map((parent) => (
              <tr key={parent.id}>
                <td>{parent.firstName} {parent.lastName}</td>
                <td>{parent.email}</td>
                <td>{(parent.children || []).map((child) => `${child.firstName} ${child.lastName}`).join(', ') || 'Aucun — le parent ne verra pas les infos'}</td>
                <td className="row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(parent)}>Lier les enfants</button>
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
        <Modal title={editing ? `Lier les enfants — ${editing.firstName}` : 'Nouveau parent'} onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Prénom</label><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></div>
              <div className="form-field"><label>Nom</label><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></div>
              <div className="form-field"><label>Email</label><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
              <div className="form-field"><label>Téléphone</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              <div className="form-field full">
                <label>Enfants à suivre (cochez)</label>
                {childPicker(students, form.childrenIds, toggleChild)}
                <p className="muted-line">Si l’email du parent est le même que « Email parent » sur la fiche élève, le lien se fait aussi tout seul.</p>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">{editing ? 'Enregistrer le lien' : 'Ouvrir le compte'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Parents;
