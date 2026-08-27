import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, money } from '../../services/api';
import { DOCUMENT_TYPES } from '../../constants';

function PrintDocument() {
  const { type } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    const query = new URLSearchParams({ type, studentId: params.get('studentId') || '', paymentId: params.get('paymentId') || '', classId: params.get('classId') || '' });
    api(`/api/documents/data?${query.toString()}`).then(setData).catch(() => {});
  }, [type, params]);

  if (!data) return <p>Préparation du document…</p>;

  const label = DOCUMENT_TYPES.find((item) => item.id === type)?.label || 'Document';
  const school = data.settings || {};
  const fiche = data.student;
  const student = fiche?.student;
  const fiches = data.students?.length ? data.students : (fiche ? [fiche] : []);
  const today = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="print-page">
      {type === 'bulletin' && fiches.map((item) => (
        <section className="print-sheet bulletin-sheet" key={item.student.id}>
          <header className="print-header">
            {school.logo ? <img src={school.logo} alt="" className="school-logo" /> : <div className="school-logo placeholder">K</div>}
            <div>
              <h1>{school.schoolName || 'Kelassi Moderne'}</h1>
              <p>{school.address} · {school.phone} · {school.email}</p>
              <h2>Bulletin scolaire</h2>
              <p>Année {data.year}</p>
            </div>
          </header>
          <div className="bulletin-meta">
            <p><b>Étudiant :</b> {item.student.lastName} {item.student.firstName}</p>
            <p><b>Matricule :</b> {item.student.matricule}</p>
            <p><b>Classe :</b> {item.student.className}</p>
            <p><b>Rang :</b> {item.ranking?.rankLabel || item.ranking?.rank || '—'}{item.ranking?.total ? ` / ${item.ranking.total}` : ''}</p>
          </div>
          <table>
            <thead><tr><th>Matière</th><th>Évaluation</th><th>Note</th><th>Coef.</th><th>Moyenne matière</th></tr></thead>
            <tbody>
              {(item.grades || []).map((grade) => (
                <tr key={grade.id}>
                  <td>{grade.courseTitle}</td>
                  <td>{grade.type || grade.label}</td>
                  <td>{grade.score}/20</td>
                  <td>{grade.coefficient}</td>
                  <td>{item.subjects?.find((subject) => subject.subject === grade.courseTitle)?.average || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bulletin-footer">
            <p><b>Moyenne générale :</b> {item.average || '—'} / 20</p>
            <p><b>Appréciation :</b> {item.appreciation}</p>
            <p><b>Décision :</b> {item.decision}</p>
            <p className="sign">Le chef d’établissement<br /><br />Signature et cachet<br />Fait le {today}</p>
          </div>
        </section>
      ))}

      {type === 'receipt' && data.payment && (
        <section className="print-sheet">
          <header className="print-header">
            {school.logo ? <img src={school.logo} alt="" className="school-logo" /> : <div className="school-logo placeholder">K</div>}
            <div>
              <h1>{school.schoolName || 'Kelassi Moderne'}</h1>
              <h2>Reçu de paiement</h2>
            </div>
          </header>
          <p>Reçu n° <b>{data.payment.receiptNumber}</b></p>
          <p>Étudiant : <b>{data.payment.studentName || `${student?.firstName || ''} ${student?.lastName || ''}`.trim()}</b></p>
          <p>Classe : {data.payment.className || student?.className}</p>
          <p>Motif : {data.payment.feeType}</p>
          <p>Montant : <b>{money(data.payment.amount, school.currency || 'FCFA')}</b></p>
          <p>Mode : {data.payment.method}</p>
          <p>Date : {data.payment.paidAt || data.payment.createdAt?.slice(0, 10) || today}</p>
          <p>Statut : {data.payment.status}</p>
          <p className="sign">Fait à {school.address || 'l’établissement'}, le {today}<br />Signature et cachet</p>
        </section>
      )}

      {type !== 'bulletin' && type !== 'receipt' && student && (
        <section className="print-sheet">
          <header className="print-header">
            {school.logo ? <img src={school.logo} alt="" className="school-logo" /> : <div className="school-logo placeholder">K</div>}
            <div>
              <h1>{school.schoolName || 'Kelassi Moderne'}</h1>
              <p>{school.address} · {school.phone} · {school.email}</p>
              <h2>{label}</h2>
            </div>
          </header>
          {type === 'card' ? (
            <div className="student-card">
              <div className="student-card-body">
                {student.photo
                  ? <img className="id-photo" src={student.photo} alt="" />
                  : <div className="id-photo placeholder">{student.firstName?.[0]}</div>}
                <div className="student-card-info">
                  <h3>{student.lastName} {student.firstName}</h3>
                  <p><b>Matricule :</b> {student.matricule}</p>
                  <p><b>Classe :</b> {student.className || '—'}</p>
                  <p><b>Année :</b> {data.year}</p>
                  {student.birthDate ? <p><b>Né(e) le :</b> {new Date(student.birthDate).toLocaleDateString('fr-FR')}</p> : null}
                </div>
                <div className="card-official">
                  {school.signature
                    ? <img className="card-signature" src={school.signature} alt="Signature" />
                    : <div className="card-sign-space" />}
                  <p className="card-sign-title">Le premier responsable</p>
                  {school.directorName ? <p className="card-sign-name">{school.directorName}</p> : null}
                  <p className="card-sign-hint">Signature et cachet</p>
                </div>
              </div>
              <p className="card-issued">Fait à {school.address || school.schoolName || 'l’établissement'}, le {today}</p>
            </div>
          ) : (
            <p>
              Nous soussignés, certifions que <b>{student.firstName} {student.lastName}</b>,
              matricule {student.matricule}, est {type === 'success' ? 'déclaré(e) en situation de réussite' : 'régulièrement inscrit(e)'}
              en {student.className} pour l’année scolaire {data.year}.
            </p>
          )}
          {type === 'transcript' && (
            <table>
              <thead><tr><th>Matière</th><th>Note</th></tr></thead>
              <tbody>{fiche.grades.map((grade) => <tr key={grade.id}><td>{grade.courseTitle}</td><td>{grade.score}/20</td></tr>)}</tbody>
            </table>
          )}
          {type === 'convocation' && <p>Vous êtes convoqué(e) à la direction de l’établissement. Merci de vous présenter avec ce document.</p>}
          {type !== 'card' && <p className="sign">Fait à {school.address || 'l’établissement'}, le {today}</p>}
        </section>
      )}
      <button type="button" className="btn no-print" onClick={() => window.print()}>📥 Télécharger PDF / Imprimer</button>
    </div>
  );
}

export default PrintDocument;
