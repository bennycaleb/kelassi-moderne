import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { refreshSchoolMeta, useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';
import { createCourse, deleteCourse, getCourses } from '../../services/course';
import { getTeachers } from '../../services/teacher';

function Courses() {
  const { year } = useSchool();
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', classId: '', teacherId: '', hours: 4, room: '', description: '' });

  async function refresh() {
    const [courseData, teacherData, classData, subjectData] = await Promise.all([
      getCourses(),
      getTeachers(),
      api('/api/classes'),
      api('/api/subjects')
    ]);
    setCourses(courseData.courses);
    setTeachers(teacherData.teachers);
    setClasses(classData.classes || []);
    setSubjects(subjectData.subjects || []);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    await createCourse(form);
    setOpen(false);
    setForm({ subjectId: '', classId: '', teacherId: '', hours: 4, room: '', description: '' });
    await refresh();
    refreshSchoolMeta();
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header"><h1>Cours / enseignements</h1><p>Une matière + une classe + un enseignant + une salle.</p></div>
        <button type="button" className="btn" onClick={() => { refresh(); setOpen(true); }}>Nouveau cours</button>
      </div>
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
                  <option value="">{classes.length ? 'Choisir' : 'Aucune classe — créez-en une d’abord'}</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {!classes.length && <p><Link to="/dashboard/classes">Aller créer une classe</Link></p>}
              </div>
              <div className="form-field"><label>Enseignant</label><select name="teacherId" value={form.teacherId} onChange={change}><option value="">—</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></div>
              <div className="form-field"><label>Volume horaire</label><input type="number" name="hours" value={form.hours} onChange={change} /></div>
              <div className="form-field full"><label>Salle</label><input name="room" value={form.room} onChange={change} /></div>
              <div className="form-field full"><label>Description</label><textarea name="description" value={form.description} onChange={change} rows="2" /></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn" type="submit" disabled={!classes.length || !subjects.length}>Créer</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Courses;

