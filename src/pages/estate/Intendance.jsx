import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getDashboard } from '../../services/dashboard';
import { api, money } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

const GROUPS = [
  {
    label: 'Gestion financière',
    cards: [
      { to: '/dashboard/payments', icon: '💰', title: 'Recettes scolarité', text: 'Suivre les paiements des familles, déjà en place.' },
      { to: '/dashboard/estate/budget', icon: '📒', title: 'Budget', text: 'Préparer et suivre le budget du lycée.' },
      { to: '/dashboard/estate/expense', icon: '🧾', title: 'Dépenses et factures', text: 'Enregistrer les sorties et suivre les factures.' },
      { to: '/dashboard/estate/purchase', icon: '🛒', title: 'Achats et commandes', text: 'Devis, commandes, livraisons d’équipements.' }
    ]
  },
  {
    label: 'Matériel et locaux',
    cards: [
      { to: '/dashboard/infrastructure', icon: '🏢', title: 'Locaux', text: 'Classes, bâtiments et espaces de l’établissement.' },
      { to: '/dashboard/estate/inventory', icon: '📦', title: 'Inventaire et stocks', text: 'Enregistrer le matériel et contrôler les stocks.' },
      { to: '/dashboard/estate/maintenance', icon: '🔧', title: 'Entretien et réparations', text: 'Organiser la maintenance des locaux et équipements.' }
    ]
  },
  {
    label: 'Services et administration',
    cards: [
      { to: '/dashboard/estate/service', icon: '🧹', title: 'Services généraux', text: 'Entretien, sécurité, cantine, transport, internat.' },
      { to: '/dashboard/estate/supplier', icon: '🤝', title: 'Fournisseurs', text: 'Contrats, devis et marchés.' },
      { to: '/dashboard/estate/report', icon: '📋', title: 'Rapports à la direction', text: 'Informer le D.E. du suivi financier et matériel.' },
      { to: '/dashboard/documents', icon: '📄', title: 'Documents administratifs', text: 'Certificats, attestations et impressions déjà en place.' }
    ]
  }
];

function Intendance() {
  if (currentRole() !== 'intendant') {
    return <Navigate to="/dashboard/payments" replace />;
  }
  return <IntendanceDesk />;
}

function IntendanceDesk() {
  const { year, settings } = useSchool();
  const [stats, setStats] = useState({ tuition: 0, budget: 0, expenses: 0, stock: 0, repairs: 0 });
  const [error, setError] = useState('');
  const currency = settings?.currency || 'FC';

  useEffect(() => {
    Promise.all([getDashboard(), api('/api/estate')])
      .then(([dash, estate]) => {
        const records = estate.records || [];
        const sum = (type) => records.filter((item) => item.type === type).reduce((total, item) => total + Number(item.amount || 0), 0);
        setStats({
          tuition: dash.stats?.paymentsTotal || 0,
          budget: sum('budget'),
          expenses: sum('expense'),
          stock: records.filter((item) => item.type === 'inventory').length,
          repairs: records.filter((item) => item.type === 'maintenance' && item.status !== 'fait').length
        });
      })
      .catch((err) => setError(err.message));
  }, [year]);

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Intendance</h1>
          <p>L’intendant gère le quotidien matériel et financier, avec la direction. Il ne remplace pas le D.E.</p>
        </div>
        <Link className="btn" to="/dashboard/estate/purchase">Nouvelle commande</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dashboard-grid">
        <div className="stat-card"><h3>Recettes scolarité</h3><strong>{money(stats.tuition, currency)}</strong><p>Année {year}</p></div>
        <div className="stat-card"><h3>Budget</h3><strong>{money(stats.budget, currency)}</strong><p>Lignes prévues</p></div>
        <div className="stat-card"><h3>Dépenses</h3><strong>{money(stats.expenses, currency)}</strong><p>Factures et sorties</p></div>
        <div className="stat-card"><h3>Inventaire</h3><strong>{stats.stock}</strong><p>Équipements suivis</p></div>
        <div className="stat-card"><h3>Réparations</h3><strong>{stats.repairs}</strong><p>En cours</p></div>
      </div>
      {GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="nav-group-label">{group.label}</h2>
          <div className="grid-three">
            {group.cards.map((card) => (
              <Link key={card.title} className="stat-card" to={card.to}>
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

export default Intendance;
