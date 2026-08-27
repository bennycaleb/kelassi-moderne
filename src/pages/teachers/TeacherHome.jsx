import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

function TeacherHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/auth/me'), api('/api/courses')])
      .then(([me, courses]) => {
        setData({ teacher: me.teacher, courses: courses.courses });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Espace enseignant</h1>
        <p>
          {data.teacher
            ? `${data.teacher.firstName} ${data.teacher.lastName} — ${data.teacher.subject}`
            : 'Compte professeur'}
        </p>
      </div>

      <div className="panel">
        <h2>Mes cours</h2>
        {data.courses.length === 0 ? <p>Aucun cours ne vous est encore assigné.</p> : (
          <ul>
            {data.courses.map((course) => (
              <li key={course.id}>{course.title} — {course.className}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TeacherHome;
