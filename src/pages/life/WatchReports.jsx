import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import { api } from '../../services/api';

const PLACES = ['entrée', 'récréation', 'couloir', 'espace commun', 'autre'];
const TYPES = [
  { value: 'surveillance', label: 'Rapport de surveillance' },
  { value: 'signalement', label: 'Signalement à la direction' }
];

function WatchReports() {
  const [params] = useSearchParams();
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'surveillance', place: 'récréation', studentId: '', date: '', time: '', detail: '' });
  const [error, setError] = useState('');
  const canWrite = (() => {
    try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role === 'supervisor'; } catch { return false; }
  })();
  const placeFilter = params.get('place') || '';
  const typeFilter = params.get('type') || '';

  async function refresh() {
    const [reportData, studentData] = await Promise.all([
      api('/api/watch-reports'),
      api('/api/students')
    ]);
    setItems(reportData.reports || []);
    setStudents(studentData.students || []);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  useEffect(() => {
    if (placeFilter || typeFilter) {
      setForm((current) => ({
        ...current,
        place: placeFilter || current.place,
        type: typeFilter || current.type
      }));
    }
  }, [placeFilter, typeFilter]);

  function openCreate() {
    setError('');
    setForm({
      type: typeFilter || 'surveillance',
      place: placeFilter || 'récréation',
      studentId: '',
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      detail: ''
    });
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/watch-reports', { method: 'POST', body: form });
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const rows = items.filter((item) => {
    if (placeFilter && item.place !== placeFilter) return false;
    if (typeFilter && item.type !== typeFilter) return false;
    return true;
  });

  const title = typeFilter === 'signalement'
    ? 'Signalements à la direction'
    : placeFilter
      ? `Surveillance — ${placeFilter}`
      : 'Rapports de surveillance';

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>{title}</h1>
          <p>{canWrite ? 'Les signalements sont lus par la direction. Un élève n’est obligatoire que s’il est concerné.' : 'Lecture seule : ces rapports sont écrits par le surveillant.'}</p>
        </div>
        {canWrite && <button type="button" className="btn" onClick={openCreate}>➕ Nouveau rapport</button>}
      </div>
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Lieu</th>
                <th>Élève</th>
                <th>Détail</th>
                <th>Par</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="7">Aucun rapport pour le moment.</td></tr>
              ) : rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}{item.time ? ` · ${item.time}` : ''}</td>
                  <td>{item.type === 'signalement' ? 'Signalement' : 'Surveillance'}</td>
                  <td>{item.place || '—'}</td>
                  <td>{item.studentName || '—'}</td>
                  <td>{item.detail}</td>
                  <td>{item.createdByName || '—'}</td>
                  <td>
                    {canWrite && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!window.confirm('Supprimer ce rapport ?')) return;
                        await api(`/api/watch-reports/${item.id}`, { method: 'DELETE' });
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
        <Modal title="Rapport de vie scolaire" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Type</label>
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Lieu</label>
                <select value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })}>
                  {PLACES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
              </div>
              <div className="form-field">
                <label>Heure</label>
                <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
              </div>
              <div className="form-field full">
                <label>Élève concerné (optionnel)</label>
                <select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
                  <option value="">Aucun élève précis</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.firstName} {student.lastName} — {student.className || 'Sans classe'}</option>
                  ))}
                </select>
              </div>
              <div className="form-field full">
                <label>Détail</label>
                <textarea rows="4" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} required placeholder="Ce que vous avez observé…" />
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

export default WatchReports;
