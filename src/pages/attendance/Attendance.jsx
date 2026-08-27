import React, { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar';
import PresenceMark from '../../components/PresenceMark';
import { ATTENDANCE_STATUSES } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';

function Attendance() {
  const { year, classes } = useSchool();
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0 });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (classes[0] && !classId) setClassId(classes[0].id);
  }, [classes, classId]);

  useEffect(() => {
    if (!classId) return;
    Promise.all([
      api(`/api/students?classId=${classId}`),
      api(`/api/attendance?classId=${classId}&date=${date}`)
    ]).then(([studentData, attendanceData]) => {
      setStudents(studentData.students);
      setSummary(attendanceData.summary);
      const map = {};
      studentData.students.forEach((student) => {
        const existing = attendanceData.attendance.find((item) => item.studentId === student.id);
        map[student.id] = { status: existing?.status || 'présent', justified: existing?.justified || false, method: existing?.method || 'manuel' };
      });
      setRecords(map);
      setSaved('');
    }).catch(() => {});
  }, [classId, date, year]);

  const className = classes.find((item) => item.id === classId)?.name || '';

  async function save() {
    await api('/api/attendance/bulk', {
      method: 'POST',
      body: {
        classId,
        date,
        records: Object.entries(records).map(([studentId, value]) => ({ studentId, ...value }))
      }
    });
    const attendanceData = await api(`/api/attendance?classId=${classId}&date=${date}`);
    setSummary(attendanceData.summary);
    setSaved('Présences enregistrées.');
  }

  function setStatus(studentId, status) {
    setRecords((current) => ({ ...current, [studentId]: { ...current[studentId], status } }));
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Présences</h1>
          <p>Classe : {className || '—'} · Date : {new Date(date).toLocaleDateString('fr-FR')}</p>
        </div>
        <button type="button" className="btn" onClick={save}>Enregistrer les présences</button>
      </div>
      {saved && <div className="credentials-box">{saved}</div>}
      <div className="panel form-grid">
        <div className="form-field">
          <label>Classe</label>
          <select value={classId} onChange={(event) => setClassId(event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </div>
        <div className="form-field">
          <label>Date</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Résumé</label>
          <p>🟢 {summary.present} présents · 🔴 {summary.absent} absents · 🟡 {summary.late} retards</p>
        </div>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>Étudiant</th><th>Statut</th><th>Justifié</th><th>Mode</th></tr></thead>
          <tbody>
            {students.map((student) => {
              const status = records[student.id]?.status || 'présent';
              return (
                <tr key={student.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar src={student.photo} name={student.firstName} />
                      {student.lastName} {student.firstName}
                    </div>
                  </td>
                  <td>
                    <div className="presence-actions">
                      {ATTENDANCE_STATUSES.map((item) => (
                        <button
                          type="button"
                          key={item.value}
                          className={`presence-btn ${item.value} ${status === item.value ? 'on' : ''}`}
                          onClick={() => setStatus(student.id, item.value)}
                        >
                          <PresenceMark status={item.value} />
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input type="checkbox" checked={Boolean(records[student.id]?.justified)} onChange={(event) => setRecords((current) => ({ ...current, [student.id]: { ...current[student.id], justified: event.target.checked } }))} />
                  </td>
                  <td>{records[student.id]?.method === 'facial' ? 'Visage' : 'Manuel'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Attendance;
