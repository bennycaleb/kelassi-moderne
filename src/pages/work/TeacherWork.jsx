import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { useSchool } from '../../context/SchoolContext';
import { api, downloadAuthFile, readFile } from '../../services/api';

function TeacherWork() {
  const { year, classes, subjects } = useSchool();
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copies, setCopies] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [form, setForm] = useState({
    type: 'cours',
    title: '',
    description: '',
    classId: '',
    subjectId: '',
    dueDate: '',
    fileName: '',
    fileData: ''
  });

  const teacherClasses = useMemo(() => {
    const mine = me?.teacher?.classes || [];
    if (mine.length) return mine;
    return classes;
  }, [me, classes]);

  async function refresh() {
    const [auth, workData] = await Promise.all([api('/api/auth/me'), api('/api/work')]);
    setMe(auth);
    setItems(workData.work || []);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [year]);

  useEffect(() => {
    if (!form.classId && teacherClasses[0]) {
      setForm((current) => ({ ...current, classId: teacherClasses[0].id, subjectId: subjects[0]?.id || '' }));
    }
  }, [teacherClasses, subjects, form.classId]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/api/work', { method: 'POST', body: form });
      setMessage(result.message);
      setOpen(false);
      setForm((current) => ({ ...current, title: '', description: '', dueDate: '', fileName: '', fileData: '' }));
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openCopies(item) {
    const data = await api(`/api/work/${item.id}/copies`);
    setCopies(data);
    const nextScores = {};
    const nextComments = {};
    data.copies.forEach((copy) => {
      nextScores[copy.studentId] = copy.score ?? '';
      nextComments[copy.studentId] = copy.teacherComment || '';
    });
    setScores(nextScores);
    setComments(nextComments);
  }

  async function gradeStudent(studentId) {
    const score = scores[studentId];
    if (score === '' || score === undefined || Number.isNaN(Number(score))) {
      setError('Indiquez une note sur 20.');
      return;
    }
    await api(`/api/work/${copies.work.id}/grade`, {
      method: 'POST',
      body: { studentId, score: Number(score), teacherComment: comments[studentId] || '' }
    });
    setMessage('Note enregistrée. L’étudiant la verra dans son compte.');
    openCopies(copies.work);
    refresh();
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Cours & devoirs</h1>
          <p>Publiez un PDF par classe et niveau. Les élèves concernés le voient dans leur compte. Vous seul notez les devoirs.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setError(''); setOpen(true); }}>Publier un cours ou un devoir</button>
      </div>
      {message && <div className="credentials-box">{message}</div>}
      {error && !open && <p className="error">{error}</p>}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Titre</th>
              <th>Matière</th>
              <th>Classe / niveau</th>
              <th>Copies</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><span className={item.type === 'devoir' ? 'badge badge-warning' : 'badge badge-success'}>{item.type === 'devoir' ? 'Devoir' : 'Cours PDF'}</span></td>
                <td>{item.title}</td>
                <td>{item.subjectName || '—'}</td>
                <td>{item.className} · {item.level}</td>
                <td>{item.type === 'devoir' ? `${item.submissionsCount || 0} rendus` : '—'}</td>
                <td className="row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadAuthFile(`/api/work/${item.id}/file`, item.originalName)}>Télécharger</button>
                  {item.type === 'devoir' && <button type="button" className="btn btn-sm" onClick={() => openCopies(item)}>Corriger / noter</button>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer ce document ?')) return; await api(`/api/work/${item.id}`, { method: 'DELETE' }); refresh(); }}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="empty-state">Aucun cours ni devoir publié pour le moment.</p>}
      </div>

      {copies && (
        <div className="panel">
          <div className="page-toolbar">
            <h2>Copies — {copies.work.title} ({copies.work.className})</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCopies(null)}>Fermer</button>
          </div>
          <table>
            <thead><tr><th>Étudiant</th><th>Réponse</th><th>Note / 20</th><th>Commentaire</th><th></th></tr></thead>
            <tbody>
              {copies.copies.map((copy) => (
                <tr key={copy.studentId}>
                  <td>{copy.studentName}</td>
                  <td>
                    {copy.submitted && copy.submissionId
                      ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadAuthFile(`/api/submissions/${copy.submissionId}/file`, copy.fileName)}>Télécharger la copie</button>
                      : 'Non rendu'}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={scores[copy.studentId] ?? ''}
                      onChange={(event) => setScores((current) => ({ ...current, [copy.studentId]: event.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      value={comments[copy.studentId] || ''}
                      onChange={(event) => setComments((current) => ({ ...current, [copy.studentId]: event.target.value }))}
                      placeholder="Appréciation"
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => gradeStudent(copy.studentId)}>Enregistrer la note</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title="Publier pour une classe" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Type</label>
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  <option value="cours">Cours PDF</option>
                  <option value="devoir">Devoir</option>
                </select>
              </div>
              <div className="form-field">
                <label>Classe / niveau / filière</label>
                <select value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} required>
                  {teacherClasses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} — {item.level}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Matière</label>
                <select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>
                  <option value="">—</option>
                  {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Titre</label>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required placeholder="Cours 1, Contrôle, Devoir maison…" />
              </div>
              {form.type === 'devoir' && (
                <div className="form-field">
                  <label>Date limite</label>
                  <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                </div>
              )}
              <div className="form-field full">
                <label>Description</label>
                <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div className="form-field full">
                <label>Fichier PDF</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const fileData = await readFile(file);
                    setForm((current) => ({ ...current, fileName: file.name, fileData }));
                  }}
                  required={!form.fileData}
                />
                {form.fileName && <small className="muted-line">{form.fileName}</small>}
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Publier</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default TeacherWork;
