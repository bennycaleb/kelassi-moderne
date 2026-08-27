const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'database', 'kelassi.json');
const CURRENT_YEAR = '2026-2027';

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_CLASSES = [
  ['6e A', 'Collège'],
  ['6e B', 'Collège'],
  ['5e A', 'Collège'],
  ['3e A', 'Collège'],
  ['2nde A', 'Lycée'],
  ['Terminale C', 'Lycée'],
  ['L1 Informatique', 'Université'],
  ['L2 Informatique', 'Université'],
  ['L3 Informatique', 'Université'],
  ['Master', 'Université']
];

const DEFAULT_SUBJECTS = [
  'Mathématiques',
  'Français',
  'Anglais',
  'Informatique',
  'Physique',
  'Réseaux',
  'Data Science',
  'Sport'
];

function seed() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'KelassiAdmin2026!';
  const createdAt = now();
  const year = CURRENT_YEAR;

  const classes = DEFAULT_CLASSES.map(([name, level], index) => ({
    id: `class_${index + 1}`,
    name,
    level,
    cycleId: cycleIdFromLevel(level, name),
    mainTeacherId: name === 'L2 Informatique' ? 't-demo' : '',
    room: `Salle ${index + 1}`,
    year,
    createdAt
  }));

  const subjects = DEFAULT_SUBJECTS.map((name, index) => ({
    id: `sub_${index + 1}`,
    name,
    code: name.slice(0, 3).toUpperCase(),
    coefficient: name === 'Mathématiques' || name === 'Informatique' ? 3 : 2
  }));

  return {
    settings: {
      schoolName: 'Kelassi Moderne',
      logo: '',
      address: 'Kinshasa, RDC',
      phone: '+243 000 000 000',
      email: 'admin@kelassi.com',
      currency: 'FC',
      currentYear: year,
      terms: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']
    },
    years: ['2025-2026', '2026-2027', '2027-2028'],
    users: [
      { id: 'u-admin', email: 'admin@kelassi.com', password: adminPassword, role: 'admin', name: 'Administrateur', createdAt },
      { id: 'u-teacher', email: 'teacher@kelassi.com', password: 'Teacher123!', role: 'teacher', name: 'Enseignant Démo', createdAt },
      { id: 'u-student', email: 'student@kelassi.com', password: 'Student123!', role: 'student', name: 'Étudiant Démo', createdAt },
      { id: 'u-parent', email: 'parent@kelassi.com', password: 'Parent123!', role: 'parent', name: 'Parent Démo', createdAt }
    ],
    students: [],
    teachers: [],
    classes,
    subjects,
    courses: [],
    grades: [],
    payments: [],
    timetable: [],
    attendance: [],
    announcements: [],
    events: [],
    parents: [],
    sanctions: [],
    workItems: [],
    submissions: [],
    cycles: defaultCycles(),
    evaluationTypes: defaultEvaluationTypes(),
    evaluations: [],
    feeTypes: [
      { id: 'fee-inscription', name: "Frais d'inscription" },
      { id: 'fee-scolarite', name: 'Frais de scolarité' },
      { id: 'fee-examen', name: "Frais d'examen" },
      { id: 'fee-autre', name: 'Autres frais' }
    ],
    schools: []
  };
}

function defaultCycles() {
  return [
    { id: 'cycle_primaire', name: 'Primaire', code: 'primaire', active: true, gradingMode: 'coefficient', teacherCanEditCoefficient: false, color: '#16a34a' },
    { id: 'cycle_college', name: 'Collège', code: 'college', active: true, gradingMode: 'coefficient', teacherCanEditCoefficient: false, color: '#2563eb' },
    { id: 'cycle_lycee', name: 'Lycée', code: 'lycee', active: true, gradingMode: 'percent', teacherCanEditCoefficient: false, color: '#7c3aed' },
    { id: 'cycle_universite', name: 'Université', code: 'universite', active: true, gradingMode: 'coefficient', teacherCanEditCoefficient: true, color: '#0f766e' }
  ];
}

