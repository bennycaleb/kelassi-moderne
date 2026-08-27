import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import FaceCapture from '../../components/FaceCapture';
import Modal from '../../components/Modal';
import { useSchool } from '../../context/SchoolContext';
import { readPhoto } from '../../services/api';
import { createStudent, deleteStudent, getStudents, updateStudent } from '../../services/student';

const emptyForm = {
  firstName: '', lastName: '', email: '', phone: '', classId: '', password: '',
  birthDate: '', gender: '', address: '', parentName: '', parentPhone: '', parentEmail: '',
  emergencyContact: '', photo: '', faceDescriptor: [], status: 'actif'
};

function Students() {
  const { year, classes } = useSchool();
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function refresh() {
    const data = await getStudents();
    setStudents(data.students);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [year]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      const haystack = `${student.firstName} ${student.lastName} ${student.matricule} ${student.phone} ${student.email} ${student.className}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (classFilter && student.classId !== classFilter) return false;
      if (statusFilter && student.status !== statusFilter) return false;
      return true;
    }).sort((a, b) => {
      const classCmp = (a.className || '').localeCompare(b.className || '', 'fr');
      if (classCmp) return classCmp;
      if (a.rank && b.rank) return a.rank - b.rank || (b.average || 0) - (a.average || 0);
      if (a.rank) return -1;
      if (b.rank) return 1;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
    });
  }, [students, query, classFilter, statusFilter]);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, classId: classes[0]?.id || '' });
    setError('');
    setOpen(true);
  }

  function openEdit(student) {
    setEditing(student);
    setForm({ ...emptyForm, ...student, password: '' });
    setError('');
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = { ...form };
      if (!payload.faceDescriptor?.length) delete payload.faceDescriptor;
      if (editing) await updateStudent(editing.id, payload);
      else setCredentials((await createStudent(payload)).credentials);
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
          <h1>Étudiants</h1>
          <p>Recherche, inscription et fiches complètes — {filtered.length} / {students.length} élèves.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>➕ Ajouter un étudiant</button>
      </div>

      {credentials && (
        <div className="credentials-box">
          <strong>Compte ouvert</strong>
          <p>Email : <b>{credentials.email}</b> — Mot de passe : <b>{credentials.password}</b></p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCredentials(null)}>Masquer</button>
        </div>
      )}
      {error && !open && <p className="error">{error}</p>}

      <div className="panel toolbar-filters">
        <div className="form-field">
          <label>🔍 Recherche d’un étudiant</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, prénom, matricule, téléphone…" />
        </div>
        <div className="form-field">
          <label>Classe</label>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="">Toutes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Statut</label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Tous</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </div>
      </div>

      <div className="panel">
        {loading ? <p>Chargement…</p> : filtered.length === 0 ? (
          <div className="empty-state">
            <p>Aucun étudiant ne correspond à cette recherche.</p>
            <button type="button" className="btn" onClick={openCreate}>Ajouter un étudiant</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>🪪 Matricule</th>
                  <th>👤 Photo / Nom</th>
                  <th>Classe</th>
                  <th>Rang</th>
                  <th>Moyenne</th>
                  <th>Scolarité</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Visage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <td><code>{student.matricule}</code></td>
                    <td>
                      <div className="person-cell">
                        <Avatar src={student.photo} name={student.firstName} />
                        <div>
                          <strong>{student.lastName} {student.firstName}</strong>
                          <small className="muted-line">{student.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{student.className || '—'}</td>
                    <td><b>{student.rankLabel || '—'}</b></td>
                    <td>{student.average ? `${student.average}/20` : '—'}</td>
                    <td><span className={student.tuitionStatus === 'payé' ? 'badge badge-success' : student.tuitionStatus === 'partiel' ? 'badge badge-warning' : student.tuitionStatus === 'impayé' ? 'badge badge-danger' : 'badge'}>{student.tuitionLabel || '—'}</span></td>
                    <td>{student.phone || '—'}</td>
                    <td><span className={student.status === 'actif' ? 'badge badge-success' : 'badge badge-warning'}>{student.status}</span></td>
                    <td><span className={student.hasFace ? 'badge badge-success' : 'badge badge-warning'}>{student.hasFace ? 'Enregistré' : 'À scanner'}</span></td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn btn-secondary btn-sm" to={`/dashboard/students/${student.id}`}>Voir</Link>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(student)}>Modifier</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm(`Supprimer ${student.firstName} ${student.lastName} ?`)) { await deleteStudent(student.id); refresh(); } }}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Modal title={editing ? 'Modifier l’étudiant' : 'Inscrire un étudiant'} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Prénom</label><input name="firstName" value={form.firstName} onChange={change} required /></div>
              <div className="form-field"><label>Nom</label><input name="lastName" value={form.lastName} onChange={change} required /></div>
              <div className="form-field"><label>Email du compte</label><input type="email" name="email" value={form.email} onChange={change} required /></div>
              <div className="form-field"><label>Téléphone</label><input name="phone" value={form.phone} onChange={change} /></div>
              <div className="form-field"><label>Date de naissance</label><input type="date" name="birthDate" value={form.birthDate} onChange={change} /></div>
              <div className="form-field"><label>Sexe</label><select name="gender" value={form.gender} onChange={change}><option value="">—</option><option>F</option><option>M</option></select></div>
              <div className="form-field"><label>Classe</label><select name="classId" value={form.classId} onChange={change}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="form-field"><label>Statut</label><select name="status" value={form.status} onChange={change}><option value="actif">actif</option><option value="inactif">inactif</option></select></div>
              <div className="form-field full">
                <FaceCapture
                  photo={form.photo}
                  label="Photo & scan du visage (pour la présence automatique)"
                  onCapture={({ photo, faceDescriptor }) => setForm((current) => ({ ...current, photo, faceDescriptor }))}
                />
                <p className="muted-line">Ou importez une photo fichier :</p>
                <input type="file" accept="image/*" onChange={(event) => event.target.files[0] && readPhoto(event.target.files[0], (photo) => setForm((current) => ({ ...current, photo })))} />
                {form.faceDescriptor?.length ? <p className="muted-line">Visage prêt pour la reconnaissance.</p> : <p className="muted-line">Scannez le visage pour activer l’appel automatique.</p>}
              </div>
              <div className="form-field full"><label>Adresse</label><input name="address" value={form.address} onChange={change} /></div>
              <div className="form-field"><label>Parent / tuteur</label><input name="parentName" value={form.parentName} onChange={change} /></div>
              <div className="form-field"><label>Tél. parent</label><input name="parentPhone" value={form.parentPhone} onChange={change} /></div>
              <div className="form-field"><label>Email parent</label><input name="parentEmail" value={form.parentEmail} onChange={change} /></div>
              <div className="form-field"><label>Contact d’urgence</label><input name="emergencyContact" value={form.emergencyContact} onChange={change} /></div>
              {!editing && <div className="form-field full"><label>Mot de passe (optionnel)</label><input name="password" value={form.password} onChange={change} placeholder="Généré automatiquement si vide" /></div>}
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button type="submit" className="btn">{editing ? 'Enregistrer' : 'Ouvrir le compte'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Students;
