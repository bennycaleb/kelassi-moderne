const school = require('./school');

const STAFF = ['admin', 'superadmin', 'director', 'secretary', 'accountant'];
const askBuckets = new Map();

function fold(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function llmConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY
    || process.env.GROQ_API_KEY
    || process.env.ANTHROPIC_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
  );
}

function allowAsk(sessionId) {
  const now = Date.now();
  const recent = (askBuckets.get(sessionId) || []).filter((stamp) => now - stamp < 60000);
  if (recent.length >= 20) return false;
  recent.push(now);
  askBuckets.set(sessionId, recent);
  return true;
}

function assessRisk(row) {
  const reasons = [];
  let score = 0;
  const average = Number(row.average || 0);
  const absences = Number(row.absences || 0);
  const lates = Number(row.lates || 0);
  const tuitionStatus = row.tuition?.status || '';

  if (average > 0 && average < 10) {
    score += 40;
    reasons.push(`moyenne ${average}/20`);
  } else if (average > 0 && average < 12) {
    score += 18;
    reasons.push(`moyenne fragile ${average}/20`);
  }
  if (absences >= 5) {
    score += 30;
    reasons.push(`${absences} absences`);
  } else if (absences >= 3) {
    score += 18;
    reasons.push(`${absences} absences`);
  }
  if (lates >= 4) {
    score += 12;
    reasons.push(`${lates} retards`);
  }
  if (tuitionStatus === 'impayé') {
    score += 22;
    reasons.push('scolarité impayée');
  } else if (tuitionStatus === 'partiel') {
    score += 12;
    reasons.push('scolarité partielle');
  }
  const weak = (row.subjects || []).filter((item) => Number(item.average || 0) > 0 && Number(item.average) < 10);
  if (weak.length) {
    score += Math.min(20, weak.length * 8);
    reasons.push(`faible en ${weak.map((item) => item.subject).slice(0, 3).join(', ')}`);
  }

  let level = 'ok';
  if (score >= 45) level = 'danger';
  else if (score >= 22) level = 'warning';
  return { score, level, reasons };
}

function compactStudent(db, student, year, session) {
  const fiche = school.studentFiche(db, student, year);
  const canContact = STAFF.includes(session?.role) || session?.role === 'teacher' || session?.role === 'parent';
  const row = {
    id: student.id,
    kind: 'élève',
    name: `${student.lastName || ''} ${student.firstName || ''}`.trim(),
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    matricule: student.matricule || '',
    className: fiche.student?.className || school.classNameOf(db, student),
    classId: student.classId || '',
    status: student.status || 'actif',
    average: fiche.average || 0,
    rankLabel: fiche.ranking?.rankLabel || '—',
    rank: fiche.ranking?.rank || 0,
    classSize: fiche.ranking?.total || 0,
    absences: fiche.absences || 0,
    lates: fiche.lates || 0,
    presenceRate: fiche.presenceRate || 0,
    email: canContact ? (student.email || '') : '',
    phone: canContact ? (student.phone || '') : '',
    parents: (fiche.parents || []).map((item) => `${item.lastName || ''} ${item.firstName || ''}`.trim()).filter(Boolean),
    tuition: {
      status: fiche.tuition?.status || 'non renseigné',
      statusLabel: fiche.tuition?.statusLabel || 'Non renseigné',
      paid: fiche.tuition?.paid || 0,
      due: fiche.tuition?.due || 0
    },
    subjects: (fiche.subjects || []).map((item) => ({ subject: item.subject, average: item.average })),
    decision: fiche.decision,
    appreciation: fiche.appreciation
  };
  row.risk = assessRisk(row);
  return row;
}

function visibleStudents(db, session, year) {
  let students = db.students.filter((item) => school.inYear(item, year));
  if (session.role === 'teacher') {
    const teacher = db.teachers.find((item) => item.userId === session.id);
    const classIds = school.teacherClassIds(db, teacher);
    students = students.filter((item) => classIds.includes(item.classId));
  } else if (session.role === 'student') {
    students = students.filter((item) => item.userId === session.id);
  } else if (session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === session.id);
    const ids = school.linkedStudentIds(db, parent);
    students = students.filter((item) => ids.includes(item.id));
  } else if (!STAFF.includes(session.role)) {
    students = [];
  }
  return students.map((item) => compactStudent(db, item, year, session));
}

