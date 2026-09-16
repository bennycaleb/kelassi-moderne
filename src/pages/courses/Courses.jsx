import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { refreshSchoolMeta, useSchool } from '../../context/SchoolContext';
import { createCourse, deleteCourse, getCourses } from '../../services/course';

function Courses() {
  const { year, classes, subjects, teachers } = useSchool();
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ subjectId: '', classId: '', teacherId: '', hours: 4, room: '', description: '' });

  async function refresh() {
    try {
      setCourses((await getCourses()).courses || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { refresh(); }, [year]);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function openCreate() {
    setError('');
    setForm({
      subjectId: subjects[0]?.id || '',
      classId: classes[0]?.id || '',
      teacherId: teachers[0]?.id || '',
      hours: 4,
      room: '',
      description: ''
    });
    refreshSchoolMeta();
    refresh();
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await createCourse(form);
      setOpen(false);
      setForm({ subjectId: '', classId: '', teacherId: '', hours: 4, room: '', description: '' });
      await refresh();
      refreshSchoolMeta();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header"><h1>Cours / enseignements</h1><p>Une matière + une classe + un enseignant + une salle.</p></div>
        <button type="button" className="btn" onClick={openCreate}>Nouveau cours</button>
      </div>
      {error && !open && <p className="error">{error}</p>}
      <div className="course-grid">
        {courses.map((course) => (
          <div className="course-card" key={course.id}>
            <span className="badge badge-success">{course.className}</span>
            <h3>{course.subjectName || course.title}</h3>
            <p>{course.teacherName}</p>
            <p>{course.hours} h · {course.room || 'Salle à définir'}</p>
            <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm(`Supprimer le cours « ${course.subjectName || course.title} » ?`)) return; await deleteCourse(course.id); refresh(); }}>Supprimer</button>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="Nouveau cours" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Matière</label>
                <select name="subjectId" value={form.subjectId} onChange={change} required>
                  <option value="">{subjects.length ? 'Choisir' : 'Aucune matière — créez-en une d’abord'}</option>
                  {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {!subjects.length && <p><Link to="/dashboard/subjects">Aller créer une matière</Link></p>}
              </div>
              <div className="form-field">
                <label>Classe</label>
                <select name="classId" value={form.classId} onChange={change} required>
                  <option value="">{classes.length ? 'Choisir' : `Aucune classe pour ${year}`}</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {!classes.length && (
                  <p>
                    Vérifiez l’année scolaire en haut à droite, ou <Link to="/dashboard/classes">créez une classe</Link>.
                  </p>
                )}
              </div>
              <div className="form-field">
                <label>Enseignant</label>
                <select name="teacherId" value={form.teacherId} onChange={change}>
                  <option value="">—</option>
                  {teachers.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
                </select>
              </div>
              <div className="form-field"><label>Volume horaire</label><input type="number" name="hours" value={form.hours} onChange={change} /></div>
              <div className="form-field full"><label>Salle</label><input name="room" value={form.room} onChange={change} /></div>
              <div className="form-field full"><label>Description</label><textarea name="description" value={form.description} onChange={change} rows="2" /></div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn" type="submit" disabled={!classes.length || !subjects.length}>Créer</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Courses;
