import React from 'react';
import { NavLink } from 'react-router-dom';
import AiAssistant from '../components/AiAssistant';

function StudentLayout({ user, logout, children }) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-icon">K</div><div className="logo-text">Kelassi</div></div>
        <nav>
          <NavLink to="/student" end>Mon tableau</NavLink>
          <NavLink to="/student/courses">Cours & devoirs</NavLink>
          <NavLink to="/student/timetable">Emploi du temps</NavLink>
          <NavLink to="/student/grades">Mes notes</NavLink>
          <NavLink to="/student/absences">Mes absences</NavLink>
          <NavLink to="/student/payments">Paiements</NavLink>
          <NavLink to="/student/documents">Documents</NavLink>
          <NavLink to="/student/announcements">Annonces</NavLink>
        </nav>
        <div className="sidebar-bottom"><button type="button" onClick={logout}>Déconnexion</button></div>
      </aside>
      <div className="admin-content">
        <header className="topbar"><h3>Espace étudiant — {user?.name || user?.email}</h3></header>
        <section className="content">{children}</section>
      </div>
      <AiAssistant />
    </div>
  );
}

export default StudentLayout;
