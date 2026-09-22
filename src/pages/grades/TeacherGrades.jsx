import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GRADE_LABELS, TERMS } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';
import { getCourses } from '../../services/course';
import { getGrades } from '../../services/grade';
import { getStudents } from '../../services/student';

function shortAppreciation(average) {
  if (average == null) return '—';
  if (average >= 16) return 'Très bien';
  if (average >= 14) return 'Bien';
  if (average >= 12) return 'Assez bien';
  if (average >= 10) return 'Passable';
  return 'Insuffisant';
}

function appreciationClass(label) {
  if (label === 'Très bien') return 'grade-pill grade-pill-best';
  if (label === 'Bien') return 'grade-pill grade-pill-good';
  if (label === 'Assez bien') return 'grade-pill grade-pill-mid';
  if (label === 'Passable') return 'grade-pill grade-pill-ok';
  if (label === 'Insuffisant') return 'grade-pill grade-pill-low';
  return 'grade-pill';
}

function weightedAverage(entries) {
  const valid = entries.filter((item) => item.score !== '' && item.score !== undefined && !Number.isNaN(Number(item.score)));
  if (!valid.length) return null;
  const totalCoef = valid.reduce((sum, item) => sum + Number(item.coefficient || 1), 0);
  const total = valid.reduce((sum, item) => sum + Number(item.score) * Number(item.coefficient || 1), 0);
  return totalCoef ? Math.round((total / totalCoef) * 10) / 10 : null;
}

function matchGrade(grades, studentId, courseId, term, column) {
  return grades.find((grade) => (
    grade.studentId === studentId
    && grade.courseId === courseId
    && grade.term === term
    && (
      (column.typeId && grade.typeId === column.typeId)
      || grade.label === column.label
      || grade.type === column.label
    )
  ));
}

