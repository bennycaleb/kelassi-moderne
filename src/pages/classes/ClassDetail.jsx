import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import PresenceMark from '../../components/PresenceMark';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

const TABS = [
  { id: 'etudiants', label: 'Liste des étudiants' },
  { id: 'matieres', label: 'Matières' },
  { id: 'enseignants', label: 'Enseignants' },
  { id: 'edt', label: 'Emploi du temps' },
  { id: 'notes', label: 'Notes' },
  { id: 'absences', label: 'Absences' }
];

function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { year } = useSchool();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('etudiants');

  useEffect(() => {
    api(`/api/classes/${id}`).then(setData).catch(() => {});
  }, [id, year]);

  if (!data) return <p>Chargement…</p>;
  const { class: classroom, students, courses, teachers, timetable, grades, attendance, average, presenceRate } = data;

  async function reload() {
    setData(await api(`/api/classes/${id}`));
  }

  async function removeClass() {
    if (!window.confirm(`Supprimer la classe « ${classroom.name} » ?`)) return;
    await api(`/api/classes/${classroom.id}`, { method: 'DELETE' });
    navigate('/dashboard/classes');
  }

  return (
    <div>
      <Link to="/dashboard/classes" className="back-link">← Classes</Link>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>{classroom.name}</h1>
          <p>{classroom.cycleName || classroom.level || ''} · {classroom.studentsCount || students.length} étudiants · Professeur principal : {classroom.mainTeacherName || '—'} · Moyenne générale : {average || '—'}/20 · Présence : {presenceRate || 0} %</p>
        </div>
        <div className="row-actions">
          <a className="btn" href={`/print/bulletin?classId=${classroom.id}`} target="_blank" rel="noreferrer">Générer les bulletins</a>
          <Link className="btn btn-secondary" to="/dashboard/attendance">Faire l’appel</Link>
          <button type="button" className="btn btn-danger" onClick={removeClass}>Supprimer</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>

      {tab === 'etudiants' && (
        <div className="panel">
          <table>
            <thead><tr><th>Rang</th><th>Moyenne</th><th>Scolarité</th><th>Matricule</th><th>Étudiant</th><th>Téléphone</th><th></th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td><b>{student.rankLabel || '—'}</b>{student.classSize ? ` / ${student.classSize}` : ''}</td>
                  <td>{student.average ? `${student.average}/20` : '—'}</td>
                  <td><span className={student.tuitionStatus === 'payé' ? 'badge badge-success' : student.tuitionStatus === 'partiel' ? 'badge badge-warning' : student.tuitionStatus === 'impayé' ? 'badge badge-danger' : 'badge'}>{student.tuitionLabel || '—'}</span></td>
                  <td>{student.matricule}</td>
                  <td><div className="person-cell"><Avatar src={student.photo} name={student.firstName} />{student.lastName} {student.firstName}</div></td>
                  <td>{student.phone || '—'}</td>
                  <td><Link className="btn btn-secondary btn-sm" to={`/dashboard/students/${student.id}`}>Voir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'matieres' && (
        <div className="panel">
          {courses.map((course) => (
            <p key={course.id}>
              {course.title} — {course.teacherName} ({course.hours}h)
              <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 8 }} onClick={async () => {
                if (!window.confirm('Supprimer ce cours ?')) return;
                await api(`/api/courses/${course.id}`, { method: 'DELETE' });
                reload();
              }}>Supprimer</button>
            </p>
          ))}
          {!courses.length && <p>Aucune matière n’est encore attribuée.</p>}
        </div>
      )}

      {tab === 'enseignants' && (
        <div className="panel">
          {teachers?.map((teacher) => (
            <p key={teacher.id}><Link to={`/dashboard/teachers/${teacher.id}`}>{teacher.firstName} {teacher.lastName}</Link> — {(teacher.subjects || []).join(', ') || teacher.subject}</p>
          ))}
          {classroom.mainTeacherName && <p>Professeur principal : <b>{classroom.mainTeacherName}</b></p>}
          {!teachers?.length && <p>Aucun enseignant rattaché via un cours.</p>}
        </div>
      )}

      {tab === 'edt' && (
        <div className="panel">
          {timetable.map((slot) => (
            <p key={slot.id}>
              {slot.day} — {slot.startTime}–{slot.endTime} · {slot.subjectName} — {classroom.name} — {slot.room || 'Salle à définir'}
              <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 8 }} onClick={async () => {
                if (!window.confirm('Supprimer ce créneau ?')) return;
                await api(`/api/timetable/${slot.id}`, { method: 'DELETE' });
                reload();
              }}>Supprimer</button>
            </p>
          ))}
          {!timetable.length && <p>Aucun créneau. Ajoutez-les dans Emploi du temps.</p>}
        </div>
      )}

      {tab === 'notes' && (
        <div className="panel">
          <p>Moyenne de classe : <b>{average || '—'}/20</b></p>
          <table>
            <thead><tr><th>Étudiant</th><th>Matière</th><th>Évaluation</th><th>Note</th><th>Coef.</th></tr></thead>
            <tbody>
              {grades.map((grade) => (
                <tr key={grade.id}><td>{grade.studentName}</td><td>{grade.courseTitle}</td><td>{grade.label}</td><td>{grade.score}/20</td><td>{grade.coefficient}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'absences' && (
        <div className="panel">
          <table>
            <thead><tr><th>Date</th><th>Étudiant</th><th>Statut</th><th>Entrée</th><th>Sortie</th></tr></thead>
            <tbody>
              {attendance.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>{item.studentName}</td>
                  <td><PresenceMark status={item.status} /></td>
                  <td>{item.arrivedAtLabel || '—'}</td>
                  <td>{item.leftAtLabel || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!attendance.length && <p>Aucune présence enregistrée.</p>}
        </div>
      )}
    </div>
  );
}

export default ClassDetail;
