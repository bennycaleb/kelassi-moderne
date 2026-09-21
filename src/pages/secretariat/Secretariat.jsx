import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../services/api';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

const GROUPS = [
  {
    label: 'Élèves',
    cards: [
      { to: '/dashboard/students', icon: '📝', title: 'Inscriptions', text: 'Ouvrir une fiche élève, classe, pièces et compte.' },
      { to: '/dashboard/students', icon: '🔁', title: 'Réinscriptions', text: 'Mettre à jour la classe et le statut pour la nouvelle année.' },
      { to: '/dashboard/students', icon: '📁', title: 'Dossiers scolaires', text: 'Fiche complète : infos, parents, pièces, historique.' },
      { to: '/dashboard/students', icon: '👤', title: 'Informations personnelles', text: 'Nom, contacts, adresse et tuteur.' },
      { to: '/dashboard/students', icon: '📎', title: 'Pièces justificatives', text: 'Acte de naissance, photos et autres pièces du dossier.' },
      { to: '/dashboard/documents?type=certificate', icon: '📜', title: 'Certificats', text: 'Certificat de scolarité et certificat de réussite.' },
      { to: '/dashboard/documents?type=enrollment', icon: '📄', title: 'Attestations', text: 'Attestation d’inscription ou de fréquentation.' },
      { to: '/dashboard/students?status=radié', icon: '↗️', title: 'Transferts / radiations', text: 'Passer un élève en transféré ou radié, sans tout supprimer.' }
    ]
  },
  {
    label: 'Personnel',
    cards: [
      { to: '/dashboard/teachers', icon: '👔', title: 'Dossiers administratifs', text: 'Fiches enseignants : contacts, contrat, matières.' },
      { to: '/dashboard/teachers', icon: '🗂️', title: 'Documents', text: 'Consulter et mettre à jour les dossiers du personnel.' },
      { to: '/dashboard/communication', icon: '✉️', title: 'Courriers', text: 'Annonces et messages de l’établissement.' }
    ]
  },
  {
    label: 'Communication',
    cards: [
      { to: '/dashboard/communication', icon: '📢', title: 'Courriers officiels', text: 'Publier une annonce ou un message officiel.' },
      { to: '/dashboard/convocations', icon: '📨', title: 'Convocations', text: 'Convocation visible par le parent de cet élève et l’élève.' },
      { to: '/dashboard/communication', icon: '🔔', title: 'Notifications', text: 'Informer les élèves, parents ou enseignants.' },
      { to: '/dashboard/students?status=inactif', icon: '🗃️', title: 'Archivage', text: 'Élèves inactifs, transférés ou radiés.' }
    ]
  },
  {
    label: 'Documents',
    cards: [
      { to: '/dashboard/documents?type=certificate', icon: '📜', title: 'Certificats de scolarité', text: 'Générer le certificat de scolarité PDF.' },
      { to: '/dashboard/documents?type=enrollment', icon: '📄', title: 'Attestations', text: 'Attestation d’inscription ou de fréquentation.' },
      { to: '/dashboard/documents?type=transcript', icon: '📊', title: 'Relevés', text: 'Relevé de notes et bulletin.' },
      { to: '/dashboard/students', icon: '📋', title: 'Listes d’élèves', text: 'Liste par classe, recherche et impression.' },
      { to: '/dashboard/documents', icon: '🏛️', title: 'Documents administratifs', text: 'Certificats, attestations, cartes et reçus PDF.' }
    ]
  }
];

function Secretariat() {
  if (currentRole() !== 'secretary') {
    return <Navigate to="/dashboard/students" replace />;
  }
  return <SecretariatDesk />;
}

function SecretariatDesk() {
  const [stats, setStats] = useState({ total: 0, active: 0, docs: 0, staff: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/students'), api('/api/teachers')])
      .then(([studentData, teacherData]) => {
        const students = studentData.students || [];
        setStats({
          total: students.length,
          active: students.filter((item) => item.status === 'actif').length,
          docs: students.filter((item) => (item.enrollmentDocs || []).length > 0).length,
          staff: (teacherData.teachers || []).length
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Administration</h1>
          <p>Le secrétariat gère les dossiers : inscriptions, pièces, documents officiels et communication. Plusieurs secrétaires voient les mêmes élèves.</p>
        </div>
        <Link className="btn" to="/dashboard/students">Inscrire un élève</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dashboard-grid">
        <div className="stat-card"><h3>Élèves</h3><strong>{stats.total}</strong><p>Dossiers</p></div>
        <div className="stat-card"><h3>Actifs</h3><strong>{stats.active}</strong><p>Scolarité en cours</p></div>
        <div className="stat-card"><h3>Dossiers avec pièces</h3><strong>{stats.docs}</strong><p>Justificatifs déposés</p></div>
        <div className="stat-card"><h3>Personnel</h3><strong>{stats.staff}</strong><p>Enseignants</p></div>
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

export default Secretariat;
