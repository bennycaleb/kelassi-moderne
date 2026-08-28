import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import PresenceMark from '../../components/PresenceMark';
import { DOCUMENT_TYPES } from '../../constants';
import { api, money } from '../../services/api';
import { getAiDesk } from '../../services/ai';

function PortalShell({ title, children }) {
  return (
    <div>
      <div className="page-header"><h1>{title}</h1></div>
      {children}
    </div>
  );
}

export function TeacherHome() {
  const [data, setData] = useState(null);
  const [desk, setDesk] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/auth/me').then(async (me) => {
      const teacherId = me.teacher?.id;
      const [profile, announcements, timetable, ai] = await Promise.all([
        teacherId ? api(`/api/teachers/${teacherId}`) : Promise.resolve({}),
        api('/api/announcements'),
        api('/api/timetable'),
        getAiDesk().catch(() => null)
      ]);
      setDesk(ai);
      setData({ me, profile, announcements: announcements.announcements, timetable: timetable.timetable });
    }).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement…</p>;

  const teacher = data.me.teacher || data.profile.teacher || {};
  const first = teacher.firstName || data.me.user?.name || '';

  return (
    <PortalShell title={`Bonjour ${teacher.lastName ? `M. ${teacher.lastName}` : first} 👋`}>
      {desk ? (
        <div className="panel">
          <h2>Kelassi IA — élèves à suivre</h2>
          {desk.risks?.length
            ? desk.risks.slice(0, 6).map((item) => (
              <p key={item.id} className={item.level === 'danger' ? 'alert-danger' : 'alert-warning'}>
                <b>{item.name}</b> ({item.className}) — {(item.reasons || []).join(', ')}
              </p>
            ))
            : <p>Aucun élève n’est signalé en difficulté dans vos classes.</p>}
          <Link className="btn btn-secondary btn-sm" to="/teacher/ai">Parler à Kelassi IA</Link>
        </div>
      ) : null}
      <div className="grid-three">
        <div className="panel"><h2>Mes classes</h2>{(data.profile.classes || []).map((item) => <p key={item.id}>{item.name} — {item.studentsCount} élèves</p>)}</div>
        <div className="panel"><h2>Mes cours</h2>{(data.profile.courses || []).map((item) => <p key={item.id}>{item.title} — {item.className}</p>)}</div>
        <div className="panel"><h2>Messages</h2>{(data.announcements || []).slice(0, 4).map((item) => <p key={item.id}>{item.title}</p>)}</div>
      </div>
      <div className="panel">
        <h2>Mon emploi du temps</h2>
        {(data.timetable || []).map((slot) => (
          <p key={slot.id}>{slot.day} — {slot.startTime}–{slot.endTime} · {slot.subjectName} — {slot.className} — {slot.room || 'Salle'}</p>
        ))}
      </div>
      <div className="row-actions">
        <Link className="btn" to="/teacher/face">Scan visage</Link>
        <Link className="btn btn-secondary" to="/teacher/evaluations">Évaluations</Link>
        <Link className="btn btn-secondary" to="/teacher/academic">Règles de notation</Link>
        <Link className="btn btn-secondary" to="/teacher/courses">Cours & devoirs</Link>
        <Link className="btn btn-secondary" to="/teacher/attendance">Présences</Link>
        <Link className="btn btn-secondary" to="/teacher/grades">Notes</Link>
      </div>
    </PortalShell>
  );
}

