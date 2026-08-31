import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, money } from '../../services/api';
import { DOCUMENT_TYPES } from '../../constants';

function documentPlace(school) {
  const address = String(school.address || '');
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return school.schoolName || 'l’établissement';
  const last = parts[parts.length - 1];
  if (/^(rdc|rc|drc|congo|république du congo|republique du congo)$/i.test(last) && parts.length > 1) {
    return parts[0];
  }
  return last;
}

function fmtNote(value) {
  const number = Number(value);
  if (!number) return '—';
  return number.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function subjectComment(average) {
  if (average >= 16) return 'Excellente maîtrise des notions.';
  if (average >= 14) return 'Très bonne maîtrise des notions.';
  if (average >= 12) return 'Travail sérieux.';
  if (average >= 10) return 'Des bases acquises, à approfondir.';
  if (average > 0) return 'Des difficultés. Un effort soutenu est nécessaire.';
  return '—';
}

function bulletinRows(item, classSubjectAverages) {
  const fromSubjects = item.subjects || [];
  const names = [];
  fromSubjects.forEach((row) => {
    if (row.subject && !names.includes(row.subject)) names.push(row.subject);
  });
  Object.keys(classSubjectAverages || {}).forEach((name) => {
    if (!names.includes(name)) names.push(name);
  });
  (item.grades || []).forEach((grade) => {
    if (grade.courseTitle && !names.includes(grade.courseTitle)) names.push(grade.courseTitle);
  });
  return names.map((name) => {
    const row = fromSubjects.find((subject) => subject.subject === name);
    const average = row?.average;
    return {
      subject: name,
      studentAvg: average,
      classAvg: classSubjectAverages?.[name],
      comment: row?.comment || subjectComment(average),
      highlight: Number(average) >= 16
    };
  });
}

function CongoEmblem({ clipId }) {
  const id = clipId || 'congo-circle';
  return (
    <div className="congo-emblem">
      <svg className="congo-flag" viewBox="0 0 72 72" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <circle cx="36" cy="36" r="35" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect width="72" height="72" fill="#009543" />
          <polygon points="72,0 72,72 0,72" fill="#dc241f" />
          <polygon points="-8,72 80,0 92,12 4,84" fill="#fbde4a" />
        </g>
        <circle cx="36" cy="36" r="35" fill="none" stroke="#1a1a1a" strokeWidth="1.4" />
      </svg>
      <strong>République du Congo</strong>
      <span>Unité, Travail, Progrès</span>
    </div>
  );
}

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
  const place = documentPlace(school);
  const classInfo = data.class || {};
  const classAverages = data.classSubjectAverages || {};

  return (
    <div className="print-page">
      {type === 'bulletin' && fiches.map((item) => {
        const rows = bulletinRows(item, classAverages);
        const classSize = item.ranking?.total || classInfo.studentsCount || '—';
        const rankLabel = item.ranking?.rankLabel || item.ranking?.rank || '—';
        return (
          <section className="print-sheet bulletin-official" key={item.student.id}>
            <header className="bulletin-head">
              <CongoEmblem clipId={`congo-circle-${item.student.id}`} />
              <div className="bulletin-title-block">
                <h1>BULLETIN SCOLAIRE</h1>
                <p>Année scolaire {data.year}</p>
              </div>
              <div className="bulletin-school">
                {school.logo ? <img src={school.logo} alt="" /> : null}
                <strong>{school.schoolName || 'Kelassi Moderne'}</strong>
                {school.address ? <span>{school.address}</span> : null}
                {school.phone ? <span>Tél. {school.phone}</span> : null}
                {school.email ? <span>{school.email}</span> : null}
              </div>
            </header>

            <div className="bulletin-id">
              <p><span>Nom et prénom</span> <b>{item.student.lastName}, {item.student.firstName}</b></p>
              <p><span>Nombre d’élèves dans la classe</span> <b>{classSize}</b></p>
              <p>
                <span>Né(e) le</span>
                <b>{item.student.birthDate ? new Date(item.student.birthDate).toLocaleDateString('fr-FR') : '—'}</b>
              </p>
              <p><span>Professeur principal</span> <b>{classInfo.mainTeacherName || '—'}</b></p>
              <p><span>Classe</span> <b>{item.student.className || '—'}</b></p>
              <p><span>Établissement</span> <b>{school.schoolName || '—'}</b></p>
            </div>

            <table className="bulletin-table">
              <thead>
                <tr>
                  <th>Disciplines</th>
                  <th>Moyennes de l’élève /20</th>
                  <th>Moyennes de la classe /20</th>
                  <th>Appréciations</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row) => (
                  <tr key={row.subject} className={row.highlight ? 'is-strong' : undefined}>
                    <td>{row.subject}</td>
                    <td className="num">{fmtNote(row.studentAvg)}</td>
                    <td className="num">{fmtNote(row.classAvg)}</td>
                    <td>{row.comment}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="4">Aucune note enregistrée pour cette année.</td></tr>
                )}
              </tbody>
            </table>

            <div className="bulletin-summary">
              <div className="bulletin-box">
                <small>Moyenne générale de l’élève</small>
                <strong>{item.average ? `${fmtNote(item.average)} / 20` : '—'}</strong>
              </div>
              <div className="bulletin-box">
                <small>Moyenne générale de la classe</small>
                <strong>{classInfo.average ? `${fmtNote(classInfo.average)} / 20` : '—'}</strong>
              </div>
              <div className="bulletin-box">
                <small>Rang de l’élève dans la classe</small>
                <strong>{rankLabel}{classSize && classSize !== '—' ? ` / ${classSize}` : ''}</strong>
              </div>
              <div className="bulletin-box bulletin-global">
                <small>Appréciation globale</small>
                <p>{item.appreciation}</p>
                {item.decision ? <p className="bulletin-decision">Décision : {item.decision}</p> : null}
              </div>
            </div>

            <div className="bulletin-bottom">
              <div>
                <p><b>Absences :</b> {item.absences || 0} demi-journée{(item.absences || 0) > 1 ? 's' : ''}</p>
                <p><b>Retards :</b> {item.lates || 0}</p>
              </div>
              <div className="bulletin-sign">
                <p>Fait à {place}, le {today}</p>
                <p className="bulletin-sign-title">Le Chef d’établissement</p>
                {school.signature
                  ? <img className="card-signature" src={school.signature} alt="Signature" />
                  : <div className="bulletin-sign-space" />}
                {school.directorName ? <p>{school.directorName}</p> : null}
                <div className="bulletin-stamp">
                  <span>{school.schoolName || 'Kelassi Moderne'}</span>
                  <span>{place}</span>
                </div>
              </div>
            </div>
          </section>
        );
      })}

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
