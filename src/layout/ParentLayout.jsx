import React from 'react';
import { NavLink } from 'react-router-dom';
import AiAssistant from '../components/AiAssistant';

function ParentLayout({ user, logout, children }) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-icon">K</div><div className="logo-text">Kelassi</div></div>
        <nav>
          <NavLink to="/parent" end>Mes enfants</NavLink>
          <NavLink to="/parent/attendance">Présences</NavLink>
          <NavLink to="/parent/grades">Notes</NavLink>
          <NavLink to="/parent/timetable">Emploi du temps</NavLink>
          <NavLink to="/parent/work">Cours & devoirs</NavLink>
          <NavLink to="/parent/payments">Paiements</NavLink>
          <NavLink to="/parent/documents">Documents</NavLink>
          <NavLink to="/parent/announcements">Annonces</NavLink>
        </nav>
        <div className="sidebar-bottom"><button type="button" onClick={logout}>Déconnexion</button></div>
      </aside>
      <div className="admin-content">
        <header className="topbar"><h3>Espace parent — {user?.name || user?.email}</h3></header>
        <section className="content">{children}</section>
      </div>
      <AiAssistant />
    </div>
  );
}

export default ParentLayout;