function visibleTeachers(db, session, year, snapshots) {
  const classIds = [...new Set(snapshots.map((item) => item.classId).filter(Boolean))];
  let teachers = (db.teachers || []).filter((item) => item.status !== 'inactif');
  if (session.role === 'student' || session.role === 'parent' || session.role === 'teacher') {
    const courseTeacherIds = (db.courses || [])
      .filter((course) => school.inYear(course, year) && classIds.includes(course.classId))
      .map((course) => course.teacherId);
    if (session.role === 'teacher') {
      const me = db.teachers.find((item) => item.userId === session.id);
      teachers = teachers.filter((item) => item.id === me?.id || courseTeacherIds.includes(item.id));
    } else {
      teachers = teachers.filter((item) => courseTeacherIds.includes(item.id));
    }
  }
  return teachers.map((teacher) => {
    const full = school.withTeacher(db, teacher);
    return {
      id: teacher.id,
      kind: 'enseignant',
      name: school.fullName(teacher),
      firstName: teacher.firstName || '',
      lastName: teacher.lastName || '',
      email: STAFF.includes(session.role) ? (teacher.email || '') : '',
      phone: STAFF.includes(session.role) ? (teacher.phone || '') : '',
      subjects: full.subjects || [],
      classes: (full.classes || []).map((item) => item.name)
    };
  });
}

function visibleParents(db, session, snapshots) {
  if (!STAFF.includes(session.role) && session.role !== 'teacher') return [];
  const allowed = new Set(snapshots.map((item) => item.id));
  return (db.parents || []).filter((parent) => (parent.childrenIds || []).some((id) => allowed.has(id))).map((parent) => ({
    id: parent.id,
    kind: 'parent',
    name: `${parent.lastName || ''} ${parent.firstName || ''}`.trim() || parent.name || '',
    firstName: parent.firstName || '',
    lastName: parent.lastName || '',
    email: parent.email || '',
    phone: parent.phone || '',
    children: (parent.childrenIds || [])
      .map((id) => snapshots.find((item) => item.id === id)?.name)
      .filter(Boolean)
  }));
}

function visibleStaff(db, session) {
  if (!STAFF.includes(session.role)) return [];
  const labels = {
    owner: 'Entreprise Kelassi', superadmin: 'Super Admin', admin: 'Administrateur',
    director: 'Directeur', secretary: 'Secrétaire', accountant: 'Comptable'
  };
  return (db.users || [])
    .filter((user) => STAFF.includes(user.role))
    .map((user) => ({
      id: user.id,
      kind: 'personnel',
      name: user.name || user.email || '',
      email: user.email || '',
      role: labels[user.role] || user.role
    }));
}

function classSummaries(db, year, snapshots) {
  return db.classes.filter((item) => school.inYear(item, year)).map((classroom) => {
    const members = snapshots.filter((item) => item.classId === classroom.id);
    const withAvg = members.filter((item) => item.average > 0);
    const avg = withAvg.length
      ? Math.round((withAvg.reduce((sum, item) => sum + item.average, 0) / withAvg.length) * 10) / 10
      : 0;
    return {
      id: classroom.id,
      name: classroom.name,
      level: classroom.level || classroom.cycleName || '',
      room: classroom.room || '',
      students: members.length,
      average: avg,
      atRisk: members.filter((item) => item.risk.level !== 'ok').length,
      members: members.map((item) => item.name)
    };
  });
}

