import React, { useEffect, useState } from 'react';
import { DOCUMENT_TYPES } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';

function Documents() {
  const { year, classes } = useSchool();
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [type, setType] = useState('certificate');

  useEffect(() => {
    api('/api/students').then((data) => setStudents(data.students)).catch(() => {});
  }, [year]);

  const href = type === 'bulletin' && classId
    ? `/print/bulletin?classId=${classId}`
    : `/print/${type}?studentId=${studentId}${classId ? `&classId=${classId}` : ''}`;

  return (
    <div>
      <div className="page-header">
        <h1>Documents administratifs</h1>
        <p>Génération PDF via impression navigateur (certificats, bulletins, reçus, cartes…).</p>
      </div>
      <div className="panel form-grid">
        <div className="form-field"><label>Type</label><select value={type} onChange={(event) => setType(event.target.value)}>{DOCUMENT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        <div className="form-field"><label>Étudiant</label><select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Choisir</option>{students.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></div>
        <div className="form-field"><label>Classe (bulletins groupés)</label><select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">—</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="form-field"><label>&nbsp;</label><a className="btn" href={href} target="_blank" rel="noreferrer">Générer / imprimer</a></div>
      </div>
    </div>
  );
}

export default Documents;