function TeacherGrades() {
  const { year, classes, cycles, evaluationTypes, subjects } = useSchool();
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [term, setTerm] = useState(TERMS[0]);
  const [scores, setScores] = useState({});
  const [savedScores, setSavedScores] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extraColumns, setExtraColumns] = useState([]);
  const [adding, setAdding] = useState(false);
  const [extraForm, setExtraForm] = useState({ label: '', coefficient: '1' });
  const [coefOverrides, setCoefOverrides] = useState({});

  const course = courses.find((item) => item.id === courseId) || courses[0];
  const classroom = classes.find((item) => item.id === course?.classId);
  const cycle = cycles.find((item) => item.id === classroom?.cycleId)
    || cycles.find((item) => item.name === classroom?.level);
  const subject = subjects.find((item) => item.id === course?.subjectId);
  const baseColumns = useMemo(() => {
    const cycleTypes = evaluationTypes
      .filter((item) => item.cycleId === cycle?.id)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const fromTypes = cycleTypes.map((type) => ({
      key: type.id,
      typeId: type.id,
      label: type.name,
      coefficient: cycle?.gradingMode === 'percent' ? Number(type.weightPercent || type.coefficient || 1) : Number(type.coefficient || 1),
      custom: false
    }));
    if (fromTypes.length) return fromTypes;
    return GRADE_LABELS.slice(0, 4).map((label, index) => ({
      key: label,
      typeId: '',
      label,
      coefficient: index === 3 ? 4 : index === 2 ? 2 : 1,
      custom: false
    }));
  }, [cycle?.gradingMode, cycle?.id, evaluationTypes]);

  const columns = useMemo(() => {
    const list = [...baseColumns];
    const seen = new Set(list.map((item) => item.label.toLowerCase()));
    extraColumns.forEach((column) => {
      if (seen.has(column.label.toLowerCase())) return;
      list.push(column);
      seen.add(column.label.toLowerCase());
    });
    return list;
  }, [baseColumns, extraColumns]);

  const subjectCoefficient = columns.reduce((sum, column) => sum + Number((coefOverrides[column.key] ?? column.coefficient) || 1), 0) || Number(subject?.coefficient || 1);

  useEffect(() => {
    getCourses()
      .then((data) => {
        const list = data.courses || [];
        setCourses(list);
        setCourseId((current) => current && list.some((item) => item.id === current) ? current : (list[0]?.id || ''));
      })
      .catch((err) => setError(err.message));
  }, [year]);

  async function refresh() {
    if (!course?.classId || !course.id) {
      setStudents([]);
      setGrades([]);
      setScores({});
      setSavedScores({});
      return;
    }
    const [studentData, gradeData] = await Promise.all([
      getStudents(`?classId=${course.classId}`),
      getGrades(`?classId=${course.classId}&courseId=${course.id}`)
    ]);
    const list = studentData.students || [];
    const rows = (gradeData.grades || []).filter((item) => item.term === term);
    setExtraColumns((current) => {
      const seen = new Set([...baseColumns, ...current].map((item) => item.label.toLowerCase()));
      const next = [...current];
      rows.forEach((grade) => {
        const label = grade.label || grade.type;
        if (!label || seen.has(label.toLowerCase())) return;
        seen.add(label.toLowerCase());
        next.push({
          key: `disc-${label}`,
          typeId: grade.typeId || '',
          label,
          coefficient: Number(grade.coefficient || 1) || 1,
          custom: true
        });
      });
      return next;
    });
    setStudents(list);
    setGrades(rows);
  }

  useEffect(() => {
    setExtraColumns([]);
    setAdding(false);
    setCoefOverrides({});
  }, [course?.id, term]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [course?.id, course?.classId, term, baseColumns.map((item) => item.key).join('|')]);

  useEffect(() => {
    if (!students.length) {
      setScores({});
      setSavedScores({});
      return;
    }
    const next = {};
    students.forEach((student) => {
      next[student.id] = {};
      columns.forEach((column) => {
        const existing = matchGrade(grades, student.id, course.id, term, column);
        next[student.id][column.key] = scores[student.id]?.[column.key] ?? (existing ? String(existing.score) : '');
      });
    });
    setScores(next);
    setSavedScores((current) => {
      const saved = {};
      students.forEach((student) => {
        saved[student.id] = {};
        columns.forEach((column) => {
          const existing = matchGrade(grades, student.id, course.id, term, column);
          saved[student.id][column.key] = existing ? String(existing.score) : (current[student.id]?.[column.key] ?? '');
        });
      });
      return saved;
    });
  }, [students, grades, columns.map((item) => `${item.key}:${item.label}`).join('|'), course?.id, term]);

  function setScore(studentId, columnKey, value) {
    setScores((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] || {}), [columnKey]: value }
    }));
  }

  function addColumn(event) {
    event.preventDefault();
    const label = extraForm.label.trim();
    const coefficient = Number(extraForm.coefficient);
    if (!label) {
      setError('Donnez un nom à cette évaluation (ex. Contrôle 3, Interrogation, Devoir).');
      return;
    }
    if (Number.isNaN(coefficient) || coefficient <= 0) {
      setError('Le coefficient doit être supérieur à 0.');
      return;
    }
    if (columns.some((column) => column.label.toLowerCase() === label.toLowerCase())) {
      setError('Cette évaluation existe déjà pour ce cours.');
      return;
    }
    const key = `custom-${Date.now()}`;
    setExtraColumns((current) => [...current, { key, typeId: '', label, coefficient, custom: true }]);
    setExtraForm({ label: '', coefficient: '1' });
    setAdding(false);
    setError('');
    setMessage(`« ${label} » a été ajouté. Saisissez les notes, puis enregistrez : la moyenne se recalcule toute seule.`);
  }

  function removeColumn(column) {
    if (!column.custom) return;
    if (!window.confirm(`Retirer « ${column.label} » de ce tableau ?`)) return;
    setExtraColumns((current) => current.filter((item) => item.key !== column.key));
  }

  function columnCoef(column) {
    const raw = coefOverrides[column.key];
    if (raw === undefined || raw === '') return Number(column.coefficient || 1);
    const value = Number(raw);
    return Number.isNaN(value) || value <= 0 ? Number(column.coefficient || 1) : value;
  }

  function studentAverage(studentId) {
    return weightedAverage(columns.map((column) => ({
      score: scores[studentId]?.[column.key],
      coefficient: columnCoef(column)
    })));
  }

  function columnAverage(column) {
    return weightedAverage(students.map((student) => ({
      score: scores[student.id]?.[column.key],
      coefficient: 1
    })));
  }

  const classAverages = students.map((student) => studentAverage(student.id)).filter((value) => value != null);
  const classAverage = classAverages.length
    ? Math.round((classAverages.reduce((sum, value) => sum + value, 0) / classAverages.length) * 100) / 100
    : 0;
  const successRate = students.length
    ? Math.round((classAverages.filter((value) => value >= 10).length / students.length) * 100)
    : 0;
  const distribution = ['Très bien', 'Bien', 'Assez bien', 'Passable', 'Insuffisant'].map((label) => ({
    label,
    count: students.filter((student) => shortAppreciation(studentAverage(student.id)) === label).length
  }));

  async function saveAll() {
    if (!course) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      for (const column of columns) {
        const payload = students
          .map((student) => ({ studentId: student.id, score: scores[student.id]?.[column.key] }))
          .filter((row) => row.score !== '' && row.score !== undefined && !Number.isNaN(Number(row.score)))
          .map((row) => ({ studentId: row.studentId, score: Number(row.score) }));
        if (!payload.length) continue;
        await api('/api/grades/bulk', {
          method: 'POST',
          body: {
            courseId: course.id,
            label: column.label,
            typeId: column.typeId,
            term,
            coefficient: columnCoef(column),
            scores: payload
          }
        });
      }
      setMessage('Notes enregistrées. Les moyennes et le bulletin se recalculent automatiquement.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !courses.length) return <p className="error">{error}</p>;
  if (!courses.length) {
    return (
      <div className="panel">
        <h1>Notes & évaluations</h1>
        <p>Aucun cours ne vous est encore attribué. L’administration doit vous affecter une matière et une classe.</p>
      </div>
    );
  }

  return (
    <div className="teacher-grade-desk">
      <div className="teacher-grade-head">
        <div>
          <p className="teacher-grade-crumb">Notes & évaluations · {course.title} · {course.className || classroom?.name}</p>
          <h1>{course.title}</h1>
          <p>
            {course.className || classroom?.name}
            {cycle ? ` · ${cycle.name} · ${cycle.gradingMode === 'percent' ? 'notation en %' : 'notation par coefficients'}` : ''}
            {' · '}Année scolaire {year}
          </p>
        </div>
        <div className="teacher-grade-meta">
          <label>
            Cours
            <select value={course.id} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((item) => (
                <option key={item.id} value={item.id}>{item.title} — {item.className}</option>
              ))}
            </select>
          </label>
          <label>
            Période
            <select value={term} onChange={(event) => setTerm(event.target.value)}>
              {TERMS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="teacher-grade-chip">
            {cycle?.gradingMode === 'percent' ? 'Poids total' : 'Coefficient'} : <b>{subjectCoefficient}{cycle?.gradingMode === 'percent' ? ' %' : ''}</b>
          </div>
        </div>
      </div>

      <div className="teacher-grade-tabs">
        <span className="active">Saisir les notes</span>
        <Link to="/teacher/evaluations">Évaluations</Link>
        <Link to="/teacher/academic">Règles de notation</Link>
      </div>

      <div className="teacher-grade-banner">
        <div>
          <strong>Enregistrement des notes</strong>
          <p>
            Politique {cycle?.name || 'de cette classe'} : {cycle?.gradingMode === 'percent' ? 'pourcentages' : 'coefficients'}.
            Elle ne s’applique pas aux autres cycles. Changez un poids si besoin, ou ajoutez un contrôle. La moyenne se calcule toute seule.
          </p>
        </div>
        <span className="teacher-grade-auto">Calcul automatique</span>
      </div>
      {message && <div className="credentials-box">{message}</div>}
      {error && <p className="error">{error}</p>}

      <div className="teacher-grade-layout">
        <div>
          <div className="teacher-eval-cards">
            {columns.map((column) => {
              const avg = columnAverage(column);
              return (
                <div key={column.key} className="teacher-eval-card">
                  <p>{column.label}</p>
                  <label className="teacher-coef-field">
                    {cycle?.gradingMode === 'percent' ? 'Poids %' : 'Coefficient'}
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={coefOverrides[column.key] ?? column.coefficient}
                      onChange={(event) => setCoefOverrides((current) => ({ ...current, [column.key]: event.target.value }))}
                    />
                  </label>
                  <b>{avg == null ? '— / 20' : `${avg} / 20`}</b>
                  {column.custom && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeColumn(column)}>Retirer</button>
                  )}
                </div>
              );
            })}
            <button type="button" className="teacher-eval-add" onClick={() => { setAdding(true); setError(''); }}>
              + Ajouter un contrôle
            </button>
          </div>
          {adding && (
            <form className="panel form-grid" onSubmit={addColumn}>
              <div className="form-field">
                <label>Nom de l’évaluation</label>
                <input
                  list="teacher-eval-names"
                  value={extraForm.label}
                  onChange={(event) => setExtraForm({ ...extraForm, label: event.target.value })}
                  placeholder="Contrôle 3, Interrogation, Devoir…"
                  required
                />
                <datalist id="teacher-eval-names">
                  {GRADE_LABELS.concat(['Contrôle 3', 'Contrôle 4', 'Interrogation', 'Devoir maison', 'TP', 'Oral']).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div className="form-field">
                <label>Coefficient</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={extraForm.coefficient}
                  onChange={(event) => setExtraForm({ ...extraForm, coefficient: event.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>&nbsp;</label>
                <div className="row-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>Annuler</button>
                  <button className="btn" type="submit">Ajouter</button>
                </div>
              </div>
            </form>
          )}

          <div className="panel table-wrap">
            <table className="teacher-grade-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nom et prénom</th>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label} ({columnCoef(column)})</th>
                  ))}
                  <th>Moyenne</th>
                  <th>Appréciation</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const average = studentAverage(student.id);
                  const label = shortAppreciation(average);
                  return (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td><b>{student.lastName} {student.firstName}</b></td>
                      {columns.map((column) => (
                        <td key={column.key}>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={scores[student.id]?.[column.key] ?? ''}
                            onChange={(event) => setScore(student.id, column.key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td><b>{average == null ? '—' : average.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}</b></td>
                      <td><span className={appreciationClass(label)}>{label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!students.length && <p className="empty-state">Aucun élève dans cette classe pour le moment.</p>}
          </div>

          <div className="teacher-grade-foot">
            <p>Les moyennes se calculent automatiquement selon les coefficients de chaque évaluation.</p>
            <div className="row-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setScores(JSON.parse(JSON.stringify(savedScores)))}>Réinitialiser</button>
              <button type="button" className="btn" disabled={saving || !students.length} onClick={saveAll}>
                {saving ? 'Enregistrement…' : 'Enregistrer les notes'}
              </button>
            </div>
          </div>
        </div>

        <aside className="teacher-grade-recap">
          <h2>Récapitulatif de la classe</h2>
          <div className="teacher-recap-stat"><span>Nombre d’élèves</span><b>{students.length}</b></div>
          <div className="teacher-recap-stat"><span>Moyenne générale</span><b>{classAverages.length ? classAverage : '—'}</b></div>
          <div className="teacher-recap-stat">
            <span>Réussite</span>
            <b>{successRate}%</b>
            <div className="teacher-recap-bar"><i style={{ width: `${successRate}%` }} /></div>
          </div>
          <h3>Répartition des appréciations</h3>
          {distribution.map((item) => (
            <p key={item.label}><span className={appreciationClass(item.label)}>{item.label}</span> <b>{item.count}</b></p>
          ))}
          <p className="teacher-recap-tip">Vous pouvez changer un coefficient ici ou dans Règles de notation. L’appli recalcule la moyenne toute seule.</p>
        </aside>
      </div>
    </div>
  );
}

export default TeacherGrades;