function tokens(value) {
  return fold(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

function mentioned(q, person) {
  if (person.matricule && q.includes(fold(person.matricule))) return true;
  const asked = new Set(tokens(q));
  const names = tokens(`${person.firstName || ''} ${person.lastName || ''} ${person.name || ''}`);
  return names.some((name) => asked.has(name));
}

function pickPeople(q, directory) {
  return directory.filter((item) => mentioned(q, item));
}

function buildContext(db, session, year, message = '') {
  const snapshots = visibleStudents(db, session, year);
  const teachers = visibleTeachers(db, session, year, snapshots);
  const parents = visibleParents(db, session, snapshots);
  const staff = visibleStaff(db, session);
  const classes = classSummaries(db, year, snapshots);
  const directory = [
    ...snapshots.map((item) => ({ ...item, kind: 'élève' })),
    ...teachers,
    ...parents,
    ...staff
  ];
  const q = fold(message);
  const namedPeople = pickPeople(q, directory);
  const namedClasses = classes.filter((item) => fold(item.name) && q.includes(fold(item.name)));
  const risks = snapshots
    .filter((item) => item.risk.level !== 'ok')
    .sort((a, b) => b.risk.score - a.risk.score);
  const relevantStudents = namedPeople.filter((item) => item.kind === 'élève');
  const focus = (session.role === 'student' || session.role === 'parent' || relevantStudents.length)
    ? (relevantStudents.length ? relevantStudents : snapshots)
    : snapshots.filter((item) => item.risk.level !== 'ok').slice(0, 12);
  const unpaid = snapshots.filter((item) => item.tuition.status === 'impayé' || item.tuition.status === 'partiel');
  const courses = (db.courses || [])
    .filter((item) => school.inYear(item, year))
    .filter((item) => {
      if (STAFF.includes(session.role)) return true;
      return snapshots.some((student) => student.classId === item.classId);
    })
    .map((item) => school.withCourse(db, item))
    .map((item) => ({ title: item.title, className: item.className, teacherName: item.teacherName, subjectName: item.subjectName }));
  const timetable = (db.timetable || [])
    .filter((item) => school.inYear(item, year))
    .filter((item) => STAFF.includes(session.role) || snapshots.some((student) => student.classId === item.classId))
    .slice(0, 40)
    .map((item) => school.withSlot(db, item))
    .map((item) => ({ day: item.day, startTime: item.startTime, className: item.className, subjectName: item.subjectName, teacherName: item.teacherName, room: item.room }));
  const subjects = (db.subjects || []).map((item) => item.name).filter(Boolean);
  return {
    schoolName: db.settings?.schoolName || 'École',
    year,
    role: session.role,
    userName: session.name || session.email || '',
    currency: db.settings?.currency || 'FC',
    directorName: db.settings?.directorName || '',
    tuitionAmount: Number(db.settings?.tuitionAmount || 0),
    guide: SYSTEM_GUIDE,
    totals: {
      students: snapshots.length,
      teachers: teachers.length,
      parents: parents.length,
      staff: staff.length,
      classes: classes.length,
      atRisk: risks.length,
      unpaid: unpaid.length,
      classAverage: (() => {
        const withAvg = snapshots.filter((item) => item.average > 0);
        return withAvg.length
          ? Math.round((withAvg.reduce((sum, item) => sum + item.average, 0) / withAvg.length) * 10) / 10
          : 0;
      })()
    },
    classes,
    teachers,
    parents,
    staff,
    namedPeople,
    namedClasses,
    directory: directory.map((item) => ({
      kind: item.kind,
      name: item.name,
      className: item.className,
      role: item.role,
      subjects: item.subjects,
      classes: item.classes,
      children: item.children,
      matricule: item.matricule
    })),
    risks: risks.slice(0, 20).map((item) => ({
      id: item.id,
      name: item.name,
      className: item.className,
      average: item.average,
      rankLabel: item.rankLabel,
      absences: item.absences,
      tuition: item.tuition.statusLabel,
      reasons: item.risk.reasons,
      level: item.risk.level
    })),
    unpaid: unpaid.slice(0, 20).map((item) => ({
      name: item.name,
      className: item.className,
      status: item.tuition.statusLabel,
      due: item.tuition.due,
      paid: item.tuition.paid
    })),
    focus: focus.map((item) => ({
      name: item.name,
      className: item.className,
      matricule: item.matricule,
      average: item.average,
      rankLabel: item.rankLabel,
      classSize: item.classSize,
      absences: item.absences,
      lates: item.lates,
      email: item.email,
      phone: item.phone,
      parents: item.parents,
      tuition: item.tuition,
      subjects: item.subjects,
      decision: item.decision,
      appreciation: item.appreciation,
      reasons: item.risk?.reasons
    })),
    courses,
    subjects,
    timetable,
    announcements: (db.announcements || []).filter((item) => school.inYear(item, year)).slice(0, 8).map((item) => ({
      title: item.title,
      body: String(item.body || '').slice(0, 180)
    }))
  };
}

const SYSTEM_GUIDE = [
  { keys: ['connexion', 'login', 'mot de passe', 'se connecter'], text: 'Connexion : page /login avec l’email et le mot de passe du compte (admin, enseignant, élève ou parent).' },
  { keys: ['etudiant', 'eleve', 'inscrire', 'inscription'], text: 'Étudiants : menu Étudiants pour inscrire, modifier, supprimer, scanner le visage et ouvrir la fiche (notes, rang, scolarité, bulletin, carte).' },
  { keys: ['enseignant', 'prof', 'professeur'], text: 'Enseignants : menu Enseignants. Un prof se connecte à /teacher pour ses cours, l’appel, le scan visage, les notes et Kelassi IA.' },
  { keys: ['classe'], text: 'Classes : menu Classes. Ouvrez une classe pour la liste (rang, moyenne, scolarité), l’emploi du temps et « Générer les bulletins ».' },
  { keys: ['matiere', 'cours'], text: 'Matières puis Cours : un cours relie une matière, une classe et un enseignant. Sans cours, on ne peut pas saisir les notes.' },
  { keys: ['emploi', 'horaire', 'edt'], text: 'Emploi du temps : menu Emploi du temps. Visible aussi par l’élève et le parent.' },
  { keys: ['appel', 'presence', 'absence', 'retard', 'visage', 'face'], text: 'Présences : menu Présences (appel manuel) ou Scan visage. L’élève voit Mes absences, le parent voit Présences.' },
  { keys: ['note', 'moyenne', 'evaluation', 'coefficient', 'notation'], text: 'Notes : menu Notes (grille). Les moyennes et le rang (1er, 2ème…) se calculent tout seuls. Règles de notation et Évaluations définissent les barèmes.' },
  { keys: ['rang', 'classement', 'premier'], text: 'Le rang est calculé par classe, moyenne décroissante : 1er, 2ème… Les ex æquo ont le même rang. Visible sur la classe, la fiche, le bulletin et les portails.' },
  { keys: ['bulletin', 'document', 'carte', 'certificat', 'recu', 'pdf'], text: 'Documents : menu Documents, ou fiche élève, ou classe → Générer les bulletins. Carte d’étudiant, reçu de paiement, certificats. Signature du premier responsable dans Paramètres.' },
  { keys: ['paiement', 'scolarite', 'paye', 'impaye', 'versement'], text: 'Paiements : menu Paiements. Situation par élève, Marquer payé, versement, reçu PDF. Indiquez le montant de scolarité attendu dans Paramètres.' },
  { keys: ['parent', 'tuteur'], text: 'Parents : menu Parents, lier aux enfants. Le parent se connecte à /parent (notes, absences, paiements, bulletin).' },
  { keys: ['annonce', 'communication', 'message'], text: 'Annonces : menu Annonces / Communication. Visibles selon l’espace (admin, prof, élève, parent).' },
  { keys: ['ia', 'kelassi ia', 'assistant', 'intelligence'], text: 'Kelassi IA répond à toute question sur l’école, les personnes (élèves, profs, parents, personnel) et l’usage de Kelassi, dans la limite de ce que votre compte a le droit de voir. Elle ne change pas les notes ni les paiements.' },
  { keys: ['parametre', 'signature', 'responsable', 'devise', 'annee'], text: 'Paramètres : nom de l’école, année, devise, scolarité attendue, nom et signature du premier responsable.' },
  { keys: ['utilisateur', 'admin', 'comptable', 'secretaire', 'directeur'], text: 'Utilisateurs : comptes du personnel. Rôles : admin, directeur, secrétaire, comptable. L’enseignant, l’élève et le parent ont leurs propres espaces.' }
];

function suggestionsFor(role) {
  if (role === 'student') {
    return ['Qui est mon professeur ?', 'Comment voir mon bulletin ?', 'Explique mes résultats'];
  }
  if (role === 'parent') {
    return ['Qui enseigne à mon enfant ?', 'Comment payer la scolarité ?', 'Comment va mon enfant ?'];
  }
  if (role === 'teacher') {
    return ['Qui sont mes élèves ?', 'Comment faire l’appel ?', 'Comment saisir les notes ?'];
  }
  return ['Qui sont les enseignants ?', 'Comment marquer un élève payé ?', 'Comment générer les bulletins ?'];
}

function listRisks(risks) {
  if (!risks.length) return 'Aucun élève n’est signalé en difficulté pour le moment.';
  return risks.slice(0, 10).map((item) => (
    `• ${item.name} (${item.className}) — ${item.reasons.join(', ')}`
  )).join('\n');
}

function describeStudent(item) {
  const subjects = (item.subjects || []).map((subject) => `${subject.subject} ${subject.average}/20`).join(', ');
  return [
    `${item.name} — élève${item.className ? ` en ${item.className}` : ''}${item.matricule ? `, matricule ${item.matricule}` : ''}.`,
    `Moyenne ${item.average || '—'}/20, rang ${item.rankLabel}${item.classSize ? ` / ${item.classSize}` : ''}, décision « ${item.decision || '—'} ».`,
    `${item.absences || 0} absence(s), ${item.lates || 0} retard(s), scolarité : ${item.tuition?.statusLabel || '—'}.`,
    item.parents?.length ? `Parent(s) : ${item.parents.join(', ')}.` : '',
    item.email ? `Contact : ${item.email}${item.phone ? ` · ${item.phone}` : ''}.` : '',
    subjects ? `Matières : ${subjects}.` : 'Pas encore de notes.',
    item.appreciation ? `Appréciation : ${item.appreciation}` : ''
  ].filter(Boolean).join('\n');
}

function describeTeacher(item) {
  return `${item.name} — enseignant.${item.subjects?.length ? ` Matières : ${item.subjects.join(', ')}.` : ''}${item.classes?.length ? ` Classes : ${item.classes.join(', ')}.` : ''}${item.email ? ` Contact : ${item.email}.` : ''}`;
}

function describeParent(item) {
  return `${item.name} — parent.${item.children?.length ? ` Enfant(s) : ${item.children.join(', ')}.` : ''}${item.email ? ` ${item.email}` : ''}${item.phone ? ` · ${item.phone}` : ''}`;
}

function describeStaff(item) {
  return `${item.name} — ${item.role || 'personnel'}${item.email ? ` (${item.email})` : ''}.`;
}

function describePerson(item) {
  if (item.kind === 'enseignant') return describeTeacher(item);
  if (item.kind === 'parent') return describeParent(item);
  if (item.kind === 'personnel') return describeStaff(item);
  return describeStudent(item);
}

function matchGuide(q) {
  const hits = SYSTEM_GUIDE.filter((item) => item.keys.some((key) => q.includes(fold(key))));
  if (!hits.length) return '';
  return hits.map((item) => item.text).join('\n');
}

function localAnswer(message, context) {
  const q = fold(message);
  const role = context.role;

  if (context.namedPeople?.length) {
    return context.namedPeople.slice(0, 6).map(describePerson).join('\n\n');
  }

  const howTo = q.includes('comment') || q.includes('ou trouver') || q.includes('ou est') || q.includes('comment faire') || q.includes('a quoi sert') || q.includes('c est quoi') || q.includes('kelassi');
  const guide = matchGuide(q);
  if (howTo && guide) return guide;
  if (guide && (q.includes('menu') || q.includes('page') || q.includes('bouton') || q.includes('fonction'))) return guide;

  if (q.includes('enseignant') || q.includes('professeur') || q.includes('prof ') || q.endsWith('prof') || q.includes('les profs')) {
    if (!context.teachers?.length) return 'Aucun enseignant visible dans votre périmètre.';
    return `Enseignants :\n${context.teachers.map((item) => `• ${describeTeacher(item)}`).join('\n')}`;
  }
  if ((q.includes('eleve') || q.includes('etudiant')) && (q.includes('qui') || q.includes('liste') || q.includes('combien') || q.includes('tous'))) {
    if (!context.directory) return briefingText(context);
    const students = (context.classes || []).flatMap((classroom) => (classroom.members || []).map((name) => `• ${name} (${classroom.name})`));
    const unique = [...new Set(students)];
    return unique.length ? `Élèves (${context.totals.students}) :\n${unique.slice(0, 40).join('\n')}` : 'Aucun élève visible.';
  }
  if (q.includes('parent') && (q.includes('qui') || q.includes('liste'))) {
    if (!context.parents?.length) return STAFF.includes(role) || role === 'teacher' ? 'Aucun parent enregistré dans ce périmètre.' : 'Les fiches parents sont réservées à l’administration.';
    return `Parents :\n${context.parents.map((item) => `• ${describeParent(item)}`).join('\n')}`;
  }
  if (q.includes('personnel') || q.includes('admin') || q.includes('directeur') || q.includes('comptable') || q.includes('utilisateur')) {
    if (!context.staff?.length) return 'La liste du personnel est réservée à l’administration.';
    return `Personnel :\n${context.staff.map((item) => `• ${describeStaff(item)}`).join('\n')}`;
  }
  if (context.namedClasses?.length) {
    return context.namedClasses.map((item) => (
      `${item.name}${item.level ? ` (${item.level})` : ''} — ${item.students} élève(s), moyenne ${item.average || '—'}/20.${item.members?.length ? `\nÉlèves : ${item.members.join(', ')}.` : ''}`
    )).join('\n\n');
  }
  if (q.includes('classe') && (q.includes('liste') || q.includes('quelles') || q.includes('combien') || q.includes('qui'))) {
    if (!context.classes?.length) return 'Aucune classe visible.';
    return context.classes.map((item) => `• ${item.name} — ${item.students} élève(s), moyenne ${item.average || '—'}/20`).join('\n');
  }
  if (q.includes('emploi') || q.includes('horaire') || q.includes('edt')) {
    if (!context.timetable?.length) return 'Aucun créneau d’emploi du temps pour votre périmètre.';
    return context.timetable.slice(0, 20).map((item) => `• ${item.day} ${item.startTime} — ${item.subjectName} (${item.className}) ${item.teacherName || ''} ${item.room || ''}`).join('\n');
  }
  if (q.includes('cours') || q.includes('matiere')) {
    if (q.includes('quelles matiere') || q.includes('liste des matiere') || (!context.courses?.length && context.subjects?.length)) {
      return `Matières : ${(context.subjects || []).join(', ') || '—'}`;
    }
    if (!context.courses?.length) return 'Aucun cours visible.';
    return context.courses.slice(0, 25).map((item) => `• ${item.title} — ${item.className} (${item.teacherName || 'sans prof'})`).join('\n');
  }
  if (q.includes('annonce')) {
    if (!context.announcements?.length) return 'Aucune annonce pour le moment.';
    return context.announcements.map((item) => `• ${item.title} — ${item.body}`).join('\n');
  }

  if (q.includes('briefing') || q.includes('synthese') || q.includes('resume') || q.includes('aujourd')) {
    return briefingText(context);
  }
  if (q.includes('difficulte') || q.includes('decroche') || q.includes('alerte') || q.includes('risque')) {
    return `Voici les élèves à suivre :\n${listRisks(context.risks)}`;
  }
  if (q.includes('impay') || q.includes('scolarite') || q.includes('paiement') || q.includes('paye')) {
    const help = matchGuide(q);
    const money = !context.unpaid.length
      ? 'Aucun impayé n’est visible avec les données actuelles.'
      : `Situation scolarité :\n${context.unpaid.map((item) => `• ${item.name} (${item.className}) — ${item.status}${item.due ? `, reste ${item.due}` : ''}`).join('\n')}`;
    return help ? `${money}\n\n${help}` : money;
  }
  if (q.includes('appreciation') || q.includes('redige') || q.includes('ecris')) {
    const item = context.focus[0];
    if (q.includes('annonce') || (q.includes('message') && q.includes('parent'))) {
      return `Brouillon d’annonce :\nChers parents, le suivi de l’année ${context.year} se poursuit via Kelassi. Merci de consulter notes, présence et scolarité dans votre espace.`;
    }
    if (item) {
      const weak = (item.subjects || []).filter((subject) => Number(subject.average || 0) > 0 && Number(subject.average) < 12);
      return `Appréciation proposée pour ${item.name} (${item.className}) : ${item.appreciation || 'Résultats en cours d’évaluation.'} Moyenne ${item.average || '—'}/20, rang ${item.rankLabel}.${weak.length ? ` Vigilance sur ${weak.map((subject) => subject.subject).join(', ')}.` : ''} Décision : ${item.decision || '—'}.`;
    }
  }
  if (q.includes('moyenne') || q.includes('note') || q.includes('bulletin') || q.includes('resultat')) {
    if (guide && howTo) return guide;
    if (context.focus.length === 1) return describeStudent(context.focus[0]);
    return `Moyenne générale de l’effectif visible : ${context.totals.classAverage || '—'}/20. ${context.totals.atRisk} élève(s) à suivre.${guide ? `\n\n${guide}` : ''}`;
  }
  if (q.includes('rang') || q.includes('premier') || q.includes('classement')) {
    if (context.focus.length === 1) {
      const item = context.focus[0];
      return `${item.name} est ${item.rankLabel}${item.classSize ? ` / ${item.classSize}` : ''} en ${item.className}, moyenne ${item.average || '—'}/20.`;
    }
    if (role === 'student' && context.focus[0]) {
      const item = context.focus[0];
      return `Tu es ${item.rankLabel}${item.classSize ? ` sur ${item.classSize}` : ''} dans ${item.className}.`;
    }
    const top = [...context.focus, ...context.risks].filter((item) => item.rankLabel && item.rankLabel !== '—');
    return top.length
      ? top.slice(0, 8).map((item) => `• ${item.name} — ${item.rankLabel} (${item.className})`).join('\n')
      : 'Pas encore assez de notes pour un classement.';
  }
  if (q.includes('absence') || q.includes('presence') || q.includes('retard') || q.includes('appel')) {
    if (howTo && guide) return guide;
    const rows = (context.focus.length ? context.focus : context.risks).filter((item) => item.absences);
    if (!rows.length) return guide || 'Pas d’absences notables dans le périmètre visible.';
    return `${rows.slice(0, 10).map((item) => `• ${item.name} — ${item.absences} absence(s), ${item.lates || 0} retard(s)`).join('\n')}${guide ? `\n\n${guide}` : ''}`;
  }
  if (q.includes('revision') || q.includes('progresser') || q.includes('travailler') || q.includes('plan')) {
    const item = context.focus[0];
    if (!item) return 'Indiquez un élève, ou ouvrez l’espace élève pour un plan personnalisé.';
    const weak = (item.subjects || []).filter((subject) => Number(subject.average || 0) > 0 && Number(subject.average) < 12)
      .sort((a, b) => a.average - b.average);
    if (!weak.length) return `${item.name} a des résultats réguliers. Continuer le rythme actuel suffit.`;
    return `Plan ciblé pour ${item.name} :\n${weak.map((subject, index) => `${index + 1}. ${subject.subject} (${subject.average}/20) — 30 à 45 min, 3 fois cette semaine.`).join('\n')}`;
  }
  if (context.focus.length === 1 && (q.includes('comment va') || q.includes('situation'))) {
    return describeStudent(context.focus[0]);
  }
  if (guide) return guide;

  return [
    briefingText(context),
    '',
    'Je peux répondre à n’importe quelle question sur l’école, les personnes (élèves, enseignants, parents, personnel) et l’utilisation de Kelassi (notes, appel, bulletins, paiements, carte, etc.). Posez votre question librement.'
  ].join('\n');
}

function briefingText(context) {
  const lines = [
    `Briefing ${context.schoolName} — ${context.year}`,
    `${context.totals.students} élève(s), ${context.totals.teachers || 0} enseignant(s), ${context.totals.classes} classe(s), moyenne ${context.totals.classAverage || '—'}/20.`,
    context.totals.atRisk
      ? `${context.totals.atRisk} élève(s) à suivre (notes, absences ou scolarité).`
      : 'Aucun signal fort de décrochage pour l’instant.',
    context.totals.unpaid ? `${context.totals.unpaid} dossier(s) de scolarité non soldé(s).` : 'Pas d’impayé visible.',
    context.risks.length ? `Priorité :\n${listRisks(context.risks.slice(0, 5))}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}

function systemPrompt(role) {
  const base = `Tu es Kelassi IA, l’assistant de l’établissement scolaire.
Tu réponds à TOUTE question sur :
- les personnes de l’école (élèves, enseignants, parents, personnel) présentes dans les données ;
- le fonctionnement de Kelassi (menus, comment faire un appel, des notes, un bulletin, un paiement, une carte, etc.) ;
- les résultats, le rang, les absences, la scolarité, les cours, l’emploi du temps, les annonces.

Les suggestions d’exemple ne limitent PAS les questions. Si on te demande quelque chose de lié à l’école ou au logiciel, tu réponds.
Tu t’appuies UNIQUEMENT sur les données JSON et le guide fournis. Tu n’inventes jamais une note, un rang, un paiement, une absence ou une personne.
Tu ne modifies pas les notes ni les paiements.
Réponds en français, clair et utile. Si l’info n’est pas dans les données, dis-le et indique où la trouver dans Kelassi si le guide le permet.
Ne révèle pas les mots de passe.`;
  if (role === 'student') {
    return `${base}
Tu tutoyes l’élève. Tu ne donnes pas les notes ou la vie scolaire des autres élèves.`;
  }
  if (role === 'parent') {
    return `${base}
Tu parles au parent. Tu ne parles que de ses enfants, sauf pour expliquer comment utiliser Kelassi.`;
  }
  if (role === 'teacher') {
    return `${base}
Tu aides l’enseignant sur ses classes, ses élèves, et l’usage de Kelassi.`;
  }
  return `${base}
Tu aides la direction et le secrétariat sur toute l’école et tout le logiciel.`;
}

async function callLlm(system, context, message, history) {
  const payload = JSON.stringify(context);
  const userText = `DONNÉES (périmètre de l’utilisateur) :\n${payload}\n\nQUESTION :\n${message}`;
  const messages = [
    { role: 'system', content: system },
    ...(Array.isArray(history) ? history.slice(-6) : []),
    { role: 'user', content: userText }
  ];

  if (process.env.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1400,
        messages
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI a refusé la requête');
    return data.choices?.[0]?.message?.content?.trim();
  }

  if (process.env.GROQ_API_KEY) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 1400,
        messages
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq a refusé la requête');
    return data.choices?.[0]?.message?.content?.trim();
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-3-5-haiku-latest',
        max_tokens: 1400,
        system,
        messages: messages.filter((item) => item.role !== 'system')
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Anthropic a refusé la requête');
    return (data.content || []).map((item) => item.text || '').join('\n').trim();
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const model = process.env.AI_MODEL || 'gemini-2.0-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }]
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini a refusé la requête');
    return (data.candidates?.[0]?.content?.parts || []).map((item) => item.text || '').join('\n').trim();
  }

  throw new Error('Aucune clé IA configurée');
}

async function ask(db, session, year, message, history) {
  const text = String(message || '').trim();
  if (!text) {
    return { status: 400, body: { success: false, message: 'Écrivez une question.' } };
  }
  if (text.length > 4000) {
    return { status: 400, body: { success: false, message: 'Question trop longue.' } };
  }
  if (!allowAsk(session.id)) {
    return { status: 429, body: { success: false, message: 'Trop de questions. Réessayez dans une minute.' } };
  }
  const context = buildContext(db, session, year, text);
  let mode = 'local';
  let answer = localAnswer(text, context);
  if (llmConfigured()) {
    try {
      const generated = await callLlm(systemPrompt(session.role), context, text, history);
      if (generated) {
        answer = generated;
        mode = 'llm';
      }
    } catch {
      mode = 'local';
    }
  }
  return {
    status: 200,
    body: {
      success: true,
      answer,
      mode,
      suggestions: suggestionsFor(session.role)
    }
  };
}

function desk(db, session, year) {
  const context = buildContext(db, session, year, '');
  return {
    success: true,
    mode: llmConfigured() ? 'llm' : 'local',
    briefing: briefingText(context),
    risks: context.risks,
    unpaid: context.unpaid,
    totals: context.totals,
    suggestions: suggestionsFor(session.role)
  };
}

async function draft(db, session, year, kind, studentId) {
  const context = buildContext(db, session, year, studentId || kind || '');
  let prompt = '';
  if (kind === 'appreciation') {
    const target = context.focus.find((item) => item.name && studentId) || context.focus[0];
    if (studentId) {
      const snapshots = visibleStudents(db, session, year);
      const found = snapshots.find((item) => item.id === studentId);
      if (!found) return { status: 404, body: { success: false, message: 'Élève introuvable dans votre périmètre' } };
      prompt = `Rédige une appréciation de bulletin (4 à 6 phrases) pour ${found.name}, classe ${found.className}, moyenne ${found.average}/20, rang ${found.rankLabel}, matières ${JSON.stringify(found.subjects)}, absences ${found.absences}. Ton professionnel, français scolaire.`;
    } else if (target) {
      prompt = `Rédige une appréciation de bulletin pour ${target.name}.`;
    } else {
      return { status: 400, body: { success: false, message: 'Choisissez un élève.' } };
    }
  } else if (kind === 'announcement') {
    prompt = 'Rédige une courte annonce aux parents (8 lignes max) à partir des alertes et impayés.';
  } else if (kind === 'revision') {
    prompt = 'Propose un plan de révision de 7 jours, concret, à partir des matières faibles.';
  } else {
    prompt = kind || 'Fais un briefing.';
  }
  return ask(db, session, year, prompt, []);
}

module.exports = {
  llmConfigured,
  buildContext,
  visibleStudents,
  desk,
  ask,
  draft,
  suggestionsFor
};
