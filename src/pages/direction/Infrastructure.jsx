import React from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';

function Infrastructure() {
  const { settings, classes, year } = useSchool();

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Infrastructure</h1>
          <p>Supervision des locaux et des classes, avec l’intendant. Les détails financiers restent dans Finances.</p>
        </div>
        <Link className="btn btn-secondary" to="/dashboard/settings">Paramètres</Link>
      </div>
      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Établissement</h3>
          <strong>{settings?.schoolName || '—'}</strong>
          <p>{settings?.address || 'Adresse non renseignée'}</p>
        </div>
        <div className="stat-card">
          <h3>Contact</h3>
          <strong>{settings?.phone || '—'}</strong>
          <p>{settings?.email || 'Email non renseigné'}</p>
        </div>
        <div className="stat-card">
          <h3>Classes / espaces</h3>
          <strong>{classes.length}</strong>
          <p>Année {year}</p>
        </div>
      </div>
      <div className="panel">
        <h2 className="nav-group-label">Classes de l’année</h2>
        {classes.length === 0 ? (
          <p>Aucune classe pour le moment.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Niveau</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.level || '—'}</td>
                    <td><Link className="btn btn-secondary btn-sm" to={`/dashboard/classes/${item.id}`}>Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Infrastructure;