export function StudentHome() {
  const [data, setData] = useState(null);
  const [desk, setDesk] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/auth/me'), api('/api/courses'), api('/api/announcements'), api('/api/work'), getAiDesk().catch(() => null)])
      .then(([me, courses, announcements, work, ai]) => {
        setDesk(ai);
        setData({ me, courses: courses.courses, announcements: announcements.announcements, work: work.work || [] });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement…</p>;

  const fiche = data.me.fiche || {};
  const student = fiche.student || data.me.student || {};

  return (
    <PortalShell title={`Bonjour ${student.firstName || ''} 👋`}>
      {desk?.briefing ? (
        <div className="panel">
          <h2>Kelassi IA</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{desk.briefing}</p>
          <p className="muted-line">Le bouton bleu en bas à droite répond à tes questions (moyenne, rang, révisions).</p>
        </div>
      ) : null}
      <div className="grid-three">
        <div className="stat-card panel"><h3>📊 Ma moyenne</h3><p><b>{fiche.average || '—'}/20</b></p></div>
        <div className="stat-card panel"><h3>🏆 Mon rang</h3><p><b>{fiche.ranking?.rankLabel || '—'}</b>{fiche.ranking?.total ? ` / ${fiche.ranking.total}` : ''}</p></div>
        <div className="stat-card panel"><h3>🕐 Mes absences</h3><p><b>{fiche.absences || 0}</b></p></div>
        <div className="stat-card panel"><h3>💰 Ma scolarité</h3><p><b>{fiche.tuition?.statusLabel || '—'}</b>{fiche.tuition?.due ? ` · reste ${fiche.tuition.due}` : fiche.paidPercent ? ` · ${fiche.paidPercent} %` : ''}</p></div>
      </div>
      <div className="grid-two">
        <div className="panel">
          <h2>📚 Mes cours & devoirs</h2>
          {(data.work || []).slice(0, 6).map((item) => (
            <p key={item.id}>
              {item.type === 'devoir' ? 'Devoir' : 'Cours'} — {item.title}
              {item.mySubmission?.score !== null && item.mySubmission?.score !== undefined && item.mySubmission?.score !== '' ? ` · note ${item.mySubmission.score}/20` : ''}
            </p>
          ))}
          <Link className="btn btn-secondary btn-sm" to="/student/courses">Ouvrir</Link>
        </div>
        <div className="panel">
          <h2>📅 Mon emploi du temps</h2>
          {(fiche.timetable || []).map((slot) => (
            <p key={slot.id}>{slot.day} — {slot.startTime}–{slot.endTime} · {slot.subjectName} ({slot.room})</p>
          ))}
        </div>
      </div>
      <div className="grid-two">
        <div className="panel">
          <h2>📝 Mes notes</h2>
          {(fiche.grades || []).map((item) => <p key={item.id}>{item.courseTitle} : {item.score}/20</p>)}
        </div>
        <div className="panel">
          <h2>📢 Annonces</h2>
          {data.announcements.map((item) => <p key={item.id}>{item.title} — {item.body}</p>)}
        </div>
      </div>
      <div className="panel">
        <h2>📄 Mes documents</h2>
        <div className="row-actions">
          {DOCUMENT_TYPES.filter((item) => item.id !== 'receipt').map((item) => (
            <a key={item.id} className="btn btn-secondary btn-sm" href={`/print/${item.id}?studentId=${student.id}`} target="_blank" rel="noreferrer">{item.label}</a>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ChildFiche({ fiche }) {
  const child = fiche.student || {};
  const today = todayKey();
  const todayRecord = (fiche.attendance || []).find((item) => item.date === today);
  const recentAttendance = (fiche.attendance || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);

  return (
    <div className="parent-child-card">
      <div className="person-cell">
        <Avatar src={child.photo} name={child.firstName} size="profile" />
        <div>
          <h3>{child.firstName} {child.lastName}</h3>
          <p>{child.className || 'Sans classe'} · {child.matricule}</p>
        </div>
      </div>
      <div className="grid-three">
        <div className="stat-card panel">
          <h3>📍 Aujourd’hui</h3>
          <p>
            {todayRecord
              ? <><PresenceMark status={todayRecord.status} /> {todayRecord.status}{todayRecord.method === 'facial' ? ' (scan visage)' : ''}</>
              : <b>Pas encore d’appel</b>}
          </p>
        </div>
        <div className="stat-card panel"><h3>📊 Moyenne</h3><p><b>{fiche.average || '—'}/20</b></p></div>
        <div className="stat-card panel"><h3>🏆 Rang</h3><p><b>{fiche.ranking?.rankLabel || '—'}</b>{fiche.ranking?.total ? ` / ${fiche.ranking.total}` : ''}</p></div>
        <div className="stat-card panel"><h3>🕐 Absences</h3><p><b>{fiche.absences || 0}</b> · {fiche.lates || 0} retard(s)</p></div>
        <div className="stat-card panel"><h3>💰 Scolarité</h3><p><b>{fiche.tuition?.statusLabel || 'Non renseigné'}</b>{fiche.tuition?.due ? ` · reste ${fiche.tuition.due}` : ''}</p></div>
      </div>
      <div className="grid-two">
        <div className="panel">
          <h2>Présences</h2>
          {recentAttendance.length
            ? recentAttendance.map((item) => (
              <p key={item.id}>{item.date} — <PresenceMark status={item.status} /> {item.status}{item.method === 'facial' ? ' (reconnaissance faciale)' : ''}{item.justified ? ' (justifié)' : ''}</p>
            ))
            : <p>Aucune présence enregistrée pour le moment.</p>}
        </div>
        <div className="panel">
          <h2>Notes</h2>
          {(fiche.grades || []).length
            ? (fiche.grades || []).map((item) => <p key={item.id}>{item.courseTitle} ({item.type || item.label}) : {item.score}/20</p>)
            : <p>Aucune note pour le moment.</p>}
        </div>
      </div>
      <div className="grid-two">
        <div className="panel">
          <h2>Emploi du temps</h2>
          {(fiche.timetable || []).length
            ? (fiche.timetable || []).map((slot) => (
              <p key={slot.id}>{slot.day} — {slot.startTime}–{slot.endTime} · {slot.subjectName} ({slot.room || 'Salle'})</p>
            ))
            : <p>Aucun créneau pour cette classe.</p>}
        </div>
        <div className="panel">
          <h2>Paiements</h2>
          {(fiche.payments || []).length
            ? (fiche.payments || []).map((item) => <p key={item.id}>{item.feeType} — {money(item.amount)} ({item.status})</p>)
            : <p>Aucun paiement enregistré.</p>}
        </div>
      </div>
      <div className="panel">
        <h2>Documents</h2>
        <div className="row-actions">
          {DOCUMENT_TYPES.filter((item) => item.id !== 'receipt').map((item) => (
            <a key={item.id} className="btn btn-secondary btn-sm" href={`/print/${item.id}?studentId=${child.id}`} target="_blank" rel="noreferrer">{item.label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ParentHome() {
  const [data, setData] = useState(null);
  const [desk, setDesk] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/auth/me'), api('/api/parent/children'), getAiDesk().catch(() => null)])
      .then(([me, children, ai]) => {
        setDesk(ai);
        setData({ me, children: children.children });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Chargement…</p>;

  const parent = data.me.parent || {};
  const name = parent.lastName ? `M. ${parent.lastName}` : (data.me.user?.name || '');

  return (
    <PortalShell title={`Bonjour ${name} 👋`}>
      {desk?.briefing ? (
        <div className="panel">
          <h2>Kelassi IA</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{desk.briefing}</p>
        </div>
      ) : null}
      <h2>Mes enfants</h2>
      {(data.children || []).length === 0 ? (
        <div className="panel">
          <p><b>Aucun enfant n’est encore lié à ce compte.</b></p>
          <p>L’administration doit aller dans <b>Parents / tuteurs</b>, cliquer sur <b>Lier les enfants</b> et cocher l’élève. Ensuite le parent voit la présence (y compris le scan visage), les notes, l’emploi du temps et les documents.</p>
        </div>
      ) : (data.children || []).map((fiche) => (
        <ChildFiche key={fiche.student.id} fiche={fiche} />
      ))}
    </PortalShell>
  );
}

export function SimpleList({ title, path, field, line }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(path).then((data) => setItems(data[field] || [])).catch((err) => setError(err.message));
  }, [path, field]);
  if (error) return <p className="error">{error}</p>;
  if (!items) return <p>Chargement…</p>;
  return (
    <PortalShell title={title}>
      <div className="panel">{items.map((item) => <p key={item.id}>{line(item)}</p>)}</div>
    </PortalShell>
  );
}

export function PaymentsList() {
  const [data, setData] = useState(null);
  useEffect(() => { api('/api/payments').then(setData).catch(() => {}); }, []);
  if (!data) return <p>Chargement…</p>;
  const tuition = data.tuition;
  return (
    <PortalShell title="💰 Mes paiements">
      {tuition && (
        <div className="panel">
          <p><b>{tuition.statusLabel}</b> — payé {money(tuition.paid)}{tuition.due ? ` · reste ${money(tuition.due)}` : ''}{tuition.paidPercent ? ` · ${tuition.paidPercent} %` : ''}</p>
        </div>
      )}
      <div className="panel">
        {(data.payments || []).length === 0 ? <p>Aucun paiement enregistré pour le moment.</p> : (data.payments || []).map((item) => (
          <p key={item.id}>
            {item.studentName || ''} {item.feeType} — {money(item.amount)} ({item.status}){' '}
            {item.status === 'payé' && <a href={`/print/receipt?paymentId=${item.id}&studentId=${item.studentId}`} target="_blank" rel="noreferrer">Reçu PDF</a>}
          </p>
        ))}
      </div>
    </PortalShell>
  );
}

export function StudentAbsences({ title = '🕐 Mes absences' }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/api/attendance').then((data) => setItems(data.attendance)).catch(() => {}); }, []);
  if (!items) return <p>Chargement…</p>;
  return (
    <PortalShell title={title}>
      <div className="panel">
        {items.length === 0 ? <p>Aucune présence enregistrée pour le moment.</p> : items.map((item) => (
          <p key={item.id}>
            {item.date} — {item.studentName ? `${item.studentName} · ` : ''}
            <PresenceMark status={item.status} /> {item.status}
            {item.method === 'facial' ? ' (reconnaissance faciale)' : ''}
            {item.justified ? ' (justifié)' : ''}
          </p>
        ))}
      </div>
    </PortalShell>
  );
}

export function StudentDocuments() {
  const [me, setMe] = useState(null);
  useEffect(() => { api('/api/auth/me').then(setMe).catch(() => {}); }, []);
  const student = me?.fiche?.student || me?.student;
  if (!student) return <p>Chargement…</p>;
  return (
    <PortalShell title="📄 Mes documents">
      <div className="panel row-actions">
        {DOCUMENT_TYPES.filter((item) => item.id !== 'receipt').map((item) => (
          <a key={item.id} className="btn btn-secondary" href={`/print/${item.id}?studentId=${student.id}`} target="_blank" rel="noreferrer">{item.label}</a>
        ))}
      </div>
    </PortalShell>
  );
}

export function ParentDocuments() {
  const [children, setChildren] = useState(null);
  useEffect(() => {
    api('/api/parent/children').then((data) => setChildren(data.children || [])).catch(() => setChildren([]));
  }, []);
  if (!children) return <p>Chargement…</p>;
  if (!children.length) {
    return (
      <PortalShell title="📄 Documents">
        <div className="panel"><p>Aucun enfant lié. Demandez à l’administration de cocher l’élève dans Parents / tuteurs.</p></div>
      </PortalShell>
    );
  }
  return (
    <PortalShell title="📄 Documents">
      {children.map((fiche) => {
        const child = fiche.student;
        return (
          <div className="panel" key={child.id}>
            <h2>{child.firstName} {child.lastName}</h2>
            <div className="row-actions">
              {DOCUMENT_TYPES.filter((item) => item.id !== 'receipt').map((item) => (
                <a key={item.id} className="btn btn-secondary" href={`/print/${item.id}?studentId=${child.id}`} target="_blank" rel="noreferrer">{item.label}</a>
              ))}
            </div>
          </div>
        );
      })}
    </PortalShell>
  );
}

export function TeacherMessages() {
  return <SimpleList title="Messages" path="/api/announcements" field="announcements" line={(item) => `${item.title} — ${item.body}`} />;
}

export default StudentHome;
