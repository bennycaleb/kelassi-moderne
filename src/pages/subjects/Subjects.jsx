import React, { useEffect, useState } from 'react';
import { refreshSchoolMeta } from '../../context/SchoolContext';
import { api } from '../../services/api';

function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState('');
  const [coefficient, setCoefficient] = useState(2);

  async function refresh() {
    setSubjects((await api('/api/subjects')).subjects);
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  async function submit(event) {
    event.preventDefault();
    await api('/api/subjects', { method: 'POST', body: { name, coefficient: Number(coefficient) } });
    setName('');
    await refresh();
    refreshSchoolMeta();
  }

  return (
    <div>
      <div className="page-header"><h1>Matières</h1><p>Socle des cours, coefficients et emplois du temps.</p></div>
      <form className="panel form-grid" onSubmit={submit}>
        <div className="form-field"><label>Nouvelle matière</label><input value={name} onChange={(event) => setName(event.target.value)} required /></div>
        <div className="form-field"><label>Coefficient</label><input type="number" min="1" value={coefficient} onChange={(event) => setCoefficient(event.target.value)} /></div>
        <div className="form-field"><label>&nbsp;</label><button className="btn" type="submit">Ajouter</button></div>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>Matière</th><th>Code</th><th>Coef.</th><th></th></tr></thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td>{subject.name}</td><td>{subject.code}</td><td>{subject.coefficient}</td>
                <td><button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm(`Supprimer la matière « ${subject.name} » ?`)) return; await api(`/api/subjects/${subject.id}`, { method: 'DELETE' }); refresh(); refreshSchoolMeta(); }}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Subjects;
