import React from 'react';
import { NavLink } from 'react-router-dom';
import { canSee, ROLE_LABELS } from '../constants';
import { useSchool } from '../context/SchoolContext';
import AiAssistant from '../components/AiAssistant';

const GROUPS = [
  { label: 'Pilotage', items: [
    { to: '/dashboard', label: 'Dashboard', section: 'dashboard', end: true },
    { to: '/dashboard/ai', label: 'Kelassi IA', section: 'ai' }
  ] },
  {
    label: 'Scolarité',
    items: [
      { to: '/dashboard/students', label: 'Étudiants', section: 'students' },
      { to: '/dashboard/teachers', label: 'Enseignants', section: 'teachers' },
      { to: '/dashboard/classes', label: 'Classes', section: 'classes' },
      { to: '/dashboard/subjects', label: 'Matières', section: 'subjects' },
      { to: '/dashboard/courses', label: 'Cours', section: 'courses' },
      { to: '/dashboard/timetable', label: 'Emploi du temps', section: 'timetable' }
    ]
  },
  {
    label: 'Vie scolaire',
    items: [
      { to: '/dashboard/attendance', label: 'Présences', section: 'attendance' },
      { to: '/dashboard/face', label: 'Scan visage', section: 'face' },
      { to: '/dashboard/convocations', label: 'Convocations', section: 'convocations' },
      { to: '/dashboard/life/reports', label: 'Rapports de surveillance', section: 'watch-reports' },
      { to: '/dashboard/grades', label: 'Notes', section: 'grades' },
      { to: '/dashboard/evaluations', label: 'Évaluations', section: 'grades' },
      { to: '/dashboard/documents', label: 'Documents', section: 'documents' }
    ]
  },
  { label: 'Finances', items: [{ to: '/dashboard/payments', label: 'Paiements', section: 'payments' }] },
  {
    label: 'Communication',
    items: [
      { to: '/dashboard/communication', label: 'Annonces', section: 'communication' },
      { to: '/dashboard/parents', label: 'Parents', section: 'parents' }
    ]
  },
  {
    label: 'Administration',
    items: [
      { to: '/dashboard/directors', label: 'D.E.', section: 'directors' },
      { to: '/dashboard/intendants', label: 'Intendance', section: 'intendants' },
      { to: '/dashboard/secretaries', label: 'Secrétariat', section: 'secretaries' },
      { to: '/dashboard/supervisors', label: 'Surveillants', section: 'supervisors' },
      { to: '/dashboard/users', label: 'Utilisateurs', section: 'users' },
      { to: '/dashboard/academic', label: 'Règles de notation', section: 'academic' },
      { to: '/dashboard/settings', label: 'Paramètres', section: 'settings' }
    ]
  }
];

const SUPERVISOR_GROUPS = [
  {
    label: 'Vie scolaire',
    items: [
      { to: '/dashboard/life', label: 'Tableau de vie scolaire', section: 'viescolaire', end: true },
      { to: '/dashboard/life/attendance', label: 'Présences & absences', section: 'life-attendance' },
      { to: '/dashboard/face', label: 'Entrées & sorties', section: 'face' },
      { to: '/dashboard/life/incidents', label: 'Incidents & sanctions', section: 'sanctions' },
      { to: '/dashboard/convocations', label: 'Convocations', section: 'convocations' },
      { to: '/dashboard/life/reports', label: 'Rapports & signalements', section: 'watch-reports' }
    ]
  }
];

const SECRETARY_GROUPS = [
  {
    label: 'Administration',
    items: [
      { to: '/dashboard/office', label: 'Tableau du secrétariat', section: 'secretariat', end: true },
      { to: '/dashboard/students', label: 'Élèves', section: 'students' },
      { to: '/dashboard/teachers', label: 'Personnel', section: 'teachers' },
      { to: '/dashboard/parents', label: 'Parents', section: 'parents' },
      { to: '/dashboard/communication', label: 'Communication', section: 'communication' },
      { to: '/dashboard/convocations', label: 'Convocations', section: 'convocations' },
      { to: '/dashboard/documents', label: 'Documents', section: 'documents' }
    ]
  }
];

