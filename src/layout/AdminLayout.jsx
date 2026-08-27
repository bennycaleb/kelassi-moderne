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
      { to: '/dashboard/face', label: 'Scan visage', section: 'attendance' },
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
      { to: '/dashboard/users', label: 'Utilisateurs', section: 'users' },
      { to: '/dashboard/academic', label: 'Règles de notation', section: 'academic' },
      { to: '/dashboard/settings', label: 'Paramètres', section: 'settings' }
    ]
  }
];

function AdminLayout({ user, logout, children }) {
  const { year, setYear, years, settings } = useSchool();
  const role = user?.role || 'admin';
  const displayName = user?.name || user?.email || 'Administrateur';

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">K</div>
          <div className="sidebar-brand">
            <div className="logo-text">{settings?.schoolName || 'Kelassi'}</div>
            <small className="sidebar-year">{year}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {GROUPS.map((group) => {
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
