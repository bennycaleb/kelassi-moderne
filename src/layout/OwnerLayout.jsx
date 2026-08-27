import React from 'react';
import { NavLink } from 'react-router-dom';

function OwnerLayout({ user, logout, children }) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">K</div>
          <div className="sidebar-brand">
            <div className="logo-text">Kelassi</div>
            <small className="sidebar-year">Entreprise</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-group-label">Locataires</p>
            <ul className="nav-list">
              <li><NavLink to="/owner" end>Écoles</NavLink></li>
            </ul>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button type="button" onClick={logout}>Déconnexion</button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="topbar">
          <h3>Espace entreprise — {user?.name || user?.email}</h3>
          <div className="user-area"><span>Kelassi</span></div>
        </header>
        <section className="content">{children}</section>
      </div>
    </div>
  );
}

export default OwnerLayout;