function defaultEvaluationTypes() {
  return [
    { id: 'et_p1', cycleId: 'cycle_primaire', name: 'Exercice', coefficient: 1, weightPercent: 20, maxScore: 20, order: 1 },
    { id: 'et_p2', cycleId: 'cycle_primaire', name: 'Interrogation', coefficient: 1, weightPercent: 0, maxScore: 20, order: 2 },
    { id: 'et_p3', cycleId: 'cycle_primaire', name: 'Devoir', coefficient: 2, weightPercent: 30, maxScore: 20, order: 3 },
    { id: 'et_p4', cycleId: 'cycle_primaire', name: 'Composition', coefficient: 3, weightPercent: 50, maxScore: 20, order: 4 },
    { id: 'et_c1', cycleId: 'cycle_college', name: 'Interrogation', coefficient: 1, weightPercent: 0, maxScore: 20, order: 1 },
    { id: 'et_c2', cycleId: 'cycle_college', name: 'Devoir surveillé', coefficient: 2, weightPercent: 0, maxScore: 20, order: 2 },
    { id: 'et_c3', cycleId: 'cycle_college', name: 'EPR', coefficient: 2, weightPercent: 0, maxScore: 20, order: 3 },
    { id: 'et_c4', cycleId: 'cycle_college', name: 'Examen', coefficient: 3, weightPercent: 0, maxScore: 20, order: 4 },
    { id: 'et_l1', cycleId: 'cycle_lycee', name: 'Contrôle continu', coefficient: 1, weightPercent: 40, maxScore: 20, order: 1 },
    { id: 'et_l2', cycleId: 'cycle_lycee', name: 'EPR', coefficient: 1, weightPercent: 20, maxScore: 20, order: 2 },
    { id: 'et_l3', cycleId: 'cycle_lycee', name: 'Examen', coefficient: 1, weightPercent: 40, maxScore: 20, order: 3 },
    { id: 'et_u1', cycleId: 'cycle_universite', name: 'Contrôle 1', coefficient: 2, weightPercent: 0, maxScore: 20, order: 1 },
    { id: 'et_u2', cycleId: 'cycle_universite', name: 'Contrôle 2', coefficient: 2, weightPercent: 0, maxScore: 20, order: 2 },
    { id: 'et_u3', cycleId: 'cycle_universite', name: 'Examen', coefficient: 3, weightPercent: 0, maxScore: 20, order: 3 }
  ];
}

