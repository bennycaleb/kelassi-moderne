import React, { useEffect, useState } from 'react';
import { DAYS, HOURS } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';

function rangeLabel(start, end) {
  return `${String(start).replace(':', 'h')}–${String(end || '').replace(':', 'h')}`;
}

function Timetable() {
  const { year, classes, subjects, teachers } = useSchool();
  const [classId, setClassId] = useState('');
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ day: 'Lundi', startTime: '08:00', endTime: '10:00', subjectId: '', teacherId: '', room: '' });

  async function refresh(currentClass = classId) {
    const query = currentClass ? `?classId=${currentClass}` : '';
    setSlots((await api(`/api/timetable${query}`)).timetable);
  }

  useEffect(() => {
    if (classes[0] && !classId) setClassId(classes[0].id);
  }, [classes, classId]);

  useEffect(() => {
    if (classId) refresh(classId).catch(() => {});
  }, [classId, year]);

  useEffect(() => {
    const index = HOURS.indexOf(form.startTime);
    const next = HOURS[index + 1] || '18:00';
    setForm((current) => current.endTime === next ? current : { ...current, endTime: next });
  }, [form.startTime]);

  async function add(event) {
    event.preventDefault();
    await api('/api/timetable', { method: 'POST', body: { ...form, classId } });
    refresh();
  }

  function cell(day, hour) {
    return slots.find((item) => item.day === day && item.startTime === hour);
  }

  const className = classes.find((item) => item.id === classId)?.name || '';

  return (
    <div>
      <div className="page-header">
        <h1>Emploi du temps</h1>
        <p>Placez les cours par jour et horaire. Les étudiants et enseignants voient automatiquement leur grille.</p>
      </div>
      <div className="panel form-grid">
        <div className="form-field">
          <label>Classe</label>
          <select value={classId} onChange={(event) => setClassId(event.target.value)}>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap panel">
        <table className="timetable">
          <thead><tr><th>Heure</th>{DAYS.map((day) => <th key={day}>{day}</th>)}</tr></thead>
          <tbody>
            {HOURS.map((hour, index) => (
              <tr key={hour}>
                <td>{rangeLabel(hour, HOURS[index + 1] || '18:00')}</td>
                {DAYS.map((day) => {
                  const slot = cell(day, hour);
                  return (
                    <td key={day}>
                      {slot ? (
                        <div className="slot-card">
                          <b>{slot.subjectName || 'Cours'}</b>
                          <small>{slot.className || className}</small>
                          <small>{slot.teacherName}</small>
                          <small>{slot.room || 'Salle à définir'}</small>
                          <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer ce créneau ?')) return; await api(`/api/timetable/${slot.id}`, { method: 'DELETE' }); refresh(); }}>×</button>
                        </div>
                      ) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="panel form-grid" onSubmit={add}>
        <div className="form-field"><label>Jour</label><select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></div>
        <div className="form-field"><label>Début</label><select value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })}>{HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></div>
        <div className="form-field"><label>Fin</label><input value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></div>
        <div className="form-field"><label>Matière</label><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}><option value="">—</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="form-field"><label>Enseignant</label><select value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}><option value="">—</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></div>
        <div className="form-field"><label>Salle</label><input value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="Salle 204" /></div>
        <div className="form-field"><label>&nbsp;</label><button className="btn" type="submit">Placer le cours</button></div>
      </form>
    </div>
  );
}

export default Timetable;
