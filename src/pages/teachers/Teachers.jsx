import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';
import { useSchool } from '../../context/SchoolContext';
import { readPhoto } from '../../services/api';
import { createTeacher, deleteTeacher, getTeachers, updateTeacher } from '../../services/teacher';

const emptyForm = {
  firstName: '', lastName: '', email: '', phone: '', subject: '', subjectIds: [],
  password: '', contract: 'CDI', salary: '', address: '', gender: '', status: 'actif', photo: ''
};

function Teachers() {
  const { year, subjects } = useSchool();
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [query, setQuery] = useState('');

  async function refresh() {
    setTeachers((await getTeachers()).teachers);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [year]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const haystack = `${teacher.firstName} ${teacher.lastName} ${teacher.email} ${teacher.phone} ${(teacher.subjects || []).join(' ')} ${teacher.subject}`.toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [teachers, query]);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function toggleSubject(subjectId) {
    setForm((current) => {
      const ids = current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId];
      const first = subjects.find((item) => item.id === ids[0]);
      return { ...current, subjectIds: ids, subject: first?.name || current.subject };
    });
  }

  async function submit(event) {
    event.preventDefault();
    try {
      if (editing) await updateTeacher(editing.id, form);
      else setCredentials((await createTeacher(form)).credentials);
      await refresh();
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Enseignants</h1>
          <p>Comptes professeurs, matières, classes et fiches individuelles.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setEditing(null); setForm({ ...emptyForm, subject: subjects[0]?.name || '' }); setOpen(true); }}>➕ Ajouter un enseignant</button>
      </div>
      {credentials && <div className="credentials-box"><p>Email : <b>{credentials.email}</b> — Mot de passe : <b>{credentials.password}</b></p></div>}
      {error && !open && <p className="error">{error}</p>}
      <div className="panel toolbar-filters">
        <div className="form-field">
          <label>Recherche</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, matière, email…" />
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo / Nom</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Matières</th>
                <th>Classes</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar src={teacher.photo} name={teacher.firstName} />
                      <strong>{teacher.lastName} {teacher.firstName}</strong>
                    </div>
                  </td>
                  <td>{teacher.phone || '—'}</td>
                  <td>{teacher.email}</td>
                  <td>{(teacher.subjects || []).join(', ') || teacher.subject || '—'}</td>
                  <td>{(teacher.classes || []).map((item) => item.name).join(', ') || '—'}</td>
                  <td><span className={teacher.status === 'actif' ? 'badge badge-success' : 'badge badge-warning'}>{teacher.status}</span></td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn btn-secondary btn-sm" to={`/dashboard/teachers/${teacher.id}`}>Voir</Link>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(teacher); setForm({ ...emptyForm, ...teacher, subjectIds: teacher.subjectIds || [], password: '' }); setOpen(true); }}>Modifier</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm('Supprimer cet enseignant ?')) { await deleteTeacher(teacher.id); refresh(); } }}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Modal title={editing ? 'Modifier l’enseignant' : 'Ajouter un enseignant'} onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Prénom</label><input name="firstName" value={form.firstName} onChange={change} required /></div>
              <div className="form-field"><label>Nom</label><input name="lastName" value={form.lastName} onChange={change} required /></div>
              <div className="form-field"><label>Email</label><input type="email" name="email" value={form.email} onChange={change} required /></div>
              <div className="form-field"><label>Téléphone</label><input name="phone" value={form.phone} onChange={change} /></div>
              <div className="form-field"><label>Photo</label><input type="file" accept="image/*" onChange={(event) => event.target.files[0] && readPhoto(event.target.files[0], (photo) => setForm((current) => ({ ...current, photo })))} /></div>
              <div className="form-field"><label>Statut</label><select name="status" value={form.status} onChange={change}><option value="actif">actif</option><option value="inactif">inactif</option></select></div>
              <div className="form-field full">
                <label>Matières</label>
                <div className="chip-list">
                  {subjects.map((item) => (
                    <label key={item.id} className={`chip ${form.subjectIds.includes(item.id) ? 'on' : ''}`}>
                      <input type="checkbox" checked={form.subjectIds.includes(item.id)} onChange={() => toggleSubject(item.id)} />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-field"><label>Contrat</label><select name="contract" value={form.contract} onChange={change}><option>CDI</option><option>CDD</option><option>Vacataire</option></select></div>
              <div className="form-field"><label>Adresse</label><input name="address" value={form.address} onChange={change} /></div>
              {!editing && <div className="form-field full"><label>Mot de passe</label><input name="password" value={form.password} onChange={change} placeholder="Auto si vide" /></div>}
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn" type="submit">Enregistrer</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Teachers;
