import React, { useEffect, useMemo, useState } from 'react';
import { GRADE_LABELS, TERMS } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';
import { deleteGrade, getGrades } from '../../services/grade';
import { getStudents } from '../../services/student';
import { getCourses } from '../../services/course';

function Grades() {
  const { year, classes, cycles, evaluationTypes } = useSchool();
  const [grades, setGrades] = useState([]);
  const [average, setAverage] = useState(0);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [label, setLabel] = useState(GRADE_LABELS[0]);
  const [term, setTerm] = useState(TERMS[0]);
  const [coefficient, setCoefficient] = useState('2');
  const [scores, setScores] = useState({});
  const [message, setMessage] = useState('');

  const classCourses = useMemo(
    () => courses.filter((item) => !classId || item.classId === classId),
    [courses, classId]
  );
  const classroom = classes.find((item) => item.id === classId);
  const cycle = cycles.find((item) => item.id === classroom?.cycleId);
  const cycleTypes = evaluationTypes.filter((item) => item.cycleId === cycle?.id);
  const selectedType = cycleTypes.find((item) => item.id === typeId);
  const coefLocked = Boolean(cycle && selectedType && cycle.teacherCanEditCoefficient === false);
  const weightLabel = cycle?.gradingMode === 'percent' ? 'Poids %' : 'Coefficient';

  function applyType(nextTypeId, nextLabel) {
    const type = cycleTypes.find((item) => item.id === nextTypeId);
    if (type) {
      setTypeId(type.id);
      setLabel(type.name);
      setCoefficient(String(cycle?.gradingMode === 'percent' ? (type.weightPercent || 1) : (type.coefficient || 1)));
      return;
    }
    setTypeId('');
    setLabel(nextLabel || GRADE_LABELS[0]);
  }

  async function refresh() {
    const query = [
      classId ? `classId=${classId}` : '',
      courseId ? `courseId=${courseId}` : ''
    ].filter(Boolean).join('&');
    const [gradeData, studentData, courseData] = await Promise.all([
      getGrades(query ? `?${query}` : ''),
      getStudents(classId ? `?classId=${classId}` : ''),
      getCourses()
    ]);
    setGrades(gradeData.grades);
    setAverage(gradeData.average || 0);
    setStudents(studentData.students);
    setCourses(courseData.courses);
    const next = {};
    studentData.students.forEach((student) => {
      const existing = gradeData.grades.find((grade) => grade.studentId === student.id && grade.courseId === courseId && grade.label === label);
      next[student.id] = existing ? String(existing.score) : '';
    });
    setScores(next);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year, classId, courseId, label]);

  useEffect(() => {
    if (!courseId && classCourses[0]) setCourseId(classCourses[0].id);
  }, [classCourses, courseId]);

  useEffect(() => {
    if (cycleTypes.length && (!typeId || !cycleTypes.some((item) => item.id === typeId))) {
      applyType(cycleTypes[0].id);
    }
    if (!cycleTypes.length && typeId) setTypeId('');
  }, [classId, cycle?.id, cycleTypes.length]);

  const liveAverage = useMemo(() => {
    const values = Object.values(scores).map(Number).filter((value) => !Number.isNaN(value) && value >= 0);
    if (!values.length) return average;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }, [scores, average]);

  async function saveGrid(event) {
    event.preventDefault();
    const payload = Object.entries(scores)
      .filter(([, value]) => value !== '')
      .map(([studentId, score]) => ({ studentId, score: Number(score) }));
    await api('/api/grades/bulk', {
      method: 'POST',
      body: { courseId, label, term, coefficient: Number(coefficient), typeId, scores: payload }
    });
    setMessage('Notes enregistrées. Les moyennes sont recalculées automatiquement.');
    refresh();
  }

  const className = classroom?.name || 'Toutes les classes';
  const course = courses.find((item) => item.id === courseId);

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Notes</h1>
          <p>Classe → Matière → Évaluation. Moyenne calculée : <b>{liveAverage || '—'}/20</b></p>
        </div>
        {classId && <a className="btn btn-secondary" href={`/print/bulletin?classId=${classId}`} target="_blank" rel="noreferrer">Générer les bulletins</a>}
      </div>
      {message && <div className="credentials-box">{message}</div>}
      <form className="panel form-grid" onSubmit={saveGrid}>
        <div className="form-field">
          <label>Classe</label>
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setCourseId(''); }}>
            <option value="">Toutes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Matière</label>
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Choisir</option>
            {classCourses.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.className}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Évaluation</label>
          <select
            value={typeId || label}
            onChange={(event) => {
              const value = event.target.value;
              const type = cycleTypes.find((item) => item.id === value);
              applyType(type ? type.id : '', type ? type.name : value);
            }}
          >
            {cycleTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} {cycle?.gradingMode === 'percent' ? `(${type.weightPercent || 0} %)` : `(coef. ${type.coefficient})`}
              </option>
            ))}
            {GRADE_LABELS.filter((item) => !cycleTypes.some((type) => type.name === item)).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Trimestre</label>
          <select value={term} onChange={(event) => setTerm(event.target.value)}>{TERMS.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="form-field">
          <label>{weightLabel}{coefLocked ? ' (règle école)' : ''}</label>
          <input type="number" min="0" value={coefficient} disabled={coefLocked} onChange={(event) => setCoefficient(event.target.value)} />
        </div>
        <div className="form-field">
          <label>&nbsp;</label>
          <button className="btn" type="submit" disabled={!courseId}>Enregistrer les notes</button>
        </div>
      </form>

      {courseId && (
        <div className="panel">
          <h2>{className} · {course?.title || 'Matière'} · {label}</h2>
          <table>
            <thead><tr><th>Étudiant</th><th>Note / 20</th><th>{weightLabel}</th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.lastName} {student.firstName}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      value={scores[student.id] ?? ''}
                      onChange={(event) => setScores((current) => ({ ...current, [student.id]: event.target.value }))}
                    />
                  </td>
                  <td>{coefficient}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <h2>Toutes les notes</h2>
        <table>
          <thead><tr><th>Étudiant</th><th>Cours</th><th>Évaluation</th><th>Trimestre</th><th>Note</th><th>Coef.</th><th></th></tr></thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade.id}>
                <td>{grade.studentName}</td>
                <td>{grade.courseTitle}</td>
                <td>{grade.type || grade.label}</td>
                <td>{grade.term}</td>
                <td><b>{grade.score}/20</b></td>
                <td>{grade.coefficient}</td>
                <td><button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer cette note ?')) return; await deleteGrade(grade.id); refresh(); }}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Grades;