function cycleIdFromLevel(level, name) {
  const text = `${level || ''} ${name || ''}`.toLowerCase();
  if (/(^|\s)(cp|ce1|ce2|cm1|cm2)\b/.test(text) || level === 'Primaire') return 'cycle_primaire';
  if (level === 'Collège' || /(^|\s)(6e|5e|4e|3e)\b/.test(text)) return 'cycle_college';
  if (level === 'Lycée' || /(^|\s)(2nde|1ère|1ere|terminale)\b/.test(text)) return 'cycle_lycee';
  return 'cycle_universite';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function migrate(raw) {
  const first = raw.schemaVersion !== 2;
  const base = seed();
  const data = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    years: ensureArray(raw.years).length ? raw.years : base.years,
    users: ensureArray(raw.users),
    students: ensureArray(raw.students),
    teachers: ensureArray(raw.teachers),
    classes: ensureArray(raw.classes).length ? raw.classes : base.classes,
    subjects: ensureArray(raw.subjects).length ? raw.subjects : base.subjects,
    courses: ensureArray(raw.courses),
    grades: ensureArray(raw.grades),
    payments: ensureArray(raw.payments),
    timetable: ensureArray(raw.timetable),
    attendance: ensureArray(raw.attendance),
    announcements: ensureArray(raw.announcements),
    events: ensureArray(raw.events),
    parents: ensureArray(raw.parents),
    sanctions: ensureArray(raw.sanctions),
    workItems: ensureArray(raw.workItems),
    submissions: ensureArray(raw.submissions),
    cycles: ensureArray(raw.cycles).length ? raw.cycles : defaultCycles(),
    evaluationTypes: ensureArray(raw.evaluationTypes).length ? raw.evaluationTypes : defaultEvaluationTypes(),
    evaluations: ensureArray(raw.evaluations),
    feeTypes: ensureArray(raw.feeTypes).length ? raw.feeTypes : base.feeTypes,
    schools: ensureArray(raw.schools)
  };

  const year = data.settings.currentYear || CURRENT_YEAR;

  data.users.forEach((user) => {
    if (!user.role) user.role = 'student';
  });

  if (!data.users.some((user) => user.role === 'owner')) {
    data.users.push({
      id: 'u-owner',
      email: process.env.OWNER_EMAIL || 'owner@kelassi.com',
      password: process.env.OWNER_PASSWORD || 'KelassiOwner2026!',
      role: 'owner',
      name: 'Kelassi',
      schoolId: '',
      createdAt: now()
    });
  }

  if (!data.schools.length) {
    data.schools.push({
      id: 'school_kelassi',
      name: data.settings.schoolName || 'Kelassi Moderne',
      status: 'active',
      city: '',
      address: data.settings.address || '',
      phone: data.settings.phone || '',
      email: data.settings.email || '',
      adminUserId: 'u-admin',
      settings: { ...data.settings },
      createdAt: now()
    });
  }

  const demoSchoolId = data.schools[0]?.id || 'school_kelassi';
  const schoolCollections = [
    'students', 'teachers', 'classes', 'subjects', 'courses', 'grades', 'payments',
    'timetable', 'attendance', 'announcements', 'events', 'parents', 'sanctions',
    'workItems', 'submissions', 'cycles', 'evaluationTypes', 'evaluations', 'feeTypes'
  ];
  schoolCollections.forEach((key) => {
    (data[key] || []).forEach((item) => {
      if (!item.schoolId) item.schoolId = demoSchoolId;
    });
  });
  data.users.forEach((user) => {
    if (user.role === 'owner') {
      user.schoolId = '';
      return;
    }
    if (!user.schoolId) user.schoolId = demoSchoolId;
  });

  if (!data.users.some((user) => user.email === 'parent@kelassi.com')) {
    data.users.push({
      id: 'u-parent',
      email: 'parent@kelassi.com',
      password: 'Parent123!',
      role: 'parent',
      name: 'Parent Démo',
      schoolId: demoSchoolId,
      createdAt: now()
    });
  }

  data.classes.forEach((item) => {
    if (!item.year) item.year = year;
    if (!item.cycleId) item.cycleId = cycleIdFromLevel(item.level, item.name);
  });

  data.students.forEach((student, index) => {
    if (!student.year) student.year = year;
    if (!student.matricule) student.matricule = `KEL-${year.slice(0, 4)}-${String(index + 1).padStart(4, '0')}`;
    if (!student.gender) student.gender = '';
    if (!student.birthDate) student.birthDate = '';
    if (!student.address) student.address = '';
    if (!student.photo) student.photo = '';
    if (!student.parentName) student.parentName = '';
    if (!student.parentPhone) student.parentPhone = '';
    if (!student.parentEmail) student.parentEmail = '';
    if (!student.emergencyContact) student.emergencyContact = '';
    if (!Array.isArray(student.faceDescriptor)) student.faceDescriptor = [];
    if (!student.classId) {
      const found = data.classes.find((item) => item.name === student.className);
      student.classId = found ? found.id : '';
    }
    if (!student.className && student.classId) {
      const found = data.classes.find((item) => item.id === student.classId);
      student.className = found ? found.name : '';
    }
  });

  data.teachers.forEach((teacher) => {
    if (!teacher.year) teacher.year = year;
    if (!teacher.gender) teacher.gender = '';
    if (!teacher.address) teacher.address = '';
    if (!teacher.contract) teacher.contract = 'CDI';
    if (!teacher.salary) teacher.salary = '';
    if (!teacher.photo) teacher.photo = '';
    if (!Array.isArray(teacher.subjectIds)) teacher.subjectIds = [];
    if (teacher.subject && teacher.subjectIds.length === 0) {
      const found = data.subjects.find((item) => item.name === teacher.subject);
      if (found) teacher.subjectIds = [found.id];
    }
  });

  data.courses.forEach((course) => {
    if (!course.year) course.year = year;
    if (!course.hours) course.hours = 4;
    if (!course.room) course.room = '';
    if (!course.classId) {
      const found = data.classes.find((item) => item.name === course.className);
      course.classId = found ? found.id : '';
    }
    if (!course.subjectId) {
      const found = data.subjects.find((item) => item.name === course.title || item.name === course.subject);
      course.subjectId = found ? found.id : '';
    }
  });

  data.grades.forEach((grade) => {
    if (!grade.year) grade.year = year;
    if (!grade.term) grade.term = 'Trimestre 1';
    if (!grade.type) grade.type = grade.label || 'Devoir';
  });

  data.payments.forEach((payment, index) => {
    if (!payment.year) payment.year = year;
    if (!payment.feeType) payment.feeType = payment.status === 'payé' ? 'Frais de scolarité' : "Frais d'inscription";
    if (!payment.receiptNumber) payment.receiptNumber = `REC-${year.slice(0, 4)}-${String(index + 1).padStart(4, '0')}`;
    if (!payment.dueDate) payment.dueDate = '';
  });

  if (!data.parents.some((item) => item.id === 'par-demo')) {
    data.parents.push({
      id: 'par-demo',
      userId: 'u-parent',
      firstName: 'Parent',
      lastName: 'Démo',
      email: 'parent@kelassi.com',
      phone: '',
      childrenIds: data.students.map((student) => student.id),
      createdAt: now()
    });
  }

  if (first && data.announcements.length === 0) {
    data.announcements = [
      { id: 'an_1', title: 'Début des examens', body: 'Les examens commencent le 15 septembre.', date: '2026-09-15', audience: 'Tous', year, createdAt: now() },
      { id: 'an_2', title: 'Réunion des enseignants', body: 'Réunion le 3 septembre à 10h.', date: '2026-09-03', audience: 'Enseignants', year, createdAt: now() },
      { id: 'an_3', title: 'Paiement du trimestre', body: 'Le paiement du trimestre est attendu avant le 10 septembre.', date: '2026-09-10', audience: 'Parents', year, createdAt: now() }
    ];
  }

  if (first && data.events.length === 0) {
    data.events = [
      { id: 'ev_1', title: 'Réunion des parents', date: '2026-08-28', time: '15:00', place: 'Salle polyvalente', year },
      { id: 'ev_2', title: 'Rentrée administrative', date: '2026-09-01', time: '08:00', place: 'Direction', year },
      { id: 'ev_3', title: 'Conseil de classe L2', date: '2026-09-12', time: '14:00', place: 'Salle des profs', year }
    ];
  }

  if (first && data.attendance.length === 0 && data.students.length) {
    data.attendance = data.students.map((student, index) => ({
      id: id('att'),
      studentId: student.id,
      classId: student.classId,
      date: today(),
      status: index === 0 ? 'présent' : index % 3 === 0 ? 'absent' : index % 4 === 0 ? 'retard' : 'présent',
      justified: false,
      year
    }));
  }

  if (first && data.timetable.length === 0 && data.courses.length) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const hours = ['08:00', '10:00', '14:00'];
    data.courses.forEach((course, index) => {
      data.timetable.push({
        id: id('tt'),
        classId: course.classId,
        teacherId: course.teacherId,
        subjectId: course.subjectId,
        courseId: course.id,
        day: days[index % days.length],
        startTime: hours[index % hours.length],
        room: course.room || 'Salle 2',
        year
      });
    });
  }

  return data;
}

function ensureFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed(), null, 2));
  }
}

function load() {
  ensureFile();
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const migrated = migrate(raw);
    if (raw.schemaVersion !== 4) {
      migrated.schemaVersion = 4;
      fs.writeFileSync(DATA_FILE, JSON.stringify(migrated, null, 2));
    }
    return migrated;
  } catch {
    const fresh = seed();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function save(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { load, save, id, now, today, CURRENT_YEAR, cycleIdFromLevel, defaultCycles, defaultEvaluationTypes };
