import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import PresenceMark from '../../components/PresenceMark';
import { DOCUMENT_TYPES, FEE_TYPES, PAYMENT_METHODS } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { api, money } from '../../services/api';
import { createPayment, settlePayment, updatePayment } from '../../services/payment';
import { draftAi } from '../../services/ai';

const TABS = [
  { id: 'infos', label: 'Informations personnelles' },
  { id: 'classe', label: 'Classe actuelle' },
  { id: 'parents', label: 'Parents / tuteurs' },
  { id: 'notes', label: 'Notes' },
  { id: 'presences', label: 'Présences' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'documents', label: 'Documents' },
  { id: 'historique', label: 'Historique scolaire' }
];

function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { year, settings } = useSchool();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('infos');
  const [error, setError] = useState('');
  const [payError, setPayError] = useState('');
  const [aiDraft, setAiDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    method: PAYMENT_METHODS[0],
    feeType: 'Frais de scolarité',
    status: 'payé',
    paidAt: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    api(`/api/students/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id, year]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement de la fiche…</p>;

  const { student, grades, subjects, average, ranking, appreciation, decision, payments, paidPercent, tuition, attendance, absences, lates, presenceRate, parents, history, timetable } = data;
  const currency = settings?.currency || 'FCFA';

  async function reload() {
    setData(await api(`/api/students/${id}`));
  }

  async function removeStudent() {
    if (!window.confirm(`Supprimer ${student.firstName} ${student.lastName} et son compte ?`)) return;
    await api(`/api/students/${id}`, { method: 'DELETE' });
    navigate('/dashboard/students');
  }

  return (
    <div>
      <Link to="/dashboard/students" className="back-link">← Tous les étudiants</Link>
      <div className="page-toolbar">
        <div className="profile-head">
          <Avatar src={student.photo} name={student.firstName} size="profile" />
          <div>
            <h1>{student.lastName} {student.firstName}</h1>
            <p>{student.matricule} · {student.className || 'Sans classe'} · {year}</p>
            <p>Moyenne {average || '—'} / 20 · Rang {ranking?.rankLabel || ranking?.rank || '—'}{ranking?.total ? ` / ${ranking.total}` : ''} · {absences} absences · {lates} retards</p>
            <p>Scolarité : <b>{tuition?.statusLabel || (paidPercent ? `${paidPercent} %` : 'Non renseigné')}</b>{tuition ? ` · payé ${money(tuition.paid, currency)}${tuition.due ? ` · reste ${money(tuition.due, currency)}` : ''}` : ''}</p>
          </div>
        </div>
        <div className="row-actions">
          <a className="btn" href={`/print/bulletin?studentId=${student.id}`} target="_blank" rel="noreferrer">📥 Bulletin PDF</a>
          <button type="button" className="btn btn-danger" onClick={removeStudent}>Supprimer</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>

      {tab === 'infos' && (
        <div className="panel info-grid">
          <p><b>Nom :</b> {student.lastName}</p>
          <p><b>Prénom :</b> {student.firstName}</p>
          <p><b>Matricule :</b> {student.matricule}</p>
          <p><b>Naissance :</b> {student.birthDate || '—'}</p>
          <p><b>Sexe :</b> {student.gender || '—'}</p>
          <p><b>Téléphone :</b> {student.phone || '—'}</p>
          <p><b>Email :</b> {student.email}</p>
          <p><b>Adresse :</b> {student.address || '—'}</p>
          <p><b>Urgence :</b> {student.emergencyContact || '—'}</p>
          <p><b>Statut :</b> {student.status}</p>
        </div>
      )}

      {tab === 'classe' && (
        <div className="panel">
          <h2>{student.className || 'Aucune classe'}</h2>
          <p>Année {student.year || year} · Présence {presenceRate || 0} %</p>
          <h3>Emploi du temps</h3>
          {timetable?.length ? timetable.map((slot) => (
            <p key={slot.id}>{slot.day} — {slot.startTime}–{slot.endTime} · {slot.subjectName} · {slot.room || 'Salle à définir'}</p>
          )) : <p>Aucun créneau pour cette classe.</p>}
        </div>
      )}

      {tab === 'parents' && (
        <div className="panel">
          <p><b>Tuteur déclaré :</b> {student.parentName || '—'} · {student.parentPhone || ''} · {student.parentEmail || ''}</p>
          {parents?.length ? parents.map((parent) => (
            <p key={parent.id}>{parent.firstName} {parent.lastName} — {parent.phone} — {parent.email}</p>
          )) : <p>Aucun compte parent lié pour le moment.</p>}
        </div>
      )}

      {tab === 'notes' && (
        <div className="panel">
          <p>Moyenne générale <b>{average || '—'}/20</b> — {appreciation}</p>
          <div className="row-actions" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                try {
                  const data = await draftAi('appreciation', student.id);
                  setAiDraft(data.answer || '');
                } catch (err) {
                  setAiDraft(err.message);
                } finally {
                  setAiLoading(false);
                }
              }}
            >
              {aiLoading ? 'Rédaction…' : 'Appréciation Kelassi IA'}
            </button>
          </div>
          {aiDraft ? <p className="credentials-box" style={{ whiteSpace: 'pre-wrap' }}>{aiDraft}</p> : null}
          {subjects?.length ? (
            <table>
              <thead><tr><th>Matière</th><th>Moyenne</th><th>Coef.</th></tr></thead>
              <tbody>{subjects.map((item) => <tr key={item.subject}><td>{item.subject}</td><td>{item.average}/20</td><td>{item.coefficient}</td></tr>)}</tbody>
            </table>
          ) : null}
          <table>
            <thead><tr><th>Matière</th><th>Évaluation</th><th>Trimestre</th><th>Note</th><th>Coef.</th><th></th></tr></thead>
            <tbody>{grades.map((grade) => (
              <tr key={grade.id}>
                <td>{grade.courseTitle}</td><td>{grade.type || grade.label}</td><td>{grade.term}</td><td>{grade.score}/20</td><td>{grade.coefficient}</td>
                <td><button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer cette note ?')) return; await api(`/api/grades/${grade.id}`, { method: 'DELETE' }); reload(); }}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'presences' && (
        <div className="panel">
          <p>{absences} absences · {lates} retards · présence {presenceRate || 0} %</p>
          <table>
            <thead><tr><th>Date</th><th>Statut</th><th>Justifié</th><th>Mode</th></tr></thead>
            <tbody>{attendance.map((item) => (
              <tr key={item.id}><td>{item.date}</td><td><PresenceMark status={item.status} /></td><td>{item.justified ? 'oui' : 'non'}</td><td>{item.method === 'facial' ? 'Visage' : 'Manuel'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'paiements' && (
        <div className="panel">
          <div className="page-toolbar">
            <p>
              <span className={tuition?.status === 'payé' ? 'badge badge-success' : tuition?.status === 'partiel' ? 'badge badge-warning' : tuition?.status === 'impayé' ? 'badge badge-danger' : 'badge'}>
                {tuition?.statusLabel || 'Non renseigné'}
              </span>
              {' '}Payé {money(tuition?.paid || 0, currency)}
              {tuition?.due ? ` · reste dû ${money(tuition.due, currency)}` : ''}
              {paidPercent ? ` · ${paidPercent} %` : ''}
            </p>
            {tuition?.status !== 'payé' && (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  setPayError('');
                  try {
                    await settlePayment({
                      studentId: student.id,
                      amount: tuition?.due || Number(payForm.amount) || undefined,
                      method: payForm.method,
                      paidAt: payForm.paidAt
                    });
                    await reload();
                  } catch (err) {
                    setPayError(err.message);
                  }
                }}
              >
                Marquer comme payé
              </button>
            )}
          </div>
          {payError && <p className="error">{payError}</p>}
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setPayError('');
              try {
                await createPayment({ ...payForm, studentId: student.id, amount: Number(payForm.amount) });
                setPayForm((current) => ({ ...current, amount: '' }));
                await reload();
              } catch (err) {
                setPayError(err.message);
              }
            }}
          >
            <div className="form-field"><label>Montant ({currency})</label><input type="number" min="1" value={payForm.amount} onChange={(event) => setPayForm({ ...payForm, amount: event.target.value })} required /></div>
            <div className="form-field"><label>Motif</label><select value={payForm.feeType} onChange={(event) => setPayForm({ ...payForm, feeType: event.target.value })}>{FEE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="form-field"><label>Mode</label><select value={payForm.method} onChange={(event) => setPayForm({ ...payForm, method: event.target.value })}>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="form-field"><label>Date</label><input type="date" value={payForm.paidAt} onChange={(event) => setPayForm({ ...payForm, paidAt: event.target.value })} /></div>
            <div className="form-field"><label>Statut</label><select value={payForm.status} onChange={(event) => setPayForm({ ...payForm, status: event.target.value })}><option value="payé">Payé</option><option value="en attente">En attente</option></select></div>
            <div className="form-field"><button className="btn" type="submit">Enregistrer le versement</button></div>
          </form>
          <table>
            <thead><tr><th>Reçu</th><th>Motif</th><th>Montant</th><th>Mode</th><th>Date</th><th>Statut</th><th></th></tr></thead>
            <tbody>{payments.map((item) => (
              <tr key={item.id}>
                <td>{item.receiptNumber}</td>
                <td>{item.feeType}</td>
                <td>{money(item.amount, currency)}</td>
                <td>{item.method}</td>
                <td>{item.paidAt || item.createdAt?.slice(0, 10)}</td>
                <td><span className={item.status === 'payé' ? 'badge badge-success' : 'badge badge-warning'}>{item.status}</span></td>
                <td className="row-actions">
                  {item.status !== 'payé' && <button type="button" className="btn btn-sm" onClick={async () => { await updatePayment(item.id, { status: 'payé' }); reload(); }}>Valider</button>}
                  {item.status === 'payé' && <a className="btn btn-secondary btn-sm" href={`/print/receipt?paymentId=${item.id}&studentId=${student.id}`} target="_blank" rel="noreferrer">Reçu PDF</a>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer ce paiement ?')) return; await api(`/api/payments/${item.id}`, { method: 'DELETE' }); reload(); }}>Supprimer</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'documents' && (
        <div className="panel">
          <p>Documents administratifs de {student.firstName} :</p>
          <div className="row-actions">
            {DOCUMENT_TYPES.map((item) => (
              <a key={item.id} className="btn btn-secondary btn-sm" href={`/print/${item.id}?studentId=${student.id}`} target="_blank" rel="noreferrer">{item.label}</a>
            ))}
          </div>
        </div>
      )}

      {tab === 'historique' && (
        <div className="panel">
          <table>
            <thead><tr><th>Année</th><th>Classe</th><th>Statut</th></tr></thead>
            <tbody>
              {(history || []).map((item, index) => (
                <tr key={`${item.year}-${index}`}><td>{item.year}</td><td>{item.className || '—'}</td><td>{item.status || item.until || 'en cours'}</td></tr>
              ))}
            </tbody>
          </table>
          <p>Décision actuelle : <b>{decision}</b></p>
        </div>
      )}
    </div>
  );
}

export default StudentProfile;
