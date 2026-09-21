import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import PresenceMark from '../../components/PresenceMark';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

function LifeAttendance() {
  if (currentRole() !== 'supervisor') {
    return <Navigate to="/dashboard/attendance" replace />;
  }
  return <LifeAttendanceBoard />;
}

function LifeAttendanceBoard() {
  const { year, classes } = useSchool();
  const [params] = useSearchParams();
  const focus = params.get('status') || '';
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, arrived: 0, absent: 0, late: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    const query = [`date=${date}`];
    if (classId) query.push(`classId=${classId}`);
    api(`/api/attendance?${query.join('&')}`)
      .then((data) => {
        setRecords(data.attendance || []);
        setSummary(data.summary || { present: 0, arrived: 0, absent: 0, late: 0 });
      })
      .catch((err) => setError(err.message));
  }, [classId, date, year]);

  const rows = focus ? records.filter((item) => item.status === focus) : records;
  const title = focus === 'retard' ? 'Retards' : focus === 'absent' ? 'Absences' : 'Présences & absences';

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>{title}</h1>
          <p>Consultation uniquement. Pour enregistrer une entrée ou une sortie, utilisez le <Link to="/dashboard/face">scan visage</Link>.</p>
        </div>
        <Link className="btn" to="/dashboard/face">Scan entrée / sortie</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel form-grid">
        <div className="form-field">
          <label>Classe</label>
          <select value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Toutes les classes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Date</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Résumé</label>
          <p>🟢 {summary.present} présents · 🔵 {summary.arrived} arrivés · 🔴 {summary.absent} absents · 🟡 {summary.late} retards</p>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                <th>Classe</th>
                <th>Statut</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="6">Aucun mouvement pour ce filtre.</td></tr>
              ) : rows.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.studentName}</strong></td>
                  <td>{item.className}</td>
                  <td><PresenceMark status={item.status} /> {item.status}</td>
                  <td>{item.arrivedAtLabel || '—'}</td>
                  <td>{item.leftAtLabel || '—'}</td>
                  <td>{item.method === 'facial' ? 'Scan visage' : 'Manuel'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LifeAttendance;
