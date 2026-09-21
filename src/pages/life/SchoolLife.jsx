import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../services/api';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

const CARDS = [
  { to: '/dashboard/life/attendance', icon: '🕐', title: 'Présence et absences', text: 'Voir qui est présent, absent ou déjà scanné aujourd’hui.' },
  { to: '/dashboard/face', icon: '🚪', title: 'Entrées et sorties', text: 'Même scan visage qu’aujourd’hui, à l’entrée de l’école.' },
  { to: '/dashboard/life/attendance?status=retard', icon: '📝', title: 'Retards', text: 'Suivre les élèves arrivés en retard.' },
  { to: '/dashboard/life/incidents', icon: '⚠️', title: 'Incidents et sanctions', text: 'Noter un incident ou une sanction. Le parent de cet élève le voit.' },
  { to: '/dashboard/life/reports?place=récréation', icon: '👨‍🎓', title: 'Récréations', text: 'Noter le suivi des élèves pendant la récréation.' },
  { to: '/dashboard/life/reports?place=couloir', icon: '🏫', title: 'Couloirs et espaces communs', text: 'Signaler ce qui se passe dans les couloirs et cours.' },
  { to: '/dashboard/life/reports?type=signalement', icon: '📞', title: 'Signalement à la direction', text: 'Alerter le directeur sur un problème de vie scolaire.' },
  { to: '/dashboard/convocations', icon: '👨‍👩‍👧', title: 'Communication parents', text: 'Convocation visible seulement par le parent de cet élève et l’élève.' },
  { to: '/dashboard/life/reports', icon: '📋', title: 'Rapports de surveillance', text: 'Laisser un rapport du tour de surveillance.' }
];

function SchoolLife() {
  if (currentRole() !== 'supervisor') {
    return <Navigate to="/dashboard/life/reports" replace />;
  }
  return <SchoolLifeDesk />;
}

function SchoolLifeDesk() {
  const [summary, setSummary] = useState({ present: 0, arrived: 0, absent: 0, late: 0 });
  const [error, setError] = useState('');
  const date = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api(`/api/attendance?date=${date}`)
      .then((data) => setSummary(data.summary || { present: 0, arrived: 0, absent: 0, late: 0 }))
      .catch((err) => setError(err.message));
  }, [date]);

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Vie scolaire</h1>
          <p>Les surveillants gèrent la vie scolaire et la discipline du jour. L’enregistrement des présences se fait toujours par le scan visage à l’entrée.</p>
        </div>
        <Link className="btn" to="/dashboard/face">Ouvrir le scan</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dashboard-grid">
        <div className="stat-card"><h3>Présents</h3><strong>{summary.present}</strong><p>Aujourd’hui</p></div>
        <div className="stat-card"><h3>Arrivés</h3><strong>{summary.arrived}</strong><p>Entrée scannée</p></div>
        <div className="stat-card"><h3>Absents</h3><strong>{summary.absent}</strong><p>Aujourd’hui</p></div>
        <div className="stat-card"><h3>Retards</h3><strong>{summary.late}</strong><p>Aujourd’hui</p></div>
      </div>
      <div className="grid-three">
        {CARDS.map((card) => (
          <Link key={card.to} className="stat-card" to={card.to}>
            <h3>{card.icon} {card.title}</h3>
            <p>{card.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default SchoolLife;
