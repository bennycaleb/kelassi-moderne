import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { refreshSchoolMeta, useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';

function Classes() {
  const { year, teachers, cycles } = useSchool();
  const [classes, setClasses] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', level: 'Université', cycleId: 'cycle_universite', mainTeacherId: '', room: '' });

  async function refresh() {
    setClasses((await api('/api/classes')).classes);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  function applyLevel(level) {
    const match = cycles.find((item) => item.name === level) || cycles.find((item) => item.code === 'universite');
    setForm((current) => ({ ...current, level, cycleId: match?.id || current.cycleId }));
  }

  async function submit(event) {
    event.preventDefault();
    await api('/api/classes', { method: 'POST', body: form });
    setOpen(false);
    setForm({ name: '', level: 'Université', cycleId: cycles.find((item) => item.code === 'universite')?.id || cycles[0]?.id || '', mainTeacherId: '', room: '' });
    await refresh();
    refreshSchoolMeta();
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Classes</h1>
          <p>Effectifs, professeur principal, moyenne et présence par classe.</p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>Nouvelle classe</button>
      </div>
      <div className="course-grid">
        {classes.map((item) => (
          <Link className="course-card class-card" key={item.id} to={`/dashboard/classes/${item.id}`}>
            <span className="badge badge-success">{item.cycleName || item.level || 'Classe'}</span>
            <h3>{item.name}</h3>
            <p><b>{item.studentsCount || 0} étudiants</b></p>
            <p>Professeur principal : {item.mainTeacherName || '—'}</p>
            <p>Moyenne générale : {item.average ? `${item.average}/20` : '—'}</p>
            <p>Présence : {item.presenceRate || 0} %</p>
            <div className="row-actions" style={{ marginTop: 12 }} onClick={(event) => event.preventDefault()}>
              <span className="btn btn-secondary btn-sm">Ouvrir</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!window.confirm(`Supprimer la classe « ${item.name} » ?`)) return;
                  await api(`/api/classes/${item.id}`, { method: 'DELETE' });
                  refresh();
                  refreshSchoolMeta();
                }}
              >
                Supprimer
              </button>
            </div>
          </Link>
        ))}
      </div>
      {open && (
        <Modal title="Nouvelle classe" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Nom</label><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="6e A, L2 Informatique…" required /></div>
              <div className="form-field">
                <label>Niveau</label>
                <select value={form.level} onChange={(event) => applyLevel(event.target.value)}>
                  <option>Primaire</option>
                  <option>Collège</option>
                  <option>Lycée</option>
                  <option>Université</option>
                </select>
              </div>
              <div className="form-field">
                <label>Cycle (règles de notation)</label>
                <select value={form.cycleId} onChange={(event) => setForm({ ...form, cycleId: event.target.value })}>
                  {(cycles.length ? cycles : [{ id: 'cycle_universite', name: 'Université', active: true }]).filter((item) => item.active !== false).map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.gradingMode === 'percent' ? ' — %' : ' — coef.'}</option>
                  ))}
                </select>
              </div>
              <div className="form-field"><label>Professeur principal</label><select value={form.mainTeacherId} onChange={(event) => setForm({ ...form, mainTeacherId: event.target.value })}><option value="">—</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}</select></div>
              <div className="form-field"><label>Salle</label><input value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} /></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn" type="submit">Créer</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Classes;