const INTENDANT_GROUPS = [
  {
    label: 'Intendance',
    items: [
      { to: '/dashboard/estate', label: 'Tableau d’intendance', section: 'intendance', end: true },
      { to: '/dashboard/payments', label: 'Recettes scolarité', section: 'payments' },
      { to: '/dashboard/estate/budget', label: 'Budget', section: 'estate' },
      { to: '/dashboard/estate/expense', label: 'Dépenses & factures', section: 'estate' },
      { to: '/dashboard/estate/purchase', label: 'Achats & commandes', section: 'estate' }
    ]
  },
  {
    label: 'Matériel & locaux',
    items: [
      { to: '/dashboard/infrastructure', label: 'Locaux', section: 'infrastructure' },
      { to: '/dashboard/estate/inventory', label: 'Inventaire & stocks', section: 'estate' },
      { to: '/dashboard/estate/maintenance', label: 'Entretien & réparations', section: 'estate' }
    ]
  },
  {
    label: 'Services & administration',
    items: [
      { to: '/dashboard/estate/service', label: 'Services généraux', section: 'estate' },
      { to: '/dashboard/estate/supplier', label: 'Fournisseurs', section: 'estate' },
      { to: '/dashboard/estate/report', label: 'Rapports à la direction', section: 'estate' },
      { to: '/dashboard/documents', label: 'Documents', section: 'documents' }
    ]
  }
];

const DIRECTOR_GROUPS = [
  {
    label: 'Direction de l’établissement',
    items: [
      { to: '/dashboard/direction', label: 'Tableau de la direction', section: 'direction', end: true }
    ]
  },
  {
    label: 'Élèves & enseignants',
    items: [
      { to: '/dashboard/students', label: 'Élèves', section: 'students' },
      { to: '/dashboard/teachers', label: 'Enseignants', section: 'teachers' },
      { to: '/dashboard/classes', label: 'Classes', section: 'classes' },
      { to: '/dashboard/courses', label: 'Cours', section: 'courses' },
      { to: '/dashboard/timetable', label: 'Emploi du temps', section: 'timetable' }
    ]
  },
  {
    label: 'Pédagogie',
    items: [
      { to: '/dashboard/subjects', label: 'Programmes', section: 'subjects' },
      { to: '/dashboard/grades', label: 'Résultats', section: 'grades' },
      { to: '/dashboard/evaluations', label: 'Conseils de classe', section: 'grades' },
      { to: '/dashboard/academic', label: 'Règles de notation', section: 'academic' }
    ]
  },
  {
    label: 'Pilotage',
    items: [
      { to: '/dashboard/communication', label: 'Annonces', section: 'communication' },
      { to: '/dashboard/payments', label: 'Finances', section: 'payments' },
      { to: '/dashboard/infrastructure', label: 'Infrastructure', section: 'infrastructure' },
      { to: '/dashboard/users', label: 'Utilisateurs & droits', section: 'users' },
      { to: '/dashboard/secretaries', label: 'Secrétariat', section: 'secretaries' },
      { to: '/dashboard/supervisors', label: 'Surveillants', section: 'supervisors' },
      { to: '/dashboard/settings', label: 'Paramètres', section: 'settings' },
      { to: '/dashboard/life/reports', label: 'Signalements', section: 'watch-reports' }
    ]
  }
];

function AdminLayout({ user, logout, children }) {
  const { year, setYear, years, settings } = useSchool();
  const role = user?.role || 'admin';
  const displayName = user?.name || user?.email || 'Administrateur';
  const groups = role === 'supervisor'
    ? SUPERVISOR_GROUPS
    : role === 'secretary'
      ? SECRETARY_GROUPS
      : role === 'director'
        ? DIRECTOR_GROUPS
        : role === 'intendant'
          ? INTENDANT_GROUPS
          : GROUPS;

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">K</div>
          <div className="sidebar-brand">
            <div className="logo-text">{settings?.schoolName || 'Kelassi Moderne'}</div>
            <small className="sidebar-year">{year}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => {
            const items = group.items.filter((item) => canSee(role, item.section));
            if (!items.length) return null;
            return (
              <div key={group.label} className="nav-group">
                <p className="nav-group-label">{group.label}</p>
                <ul className="nav-list">
                  {items.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end}>{item.label}</NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" onClick={logout}>Déconnexion</button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="topbar">
          <h3>Bienvenue {displayName}</h3>
          <div className="user-area">
            <label className="year-select">
              Année scolaire
              <select value={year} onChange={(event) => setYear(event.target.value)}>
                {years.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <span>{ROLE_LABELS[role] || 'Administrateur'}</span>
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <section className="content">{children}</section>
      </div>
      <AiAssistant />
    </div>
  );
}

export default AdminLayout;
