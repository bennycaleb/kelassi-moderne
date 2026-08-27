import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

function StudentHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/auth/me'), api('/api/courses'), api('/api/grades'), api('/api/payments')])
      .then(([me, courses, grades, payments]) => {
        setData({
          student: me.student,
          courses: courses.courses,
          grades: grades.grades,
          payments: payments.payments
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Mon espace étudiant</h1>
        <p>
          {data.student
            ? `${data.student.firstName} ${data.student.lastName} — ${data.student.className}`
            : 'Compte étudiant'}
        </p>
      </div>

      <div className="panel">
        <h2>Mes cours</h2>
        {data.courses.length === 0 ? <p>Aucun cours pour votre classe.</p> : (
          <ul>
            {data.courses.map((course) => (
              <li key={course.id}>{course.title} — {course.teacherName}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Mes notes</h2>
        {data.grades.length === 0 ? <p>Aucune note pour le moment.</p> : (
          <ul>
            {data.grades.map((grade) => (
              <li key={grade.id}>{grade.courseTitle} ({grade.label}) : {grade.score}/20</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default StudentHome;
