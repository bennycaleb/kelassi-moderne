import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import EnrollmentDocsField from '../../components/EnrollmentDocs';
import PresenceMark from '../../components/PresenceMark';
import { DOCUMENT_TYPES, FEE_TYPES, PAYMENT_METHODS, canCorrectBulletin } from '../../constants';
import { updateGrade } from '../../services/grade';
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
  { id: 'convocations', label: 'Convocations' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'dossier', label: 'Dossier d’inscription' },
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
  const [parentAccounts, setParentAccounts] = useState([]);
  const [linkParentId, setLinkParentId] = useState('');
  const [pendingDocs, setPendingDocs] = useState([]);
  const [docError, setDocError] = useState('');
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [gradeMessage, setGradeMessage] = useState('');
  const [gradeSaving, setGradeSaving] = useState(false);
  const role = (() => {
    try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
  })();
  const canCorrect = canCorrectBulletin(role);
  const [payForm, setPayForm] = useState({
    amount: '',
    method: PAYMENT_METHODS[0],
    feeType: 'Frais de scolarité',
    status: 'payé',
    paidAt: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    api(`/api/students/${id}`).then(setData).catch((err) => setError(err.message));
    api('/api/parents').then((payload) => setParentAccounts(payload.parents || [])).catch(() => {});
  }, [id, year]);

  useEffect(() => {
    if (!data?.grades) return;
    setGradeDrafts(Object.fromEntries(data.grades.map((grade) => [grade.id, String(grade.score)])));
  }, [data]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement de la fiche…</p>;

  const { student, grades, subjects, average, ranking, appreciation, decision, payments, paidPercent, tuition, attendance, absences, lates, presenceRate, parents, history, timetable, convocations } = data;
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
          <p><b>Inscrit par :</b> {student.createdByName || '—'}</p>
          <p><b>Dossier d’inscription :</b> {(student.enrollmentDocs || []).length} pièce(s) enregistrée(s)</p>
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
          )) : <p>Aucun compte parent lié pour le moment. Sans ce lien, le parent ne voit pas les infos de l’élève.</p>}
          <form
            className="form-grid"
            style={{ marginTop: 16 }}
            onSubmit={async (event) => {
              event.preventDefault();
              if (!linkParentId) return;
              const account = parentAccounts.find((item) => item.id === linkParentId);
              const childrenIds = [...new Set([...(account?.childrenIds || []), student.id])];
              await api(`/api/parents/${linkParentId}`, { method: 'PUT', body: { childrenIds } });
              setLinkParentId('');
              await reload();
              api('/api/parents').then((payload) => setParentAccounts(payload.parents || [])).catch(() => {});
            }}
          >
            <div className="form-field full">
              <label>Lier un compte parent existant</label>
              <select value={linkParentId} onChange={(event) => setLinkParentId(event.target.value)}>
                <option value="">Choisir un parent…</option>
                {parentAccounts.filter((item) => !(item.childrenIds || []).includes(student.id)).map((item) => (
                  <option key={item.id} value={item.id}>{item.firstName} {item.lastName} — {item.email}</option>
                ))}
              </select>
            </div>
            <div className="form-field"><button className="btn" type="submit" disabled={!linkParentId}>Lier à cet élève</button></div>
          </form>
        </div>
      )}

      {tab === 'notes' && (
        <div className="panel">
          <p>Moyenne générale <b>{average || '—'}/20</b> — {appreciation}{ranking?.rankLabel ? ` · Rang ${ranking.rankLabel}` : ''}</p>
          {canCorrect && (
            <p>Le D.E. et le proviseur peuvent recoriger une note. La moyenne, le rang et le bulletin se recalculent automatiquement.</p>
          )}
          {gradeMessage && <div className="credentials-box">{gradeMessage}</div>}
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
                <td>{grade.courseTitle}</td>
                <td>{grade.type || grade.label}</td>
                <td>{grade.term}</td>
                <td>
                  {canCorrect ? (
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      value={gradeDrafts[grade.id] ?? grade.score}
                      onChange={(event) => setGradeDrafts((current) => ({ ...current, [grade.id]: event.target.value }))}
                      style={{ width: 80 }}
                    />
                  ) : `${grade.score}/20`}
                </td>
                <td>{grade.coefficient}</td>
                <td className="row-actions">
                  {canCorrect && Number(gradeDrafts[grade.id]) !== Number(grade.score) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={gradeSaving}
                      onClick={async () => {
                        const score = Number(gradeDrafts[grade.id]);
                        if (Number.isNaN(score) || score < 0 || score > 20) {
                          setGradeMessage('La note doit être entre 0 et 20.');
                          return;
                        }
                        setGradeSaving(true);
                        setGradeMessage('');
                        try {
                          const result = await updateGrade(grade.id, { score });
                          setGradeMessage(result.message || 'Note corrigée. Le bulletin a été recalculé.');
                          await reload();
                        } catch (err) {
                          setGradeMessage(err.message);
                        } finally {
                          setGradeSaving(false);
                        }
                      }}
                    >
                      Corriger
                    </button>
                  )}
                  <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer cette note ?')) return; await api(`/api/grades/${grade.id}`, { method: 'DELETE' }); reload(); }}>Supprimer</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {canCorrect && grades.some((grade) => Number(gradeDrafts[grade.id]) !== Number(grade.score)) && (
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                disabled={gradeSaving}
                onClick={async () => {
                  const changes = grades.filter((grade) => Number(gradeDrafts[grade.id]) !== Number(grade.score));
                  for (const grade of changes) {
                    const score = Number(gradeDrafts[grade.id]);
                    if (Number.isNaN(score) || score < 0 || score > 20) {
                      setGradeMessage('Chaque note doit être entre 0 et 20.');
                      return;
                    }
                  }
                  setGradeSaving(true);
                  setGradeMessage('');
                  try {
                    for (const grade of changes) {
                      await updateGrade(grade.id, { score: Number(gradeDrafts[grade.id]) });
                    }
                    setGradeMessage('Notes corrigées. La moyenne, le rang et le bulletin sont recalculés.');
                    await reload();
                  } catch (err) {
                    setGradeMessage(err.message);
                  } finally {
                    setGradeSaving(false);
                  }
                }}
              >
                Enregistrer et recalculer le bulletin
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'presences' && (
        <div className="panel">
          <p>{absences} absences · {lates} retards · présence {presenceRate || 0} %</p>
          <table>
            <thead><tr><th>Date</th><th>Statut</th><th>Entrée</th><th>Sortie</th><th>Justifié</th><th>Mode</th></tr></thead>
            <tbody>{attendance.map((item) => (
              <tr key={item.id}>
                <td>{item.date}</td>
                <td><PresenceMark status={item.status} /></td>
                <td>{item.arrivedAtLabel || '—'}</td>
                <td>{item.leftAtLabel || '—'}</td>
                <td>{item.justified ? 'oui' : 'non'}</td>
                <td>{item.method === 'facial' ? 'Visage' : 'Manuel'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'convocations' && (
        <div className="panel">
          {(convocations || []).length === 0
            ? <p>Aucune convocation pour cet élève.</p>
            : (convocations || []).map((item) => (
              <p key={item.id}>{item.date}{item.time ? ` à ${item.time}` : ''} — {item.reason}{item.createdByName ? ` (par ${item.createdByName})` : ''}</p>
            ))}
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

      {tab === 'dossier' && (
        <div className="panel">
          <h2>Dossier d’inscription de {student.firstName}</h2>
          <EnrollmentDocsField
            studentId={student.id}
            existing={student.enrollmentDocs || []}
            pending={pendingDocs}
            onPendingChange={setPendingDocs}
            onDeleteExisting={async (doc) => {
              if (!window.confirm(`Retirer « ${doc.originalName} » du dossier ?`)) return;
              await api(`/api/students/${student.id}/enrollment-docs/${doc.id}`, { method: 'DELETE' });
              reload();
            }}
          />
          {docError && <p className="error">{docError}</p>}
          {pendingDocs.length > 0 && (
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  setDocError('');
                  try {
                    await api(`/api/students/${student.id}/enrollment-docs`, {
                      method: 'POST',
                      body: {
                        enrollmentDocs: pendingDocs.map(({ type, fileName, fileData }) => ({ type, fileName, fileData }))
                      }
                    });
                    setPendingDocs([]);
                    await reload();
                  } catch (err) {
                    setDocError(err.message);
                  }
                }}
              >
                Enregistrer {pendingDocs.length} pièce(s)
              </button>
            </div>
          )}
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
