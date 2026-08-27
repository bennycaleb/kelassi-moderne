import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { TERMS } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';
import { getCourses } from '../../services/course';
import { getStudents } from '../../services/student';

function TeacherEvaluations() {
  const { year, classes, cycles, evaluationTypes } = useSchool();
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [evaluationId, setEvaluationId] = useState('');
  const [scores, setScores] = useState({});
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ typeId: '', title: '', date: '', term: TERMS[0] });

  const classroom = classes.find((item) => item.id === classId);
  const cycle = cycles.find((item) => item.id === classroom?.cycleId) || cycles.find((item) => item.code === 'college');
  const cycleTypes = evaluationTypes.filter((item) => item.cycleId === cycle?.id);
  const classCourses = useMemo(
    () => courses.filter((item) => !classId || item.classId === classId),
    [courses, classId]
  );
  const visibleClasses = useMemo(() => {
    const ids = new Set(courses.map((item) => item.classId));
    const filtered = classes.filter((item) => ids.has(item.id));
    return filtered.length ? filtered : classes;
  }, [classes, courses]);
  const current = evaluations.find((item) => item.id === evaluationId);
  const rulesLink = window.location.pathname.startsWith('/teacher') ? '/teacher/academic' : '/dashboard/academic';

  async function refresh() {
    const query = [
      classId ? `classId=${classId}` : '',
      courseId ? `courseId=${courseId}` : ''
    ].filter(Boolean).join('&');
    const [courseData, evalData, studentData] = await Promise.all([
      getCourses(),
      api(`/api/academic/evaluations${query ? `?${query}` : ''}`),
      getStudents(classId ? `?classId=${classId}` : '')
    ]);
    setCourses(courseData.courses);
    setEvaluations(evalData.evaluations || []);
    setStudents(studentData.students);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year, classId, courseId]);

  useEffect(() => {
    if (!courseId && classCourses[0]) setCourseId(classCourses[0].id);
  }, [classCourses, courseId]);

  useEffect(() => {
    if (!evaluationId) {
      setScores({});
      return;
    }
    const query = courseId ? `?courseId=${courseId}` : '';
    api(`/api/grades${query}`).then((data) => {
      const related = (data.grades || []).filter((item) => item.evaluationId === evaluationId);
      const next = {};
      students.forEach((student) => {
        const existing = related.find((grade) => grade.studentId === student.id);
        next[student.id] = existing ? String(existing.score) : '';
      });
      setScores(next);
    }).catch(() => {});
  }, [evaluationId, courseId, students]);

  async function createEvaluation(event) {
    event.preventDefault();
    const type = cycleTypes.find((item) => item.id === form.typeId);
    const created = await api('/api/academic/evaluations', {
      method: 'POST',
      body: {
        classId,
        courseId,
        typeId: form.typeId,
        title: form.title || type?.name,
        date: form.date,
        term: form.term
      }
    });
    setOpen(false);
    setForm({ typeId: '', title: '', date: '', term: TERMS[0] });
    setMessage('Évaluation créée. Saisissez maintenant les notes des élèves.');
    await refresh();
    setEvaluationId(created.evaluation.id);
  }

  async function saveScores(event) {
    event.preventDefault();
    const payload = Object.entries(scores)
      .filter(([, value]) => value !== '')
      .map(([studentId, score]) => ({ studentId, score: Number(score) }));
    if (!payload.length) return;
    await api(`/api/academic/evaluations/${evaluationId}/scores`, {
      method: 'POST',
      body: { scores: payload }
    });
    setMessage('Notes enregistrées. Le coefficient / pourcentage de l’école a été appliqué.');
  }

  const weightLabel = current
    ? (current.gradingMode === 'percent' ? `${current.weightPercent || current.coefficient} %` : `coef. ${current.coefficient}`)
    : '';

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Mes évaluations</h1>
          <p>Classe → matière → évaluation. Les notes des élèves restent sur 20 ; le poids est celui défini par l’école.</p>
        </div>
        <div className="row-actions">
          <Link className="btn btn-secondary" to={rulesLink}>Créer / modifier les règles</Link>
          <button type="button" className="btn" disabled={!classId || !courseId || !cycleTypes.length} onClick={() => setOpen(true)}>
            Nouvelle évaluation
          </button>
        </div>
      </div>
      {message && <div className="credentials-box">{message}</div>}

      <div className="panel form-grid">
        <div className="form-field">
          <label>Classe</label>
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setCourseId(''); setEvaluationId(''); }}>
            <option value="">Choisir</option>
            {visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Matière</label>
          <select value={courseId} onChange={(event) => { setCourseId(event.target.value); setEvaluationId(''); }}>
            <option value="">Choisir</option>
            {classCourses.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.className}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Cycle / règles</label>
          <input readOnly value={cycle ? `${cycle.name} · ${cycle.gradingMode === 'percent' ? 'pourcentages' : 'coefficients'}` : '—'} />
        </div>
      </div>

      <div className="panel">
        <h2>Évaluations de cette matière</h2>
        {!evaluations.length && <p>Aucune évaluation pour le moment. Créez-en une à partir des types définis par l’école.</p>}
        <div className="eval-list">
          {evaluations.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`eval-chip ${item.id === evaluationId ? 'active' : ''}`}
              onClick={() => setEvaluationId(item.id)}
            >
              <b>{item.title}</b>
              <span>{item.typeName} · {item.date || ''} · {item.term}</span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <form className="panel" onSubmit={saveScores}>
          <div className="page-toolbar">
            <div>
              <h2>{current.title}</h2>
              <p>{current.typeName} · {weightLabel} · max {current.maxScore || 20}</p>
            </div>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (!window.confirm(`Supprimer l’évaluation « ${current.title} » et ses notes ?`)) return;
                await api(`/api/academic/evaluations/${current.id}`, { method: 'DELETE' });
                setEvaluationId('');
                refresh();
              }}
            >
              Supprimer
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Note / {current.maxScore || 20}</th>
                <th>Poids appliqué</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.lastName} {student.firstName}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={current.maxScore || 20}
                      step="0.1"
                      value={scores[student.id] ?? ''}
                      onChange={(event) => setScores((currentScores) => ({ ...currentScores, [student.id]: event.target.value }))}
                    />
                  </td>
                  <td>{weightLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="btn" type="submit">Enregistrer les notes</button>
          </div>
        </form>
      )}

      {open && (
        <Modal title="Nouvelle évaluation" onClose={() => setOpen(false)}>
          <form onSubmit={createEvaluation}>
            <div className="form-grid">
              <div className="form-field full">
                <label>Type défini par l’école</label>
                <select value={form.typeId} onChange={(event) => setForm({ ...form, typeId: event.target.value, title: form.title || cycleTypes.find((item) => item.id === event.target.value)?.name || '' })} required>
                  <option value="">Choisir</option>
                  {cycleTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} — {cycle?.gradingMode === 'percent' ? `${type.weightPercent || 0} %` : `coef. ${type.coefficient}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Titre</label>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Devoir n°1, EPR mars…" />
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </div>
              <div className="form-field">
                <label>Trimestre</label>
                <select value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}>
                  {TERMS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Créer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default TeacherEvaluations;
