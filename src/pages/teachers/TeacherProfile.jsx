import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import PresenceMark from '../../components/PresenceMark';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

const TABS = [
  { id: 'classes', label: 'Classes' },
  { id: 'edt', label: 'Emploi du temps' },
  { id: 'presences', label: 'Présences' },
  { id: 'notes', label: 'Notes' },
  { id: 'cours', label: 'Cours' }
];

function TeacherProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { year } = useSchool();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('classes');

  useEffect(() => {
    api(`/api/teachers/${id}`).then(setData).catch(() => {});
  }, [id, year]);

  if (!data) return <p>Chargement…</p>;
  const { teacher, courses, classes, timetable, grades, attendance, presenceRate } = data;
  const subjectLabel = (teacher.subjects || []).join(', ') || teacher.subject || 'Enseignant';

  async function reload() {
    setData(await api(`/api/teachers/${id}`));
  }

  async function removeTeacher() {
    if (!window.confirm(`Supprimer ${teacher.firstName} ${teacher.lastName} et son compte ?`)) return;
    await api(`/api/teachers/${id}`, { method: 'DELETE' });
    navigate('/dashboard/teachers');
  }

  return (
    <div>
      <Link to="/dashboard/teachers" className="back-link">← Tous les enseignants</Link>
      <div className="page-toolbar">
        <div className="profile-head">
          <Avatar src={teacher.photo} name={teacher.firstName} size="profile" />
          <div>
            <h1>{teacher.lastName} {teacher.firstName}</h1>
            <p>Professeur de {subjectLabel}</p>
            <p>{teacher.email} · {teacher.phone || 'Pas de téléphone'} · {teacher.status}</p>
          </div>
        </div>
        <button type="button" className="btn btn-danger" onClick={removeTeacher}>Supprimer</button>
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>

      {tab === 'classes' && (
        <div className="panel">
          {(classes || []).map((item) => (
            <p key={item.id}><Link to={`/dashboard/classes/${item.id}`}>{item.name}</Link> — {item.studentsCount} étudiants · moyenne {item.average || '—'}/20</p>
          ))}
          {!classes?.length && <p>Aucune classe attribuée via un cours.</p>}
        </div>
      )}

      {tab === 'edt' && (
        <div className="panel">
          {timetable.map((slot) => (
            <p key={slot.id}>
              {slot.day} — {slot.startTime}–{slot.endTime} · {slot.subjectName} — {slot.className} — {slot.room || 'Salle à définir'}
              <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 8 }} onClick={async () => {
                if (!window.confirm('Supprimer ce créneau ?')) return;
                await api(`/api/timetable/${slot.id}`, { method: 'DELETE' });
                reload();
              }}>Supprimer</button>
            </p>
          ))}
          {!timetable.length && <p>Aucun créneau pour cet enseignant.</p>}
        </div>
      )}

      {tab === 'presences' && (
        <div className="panel">
          <p>Taux de présence sur les classes : {presenceRate || 0} %</p>
          <table>
            <thead><tr><th>Date</th><th>Étudiant</th><th>Classe</th><th>Statut</th></tr></thead>
            <tbody>
              {(attendance || []).slice(0, 80).map((item) => (
                <tr key={item.id}><td>{item.date}</td><td>{item.studentName}</td><td>{item.className}</td><td><PresenceMark status={item.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'notes' && (
        <div className="panel">
          <table>
            <thead><tr><th>Étudiant</th><th>Cours</th><th>Évaluation</th><th>Note</th></tr></thead>
            <tbody>
              {(grades || []).map((grade) => (
                <tr key={grade.id}><td>{grade.studentName}</td><td>{grade.courseTitle}</td><td>{grade.label}</td><td>{grade.score}/20</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cours' && (
        <div className="panel">
          {courses.map((course) => (
            <p key={course.id}>
              {course.title} — {course.className} ({course.hours}h, {course.room || 'salle à définir'})
              <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 8 }} onClick={async () => {
                if (!window.confirm('Supprimer ce cours ?')) return;
                await api(`/api/courses/${course.id}`, { method: 'DELETE' });
                reload();
              }}>Supprimer</button>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeacherProfile;
