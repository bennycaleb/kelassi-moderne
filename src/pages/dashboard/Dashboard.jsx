import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../services/dashboard';
import { money } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';
import { getAiDesk } from '../../services/ai';

function Bars({ items, field = 'value' }) {
  const max = Math.max(1, ...items.map((item) => Number(item[field] || 0)));
  if (!items.length) return <p className="empty-state">Pas encore de données.</p>;
  return (
    <div className="chart-bars">
      {items.map((item) => (
        <div className="chart-row" key={item.label}>
          <span>{item.label}</span>
          <div className="chart-track"><i style={{ width: `${(Number(item[field] || 0) / max) * 100}%` }} /></div>
          <b>{field === 'paid' || field === 'unpaid' ? money(item[field]) : item[field]}</b>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { year, settings } = useSchool();
  const [data, setData] = useState(null);
  const [aiDesk, setAiDesk] = useState(null);
  const [error, setError] = useState('');
  const currency = settings?.currency || 'FC';

  useEffect(() => {
    setData(null);
    getDashboard().then(setData).catch((err) => setError(err.message));
    getAiDesk().then(setAiDesk).catch(() => {});
  }, [year]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement du tableau de bord…</p>;

  const { stats, charts, alerts, recentStudents, recentPayments, announcements, events } = data;

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Tableau de bord</h1>
          <p>{stats.students} étudiants | {stats.teachers} enseignants | {stats.classes} classes | {stats.presenceRate} % présence</p>
        </div>
        <div className="row-actions">
          <Link to="/dashboard/ai" className="btn btn-secondary">Kelassi IA</Link>
          <Link to="/dashboard/students" className="btn">Inscrire un étudiant</Link>
        </div>
      </div>
      {stats.students === 0 && (
        <div className="credentials-box">
          Votre école est prête. Créez d’abord les classes, puis les enseignants, les étudiants et les parents.
        </div>
      )}

      <div className="dashboard-grid kpi-8">
        <div className="stat-card"><h3>Étudiants</h3><strong>{stats.students}</strong><p>Total inscrits</p></div>
        <div className="stat-card"><h3>Enseignants</h3><strong>{stats.teachers}</strong><p>Actifs</p></div>
        <div className="stat-card"><h3>Classes actives</h3><strong>{stats.classes}</strong><p>Année {year}</p></div>
        <div className="stat-card"><h3>Présence du jour</h3><strong>{stats.presenceRate}%</strong><p>{stats.present} présents</p></div>
        <div className="stat-card"><h3>Absences aujourd’hui</h3><strong>{stats.absent}</strong><p>{stats.late} retards</p></div>
        <div className="stat-card"><h3>Encaissé</h3><strong>{money(stats.paymentsTotal, currency)}</strong><p>Paiements reçus</p></div>
        <div className="stat-card"><h3>Impayés</h3><strong>{money(stats.unpaidTotal, currency)}</strong><p>En retard / dus</p></div>
        <div className="stat-card"><h3>Nouveaux inscrits</h3><strong>{stats.newEnrollments}</strong><p>Ce mois</p></div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <h2>Alertes importantes</h2>
          {alerts.length === 0 ? <p>Aucune alerte.</p> : alerts.map((alert) => (
            <p key={alert.text} className={alert.level === 'danger' ? 'alert-danger' : 'alert-warning'}>{alert.text}</p>
          ))}
        </div>
        <div className="panel">
          <h2>Kelassi IA — élèves à suivre</h2>
          {!aiDesk?.risks?.length ? (
            <p>Aucun élève n’est signalé en difficulté.</p>
          ) : aiDesk.risks.slice(0, 6).map((item) => (
            <p key={item.id} className={item.level === 'danger' ? 'alert-danger' : 'alert-warning'}>
              <Link to={`/dashboard/students/${item.id}`}><b>{item.name}</b></Link> ({item.className}) — {(item.reasons || []).join(', ')}
            </p>
          ))}
          <Link className="btn btn-secondary btn-sm" to="/dashboard/ai">Ouvrir Kelassi IA</Link>
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <h2>Dernières annonces</h2>
          {announcements.map((item) => (
            <div key={item.id} className="announce-item">
              <strong>📢 {item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-three">
        <div className="panel"><h2>Inscriptions</h2><Bars items={charts.enrollments} /></div>
        <div className="panel"><h2>Paiements encaissés</h2><Bars items={charts.payments} field="paid" /></div>
        <div className="panel"><h2>Résultats scolaires</h2><Bars items={charts.results} /></div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <h2>Calendrier des événements</h2>
          {events.map((event) => (
            <div key={event.id} className="event-row">
              <b>{event.date}{event.time ? ` · ${event.time}` : ''}</b>
              <span>{event.title} {event.place ? `— ${event.place}` : ''}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Derniers inscrits</h2>
          {recentStudents.map((student) => (
            <p key={student.id}>{student.firstName} {student.lastName} — {student.className}</p>
          ))}
          <h2 style={{ marginTop: 18 }}>Derniers paiements</h2>
          {recentPayments.map((payment) => (
            <p key={payment.id}>{payment.studentName} — {money(payment.amount, currency)} ({payment.status})</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
