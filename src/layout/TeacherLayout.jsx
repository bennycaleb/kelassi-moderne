import React from 'react';
import { NavLink } from 'react-router-dom';
import AiAssistant from '../components/AiAssistant';

function TeacherLayout({ user, logout, children }) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-icon">K</div><div className="logo-text">Kelassi</div></div>
        <nav>
          <NavLink to="/teacher" end>Dashboard</NavLink>
          <NavLink to="/teacher/ai">Kelassi IA</NavLink>
          <NavLink to="/teacher/courses">Cours & devoirs</NavLink>
          <NavLink to="/teacher/timetable">Emploi du temps</NavLink>
          <NavLink to="/teacher/attendance">Présences</NavLink>
          <NavLink to="/teacher/face">Scan visage</NavLink>
          <NavLink to="/teacher/grades">Notes</NavLink>
          <NavLink to="/teacher/evaluations">Évaluations</NavLink>
          <NavLink to="/teacher/academic">Règles de notation</NavLink>
          <NavLink to="/teacher/messages">Messages</NavLink>
        </nav>
        <div className="sidebar-bottom"><button type="button" onClick={logout}>Déconnexion</button></div>
      </aside>
      <div className="admin-content">
        <header className="topbar"><h3>Espace enseignant — {user?.name || user?.email}</h3></header>
        <section className="content">{children}</section>
      </div>
      <AiAssistant />
    </div>
  );
}

export default TeacherLayout;
