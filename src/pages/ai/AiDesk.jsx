import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AiAssistant from '../../components/AiAssistant';
import { getAiDesk } from '../../services/ai';

function AiDesk() {
  const [desk, setDesk] = useState(null);
  const [error, setError] = useState('');
  const staff = typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

  useEffect(() => {
    getAiDesk().then(setDesk).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Kelassi IA</h1>
        <p>Posez n’importe quelle question : l’école, Kelassi, ou un sujet général comme avec ChatGPT. Les notes et paiements officiels ne sont jamais inventés.</p>
      </div>
      {error && <p className="error">{error}</p>}
      {desk && (
        <div className="dashboard-grid kpi-8" style={{ marginBottom: 18 }}>
          <div className="stat-card"><h3>Élèves suivis</h3><strong>{desk.totals?.students || 0}</strong><p>Dans votre périmètre</p></div>
          <div className="stat-card"><h3>En difficulté</h3><strong>{desk.totals?.atRisk || 0}</strong><p>Notes, absences ou scolarité</p></div>
          <div className="stat-card"><h3>Scolarité</h3><strong>{desk.totals?.unpaid || 0}</strong><p>Dossiers non soldés</p></div>
          <div className="stat-card"><h3>Moyenne</h3><strong>{desk.totals?.classAverage || '—'}/20</strong><p>Effectif visible</p></div>
        </div>
      )}
      <div className="grid-two">
        <div className="panel">
          <h2>Élèves à suivre</h2>
          {!desk?.risks?.length ? <p>Aucun signal fort pour le moment.</p> : desk.risks.map((item) => (
            <div key={item.id} className={item.level === 'danger' ? 'alert-danger' : 'alert-warning'} style={{ marginBottom: 10 }}>
              <p>
                {staff
                  ? <Link to={`/dashboard/students/${item.id}`}><b>{item.name}</b></Link>
                  : <b>{item.name}</b>} — {item.className}
                {' · '}moyenne {item.average || '—'}/20 · {item.rankLabel} · {item.absences} abs. · {item.tuition}
              </p>
              <p>{(item.reasons || []).join(' · ')}</p>
            </div>
          ))}
        </div>
        <AiAssistant variant="page" />
      </div>
    </div>
  );
}

export default AiDesk;
