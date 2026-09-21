import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';

function Convocations() {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ studentId: '', date: '', time: '', reason: '' });
  const [error, setError] = useState('');

  async function refresh() {
    const [convocationData, studentData] = await Promise.all([
      api('/api/convocations'),
      api('/api/students')
    ]);
    setItems(convocationData.convocations || []);
    setStudents(studentData.students || []);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  function openCreate() {
    setError('');
    setForm({
      studentId: students[0]?.id || '',
      date: new Date().toISOString().slice(0, 10),
      time: '',
      reason: ''
    });
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/convocations', { method: 'POST', body: form });
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
          <h1>Convocations</h1>
          <p>La convocation est visible uniquement par le parent de cet élève et par l’élève lui-même, dans leur espace.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>➕ Convoquer un élève</button>
      </div>
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Élève</th>
                <th>Motif</th>
                <th>Par</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="5">Aucune convocation pour le moment.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}{item.time ? ` · ${item.time}` : ''}</td>
                  <td><strong>{item.studentName}</strong><br /><small>{item.className}</small></td>
                  <td>{item.reason}</td>
                  <td>{item.createdByName || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!window.confirm('Supprimer cette convocation ?')) return;
                        await api(`/api/convocations/${item.id}`, { method: 'DELETE' });
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
      </div>
      {open && (
        <Modal title="Nouvelle convocation" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field full">
                <label>Élève</label>
                <select name="studentId" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} required>
                  <option value="">Choisir un élève…</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} — {student.className || 'Sans classe'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></div>
              <div className="form-field"><label>Heure</label><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></div>
              <div className="form-field full">
                <label>Motif</label>
                <textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required placeholder="Ex. : comportement en classe, retard répété…" />
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Envoyer la convocation</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Convocations;
