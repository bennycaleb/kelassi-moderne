import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';

const LABELS = ['Incident', 'Avertissement', 'Retenue', 'Exclusion temporaire', 'Travail d’intérêt', 'Autre'];

function Incidents() {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ studentId: '', kind: 'incident', label: 'Incident', date: '', detail: '', convoke: false });
  const [error, setError] = useState('');
  const canWrite = (() => {
    try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role === 'supervisor'; } catch { return false; }
  })();

  async function refresh() {
    const [sanctionData, studentData] = await Promise.all([
      api('/api/sanctions'),
      api('/api/students')
    ]);
    setItems(sanctionData.sanctions || []);
    setStudents(studentData.students || []);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  function openCreate() {
    setError('');
    setForm({
      studentId: students[0]?.id || '',
      kind: 'incident',
      label: 'Incident',
      date: new Date().toISOString().slice(0, 10),
      detail: '',
      convoke: false
    });
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/sanctions', { method: 'POST', body: form });
      if (form.convoke && form.studentId && form.detail) {
        await api('/api/convocations', {
          method: 'POST',
          body: { studentId: form.studentId, date: form.date, reason: form.detail }
        });
      }
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Incidents & sanctions</h1>
          <p>Ces faits sont visibles par le parent de cet élève et par l’élève, dans leur espace. Cochez « convoquer » si le parent doit venir.</p>
        </div>
        {canWrite && <button type="button" className="btn" onClick={openCreate}>➕ Enregistrer un fait</button>}
      </div>
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Élève</th>
                <th>Type</th>
                <th>Libellé</th>
                <th>Détail</th>
                <th>Par</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7">Aucun incident ni sanction pour le moment.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td><strong>{item.studentName}</strong><br /><small>{item.className}</small></td>
                  <td>{item.kind === 'incident' ? 'Incident' : 'Sanction'}</td>
                  <td>{item.label}</td>
                  <td>{item.detail || '—'}</td>
                  <td>{item.createdByName || '—'}</td>
                  <td>
                    {canWrite && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!window.confirm('Supprimer cette fiche ?')) return;
                        await api(`/api/sanctions/${item.id}`, { method: 'DELETE' });
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
      {open && canWrite && (
        <Modal title="Incident ou sanction" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field full">
                <label>Élève</label>
                <select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} required>
                  <option value="">Choisir un élève…</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.firstName} {student.lastName} — {student.className || 'Sans classe'}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Type</label>
                <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                  <option value="incident">Incident</option>
                  <option value="sanction">Sanction</option>
                </select>
              </div>
              <div className="form-field">
                <label>Libellé</label>
                <select value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })}>
                  {LABELS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
              </div>
              <div className="form-field full">
                <label>Détail</label>
                <textarea rows="3" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} required placeholder="Ce qui s’est passé…" />
              </div>
              <div className="form-field full">
                <label>
                  <input type="checkbox" checked={form.convoke} onChange={(event) => setForm({ ...form, convoke: event.target.checked })} />
                  {' '}Convoquer aussi le parent de cet élève
                </label>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Incidents;
