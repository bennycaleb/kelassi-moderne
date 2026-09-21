import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getDashboard } from '../../services/dashboard';
import { money } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

const GROUPS = [
  {
    label: 'Élèves',
    cards: [
      { to: '/dashboard/students', icon: '👨‍🎓', title: 'Effectifs', text: 'Voir tous les élèves de l’établissement.' },
      { to: '/dashboard/students', icon: '📝', title: 'Inscriptions', text: 'Ouvrir ou mettre à jour une fiche élève.' },
      { to: '/dashboard/classes', icon: '🏫', title: 'Affectations', text: 'Classes et répartition des élèves.' },
      { to: '/dashboard/students?status=inactif', icon: '📌', title: 'Situations particulières', text: 'Élèves inactifs, transférés ou radiés.' }
    ]
  },
  {
    label: 'Enseignants',
    cards: [
      { to: '/dashboard/teachers', icon: '👨‍🏫', title: 'Affectations', text: 'Fiches enseignants et matières.' },
      { to: '/dashboard/courses', icon: '📘', title: 'Cours', text: 'Cours de l’année et enseignants associés.' },
      { to: '/dashboard/timetable', icon: '📅', title: 'Emploi du temps', text: 'Planning des classes et des cours.' },
      { to: '/dashboard/teachers', icon: '👀', title: 'Suivi général', text: 'Vue d’ensemble du personnel enseignant.' }
    ]
  },
  {
    label: 'Pédagogie',
    cards: [
      { to: '/dashboard/subjects', icon: '📚', title: 'Programmes', text: 'Matières et programmes de l’établissement.' },
      { to: '/dashboard/grades', icon: '📊', title: 'Résultats', text: 'Notes et moyennes des élèves.' },
      { to: '/dashboard/evaluations', icon: '🧑‍⚖️', title: 'Conseils de classe', text: 'Évaluations et suivi pédagogique.' }
    ]
  },
  {
    label: 'Pilotage',
    cards: [
      { to: '/dashboard/timetable', icon: '🗓️', title: 'Emplois du temps', text: 'Consulter et ajuster les horaires.' },
      { to: '/dashboard/communication', icon: '📢', title: 'Annonces et communications', text: 'Messages officiels de l’établissement.' },
      { to: '/dashboard/payments', icon: '💰', title: 'Finances', text: 'Supervision des paiements, avec l’intendant / comptable.' },
      { to: '/dashboard/infrastructure', icon: '🏢', title: 'Infrastructure', text: 'Supervision des locaux et classes, avec l’intendant.' },
      { to: '/dashboard/users', icon: '🔐', title: 'Utilisateurs et droits', text: 'Comptes du personnel et rôles.' },
      { to: '/dashboard/settings', icon: '⚙️', title: 'Paramètres du système', text: 'Identité de l’école, année et règles générales.' }
    ]
  }
];

function Direction() {
  if (currentRole() !== 'director') {
    return <Navigate to="/dashboard" replace />;
  }
  return <DirectionDesk />;
}

function DirectionDesk() {
  const { year, settings } = useSchool();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const currency = settings?.currency || 'FC';

  useEffect(() => {
    getDashboard().then(setData).catch((err) => setError(err.message));
  }, [year]);

  const stats = data?.stats || {};

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Direction de l’établissement</h1>
          <p>Vue globale du lycée : le D.E. supervise l’ensemble. Le secrétariat, les surveillants et le comptable gardent leurs tâches du jour.</p>
        </div>
        <Link className="btn" to="/dashboard/students">Voir les élèves</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dashboard-grid">
        <div className="stat-card"><h3>Élèves</h3><strong>{stats.students ?? '—'}</strong><p>Effectifs</p></div>
        <div className="stat-card"><h3>Enseignants</h3><strong>{stats.teachers ?? '—'}</strong><p>Personnel</p></div>
        <div className="stat-card"><h3>Classes</h3><strong>{stats.classes ?? '—'}</strong><p>Année {year}</p></div>
        <div className="stat-card"><h3>Présence</h3><strong>{stats.presenceRate ?? 0}%</strong><p>Aujourd’hui</p></div>
        <div className="stat-card"><h3>Encaissé</h3><strong>{money(stats.paymentsTotal || 0, currency)}</strong><p>Paiements reçus</p></div>
        <div className="stat-card"><h3>Impayés</h3><strong>{money(stats.unpaidTotal || 0, currency)}</strong><p>À suivre avec l’intendant</p></div>
      </div>
      {GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="nav-group-label">{group.label}</h2>
          <div className="grid-three">
            {group.cards.map((card) => (
              <Link key={`${group.label}-${card.title}`} className="stat-card" to={card.to}>
                <h3>{card.icon} {card.title}</h3>
                <p>{card.text}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default Direction;
