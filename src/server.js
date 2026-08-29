require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { load: loadAll, save: saveAll, boot, dataDir, persistMode, flush, readSessionMap, saveSessions, id, now, today, cycleIdFromLevel } = require('./store');
const school = require('./school');
const tenant = require('./tenant');
const kelassiAi = require('./ai');

const app = express();
const PORT = Number(process.env.PORT || 5001);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const STAFF = ['admin', 'superadmin', 'director', 'secretary', 'accountant'];

function allowedOrigins() {
  const extra = String(process.env.FRONTEND_URL || process.env.APP_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    ...extra
  ];
}

function persistSessions() {
  saveSessions(sessions);
}

let sessions = new Map();

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins().includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, allowedOrigins().includes(origin));
  }
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

function generatePassword(prefix) {
  return `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
}

function load(req) {
  return tenant.read(req);
}

function save(req, data) {
  tenant.write(req, data);
}

function publicUser(user, db) {
  if (!user) return null;
  const found = db && user.schoolId ? tenant.schoolById(db, user.schoolId) : null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    schoolId: user.schoolId || '',
    schoolName: found?.name || ''
  };
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    schoolId: user.schoolId || '',
    createdAt: Date.now()
  });
  persistSessions();
  return token;
}

function loginWithEmail(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const secret = String(password || '');
  if (!normalized || !secret) {
    return { status: 400, body: { success: false, message: 'Email et mot de passe obligatoires' } };
  }
  const db = loadAll();
  const user = db.users.find((item) => item.email.toLowerCase() === normalized);
  if (!user || user.password !== secret) {
    return { status: 401, body: { success: false, message: 'Identifiants invalides' } };
  }
  if (user.role !== 'owner') {
    const found = tenant.schoolById(db, user.schoolId);
    if (found && found.status === 'suspended') {
      return { status: 403, body: { success: false, message: 'Cette école est suspendue. Contactez Kelassi.' } };
    }
  }
  return {
    status: 200,
    body: { success: true, message: 'Connexion réussie', token: createSession(user), user: publicUser(user, db) }
  };
}

function getToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  const session = token && sessions.get(token);
  if (!session) return res.status(401).json({ success: false, message: 'Non authentifié' });
  if (!session.schoolId && session.role !== 'owner') {
    const user = loadAll().users.find((item) => item.id === session.id);
    if (user) session.schoolId = user.schoolId || '';
  }
  req.session = session;
  next();
}

function requireStaff(req, res, next) {
  requireAuth(req, res, () => {
    if (!STAFF.includes(req.session.role)) {
      return res.status(403).json({ success: false, message: 'Accès administration requis' });
    }
    next();
  });
}

const requireAdmin = requireStaff;

function requireOwner(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Espace réservé à l’entreprise Kelassi' });
    }
    next();
  });
}

function requireSchool(req, res, next) {
  requireAuth(req, res, () => {
    if (!STAFF.includes(req.session.role) && req.session.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’établissement et aux enseignants' });
    }
    next();
  });
}

function pick(body, fields, fallback = {}) {
  const result = { ...fallback };
  fields.forEach((field) => {
    if (body[field] !== undefined) result[field] = body[field];
  });
  return result;
}

function uploadDir() {
  return path.join(dataDir(), 'uploads');
}
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function sessionTeacher(db, session) {
  return db.teachers.find((item) => item.userId === session.id) || null;
}

function sessionStudent(db, session) {
  return db.students.find((item) => item.userId === session.id) || null;
}

function sessionParent(db, session) {
  return (db.parents || []).find((item) => item.userId === session.id) || null;
}

function asIdList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value) return [String(value)];
  return [];
}

function parentChildIds(db, parent) {
  return school.linkedStudentIds(db, parent);
}

function saveUpload(prefix, fileName, dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Fichier invalide. Envoyez un PDF ou une image.');
    error.status = 400;
    throw error;
  }
  const mime = match[1];
  if (!ALLOWED_MIME.includes(mime) && !mime.includes('pdf')) {
    const error = new Error('Format non accepté. Utilisez un PDF, Word ou une image.');
    error.status = 400;
    throw error;
  }
  const ext = path.extname(fileName || '') || (mime.includes('pdf') ? '.pdf' : '.bin');
  const storedName = `${prefix}_${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.mkdirSync(uploadDir(), { recursive: true });
  fs.writeFileSync(path.join(uploadDir(), storedName), Buffer.from(match[2], 'base64'));
  return { storedName, originalName: fileName || storedName, mime };
}

function removeUpload(storedName) {
  if (!storedName) return;
  const filePath = path.join(uploadDir(), path.basename(storedName));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function sendUpload(res, storedName, originalName, mime) {
  const filePath = path.join(uploadDir(), path.basename(storedName || ''));
  if (!storedName || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Fichier introuvable' });
  }
  res.setHeader('Content-Type', mime || 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName || storedName)}"`);
  return res.sendFile(filePath);
}

function canManageWork(db, session, work) {
  if (STAFF.includes(session.role)) return true;
  const teacher = sessionTeacher(db, session);
  return Boolean(teacher && work && work.teacherId === teacher.id);
}

app.get('/api/health', (req, res) => res.json({
  success: true,
  message: 'Serveur Kelassi Moderne opérationnel',
  database: persistMode(),
  frontend: fs.existsSync(path.join(DIST_DIR, 'index.html'))
}));

app.get('/api/tenants', requireOwner, (req, res) => {
  const db = tenant.loadAll();
  return res.json({ success: true, schools: (db.schools || []).map((item) => tenant.publicSchool(db, item)) });
});

app.post('/api/tenants', requireOwner, (req, res) => {
  const result = tenant.createTenant(req.body || {});
  return res.status(result.status).json(result.body);
});

app.put('/api/tenants/:id', requireOwner, (req, res) => {
  const db = tenant.loadAll();
  const found = tenant.schoolById(db, req.params.id);
  if (!found) return res.status(404).json({ success: false, message: 'École introuvable' });
  if (req.body.name) found.name = String(req.body.name).trim();
  if (req.body.city !== undefined) found.city = String(req.body.city);
  if (req.body.status === 'active' || req.body.status === 'suspended') found.status = req.body.status;
  if (found.settings) found.settings.schoolName = found.name;
  tenant.saveAll(db);
  return res.json({ success: true, school: tenant.publicSchool(db, found) });
});

app.put('/api/tenants/:id/password', requireOwner, (req, res) => {
  const password = String(req.body.password || '').trim();
  if (password.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
  const db = tenant.loadAll();
  const found = tenant.schoolById(db, req.params.id);
  if (!found) return res.status(404).json({ success: false, message: 'École introuvable' });
  const admin = db.users.find((item) => item.id === found.adminUserId);
  if (!admin) return res.status(404).json({ success: false, message: 'Admin de l’école introuvable' });
  admin.password = password;
  tenant.saveAll(db);
  return res.json({ success: true, message: 'Mot de passe admin mis à jour', credentials: { email: admin.email, password } });
});

app.post('/api/auth/login', (req, res) => {
  const result = loginWithEmail(req.body.email, req.body.password);
  return res.status(result.status).json(result.body);
});
app.post('/api/auth/admin/login', (req, res) => {
  const result = loginWithEmail(req.body.username || req.body.email, req.body.password);
  return res.status(result.status).json(result.body);
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = load(req);
  const user = db.users.find((item) => item.id === req.session.id);
  if (!user) return res.status(401).json({ success: false, message: 'Session invalide' });
  const year = school.yearOf(req, db);
  const payload = { user: publicUser(user, db), settings: db.settings, years: db.years, year };
  if (user.role === 'student') {
    const student = db.students.find((item) => item.userId === user.id);
    payload.student = student ? school.withStudent(db, student) : null;
    payload.fiche = student ? school.studentFiche(db, student, year) : null;
  }
  if (user.role === 'teacher') {
    const teacher = db.teachers.find((item) => item.userId === user.id);
    payload.teacher = teacher ? school.withTeacher(db, teacher) : null;
  }
  if (user.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === user.id) || null;
    if (parent && school.syncFamilyLinks(db, { parent })) save(req, db);
    payload.parent = parent;
  }
  return res.json({ success: true, ...payload });
});

app.get('/api/auth/admin/me', requireAdmin, (req, res) => res.json({ success: true, user: publicUser(req.session) }));
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = getToken(req);
  if (token) {
    sessions.delete(token);
    persistSessions();
  }
  return res.json({ success: true, message: 'Déconnexion réussie' });
});
app.post('/api/auth/admin/logout', (req, res) => {
  const token = getToken(req);
  if (token) {
    sessions.delete(token);
    persistSessions();
  }
  return res.json({ success: true, message: 'Déconnexion réussie' });
});

app.get('/api/meta', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  return res.json({
    success: true,
    settings: db.settings,
    years: db.years,
    year,
    classes: db.classes.filter((item) => school.inYear(item, year)).map((classroom) => {
      const cycle = school.cycleOfClass(db, classroom);
      return {
        ...classroom,
        cycleId: classroom.cycleId || cycle?.id || '',
        cycleName: cycle?.name || classroom.level || '',
        gradingMode: cycle?.gradingMode || 'coefficient'
      };
    }),
    subjects: db.subjects,
    feeTypes: db.feeTypes,
    cycles: db.cycles || [],
    evaluationTypes: db.evaluationTypes || [],
    teachers: db.teachers.map((item) => school.withTeacher(db, item)),
    roles: STAFF.concat(['teacher', 'student', 'parent'])
  });
});

app.put('/api/settings', requireStaff, (req, res) => {
  const db = load(req);
  db.settings = { ...db.settings, ...pick(req.body, ['schoolName', 'logo', 'address', 'phone', 'email', 'currency', 'currentYear', 'terms', 'tuitionAmount', 'directorName', 'signature', 'momoName', 'momoNumber', 'airtelMoneyName', 'airtelMoneyNumber', 'paymentInstructions']) };
  if (req.body.tuitionAmount !== undefined) db.settings.tuitionAmount = Number(req.body.tuitionAmount) || 0;
  if (req.body.currentYear && !db.years.includes(req.body.currentYear)) db.years.push(req.body.currentYear);
  save(req, db);
  return res.json({ success: true, settings: db.settings, years: db.years });
});

app.get('/api/stats', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  return res.json({ success: true, year, ...school.buildStats(db, year) });
});

app.get('/api/students', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let students = db.students.filter((item) => school.inYear(item, year));
  const ranks = school.rankingsByClass(db, year);
  students = students.map((item) => school.withTuition(db, school.withRank(db, item, year, ranks), year));
  if (req.session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === req.session.id);
    students = students.filter((item) => parent && parentChildIds(db, parent).includes(item.id));
  }
  if (req.session.role === 'student') {
    students = students.filter((item) => item.userId === req.session.id);
  }
  if (req.query.classId) students = students.filter((item) => item.classId === req.query.classId);
  return res.json({ success: true, students });
});

app.get('/api/students/faces', requireAuth, (req, res) => {
  if (!STAFF.includes(req.session.role) && req.session.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Accès reconnaissance faciale réservé au personnel' });
  }
  const db = load(req);
  const year = school.yearOf(req, db);
  let students = db.students.filter((item) => school.inYear(item, year));
  if (req.query.classId) students = students.filter((item) => item.classId === req.query.classId);
  return res.json({
    success: true,
    students: students.map((item) => school.withStudentFace(db, item)).filter((item) => item.hasFace)
  });
});

app.get('/api/students/:id', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const student = db.students.find((item) => item.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Étudiant introuvable' });
  return res.json({ success: true, ...school.studentFiche(db, student, year) });
});

app.post('/api/students', requireStaff, (req, res) => {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ success: false, message: 'Prénom, nom et email obligatoires' });
  }
  const db = load(req);
  const year = school.yearOf(req, db);
  if (db.users.some((item) => item.email.toLowerCase() === email)) {
    return res.status(409).json({ success: false, message: 'Cet email a déjà un compte' });
  }
  const classroom = school.classById(db, req.body.classId) || db.classes.find((item) => item.name === req.body.className);
  const password = String(req.body.password || '').trim() || generatePassword('Eleve');
  const userId = id('u');
  const student = {
    id: id('s'),
    userId,
    matricule: req.body.matricule || school.nextMatricule(db, year),
    firstName,
    lastName,
    email,
    phone: String(req.body.phone || ''),
    photo: req.body.photo || '',
    faceDescriptor: Array.isArray(req.body.faceDescriptor) ? req.body.faceDescriptor.map(Number) : [],
    birthDate: req.body.birthDate || '',
    gender: req.body.gender || '',
    address: req.body.address || '',
    classId: classroom ? classroom.id : '',
    className: classroom ? classroom.name : (req.body.className || ''),
    year,
    parentName: req.body.parentName || '',
    parentPhone: req.body.parentPhone || '',
    parentEmail: req.body.parentEmail || '',
    emergencyContact: req.body.emergencyContact || '',
    status: 'actif',
    createdAt: now()
  };
  db.users.push({ id: userId, email, password, role: 'student', name: `${firstName} ${lastName}`, createdAt: now() });
  db.students.push(student);
  school.syncFamilyLinks(db, { student });
  save(req, db);
  return res.status(201).json({ success: true, message: 'Étudiant inscrit et compte ouvert', student: school.withStudent(db, student), credentials: { email, password } });
});

app.put('/api/students/:id', requireStaff, (req, res) => {
  const db = load(req);
  const student = db.students.find((item) => item.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Étudiant introuvable' });
  const email = String(req.body.email || student.email).trim().toLowerCase();
  if (db.users.some((item) => item.email.toLowerCase() === email && item.id !== student.userId)) {
    return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
  }
  Object.assign(student, pick(req.body, ['firstName', 'lastName', 'phone', 'photo', 'birthDate', 'gender', 'address', 'parentName', 'parentPhone', 'parentEmail', 'emergencyContact', 'status', 'matricule']));
  if (Array.isArray(req.body.faceDescriptor) && req.body.faceDescriptor.length) {
    student.faceDescriptor = req.body.faceDescriptor.map(Number);
  }
  student.email = email;
  if (req.body.classId && req.body.classId !== student.classId) {
    student.history = Array.isArray(student.history) ? student.history : [];
    student.history.push({ year: student.year, className: student.className, until: today() });
  }
  if (req.body.classId) {
    const classroom = school.classById(db, req.body.classId);
    student.classId = req.body.classId;
    student.className = classroom ? classroom.name : student.className;
  } else if (req.body.className) {
    const classroom = db.classes.find((item) => item.name === req.body.className);
    student.className = req.body.className;
    student.classId = classroom ? classroom.id : student.classId;
  }
  const user = db.users.find((item) => item.id === student.userId);
  if (user) {
    user.email = email;
    user.name = `${student.firstName} ${student.lastName}`;
  }
  school.syncFamilyLinks(db, { student });
  save(req, db);
  return res.json({ success: true, student: school.withStudent(db, student) });
});

app.post('/api/students/:id/reset-password', requireStaff, (req, res) => {
  const db = load(req);
  const student = db.students.find((item) => item.id === req.params.id);
  const user = student && db.users.find((item) => item.id === student.userId);
  if (!student || !user) return res.status(404).json({ success: false, message: 'Étudiant introuvable' });
  const password = generatePassword('Eleve');
  user.password = password;
  save(req, db);
  return res.json({ success: true, credentials: { email: user.email, password } });
});

app.post('/api/students/:id/sanctions', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const sanction = { id: id('san'), studentId: req.params.id, label: req.body.label || 'Avertissement', detail: req.body.detail || '', date: req.body.date || today(), year };
  db.sanctions.push(sanction);
  save(req, db);
  return res.status(201).json({ success: true, sanction });
});

app.delete('/api/sanctions/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.sanctions = db.sanctions.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Sanction supprimée' });
});

app.delete('/api/students/:id', requireStaff, (req, res) => {
  const db = load(req);
  const student = db.students.find((item) => item.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Étudiant introuvable' });
  db.students = db.students.filter((item) => item.id !== student.id);
  db.users = db.users.filter((item) => item.id !== student.userId);
  db.grades = db.grades.filter((item) => item.studentId !== student.id);
  db.payments = db.payments.filter((item) => item.studentId !== student.id);
  db.attendance = db.attendance.filter((item) => item.studentId !== student.id);
  db.sanctions = db.sanctions.filter((item) => item.studentId !== student.id);
  db.parents.forEach((parent) => {
    parent.childrenIds = (parent.childrenIds || []).filter((childId) => childId !== student.id);
  });
  save(req, db);
  return res.json({ success: true, message: 'Étudiant et compte supprimés' });
});

app.get('/api/teachers', requireAuth, (req, res) => {
  const db = load(req);
  return res.json({ success: true, teachers: db.teachers.map((item) => school.withTeacher(db, item)) });
});

app.get('/api/teachers/:id', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const teacher = db.teachers.find((item) => item.id === req.params.id);
  if (!teacher) return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
  const courses = db.courses.filter((item) => item.teacherId === teacher.id && school.inYear(item, year)).map((item) => school.withCourse(db, item));
  const classIds = [...new Set(courses.map((item) => item.classId).filter(Boolean))];
  const classes = db.classes.filter((item) => classIds.includes(item.id)).map((classroom) => ({
    ...classroom,
    ...school.classStats(db, classroom, year)
  }));
  const timetable = db.timetable.filter((item) => item.teacherId === teacher.id && school.inYear(item, year)).map((item) => school.withSlot(db, item));
  const grades = db.grades.filter((grade) => courses.some((course) => course.id === grade.courseId) && school.inYear(grade, year)).map((item) => school.withGrade(db, item));
  const attendance = db.attendance.filter((item) => classIds.includes(item.classId) && school.inYear(item, year)).map((item) => school.withAttendance(db, item));
  return res.json({
    success: true,
    teacher: school.withTeacher(db, teacher),
    courses,
    classes,
    timetable,
    grades,
    gradesCount: grades.length,
    attendance,
    presenceRate: school.presenceRate(attendance)
  });
});

app.post('/api/teachers', requireStaff, (req, res) => {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!firstName || !lastName || !email) return res.status(400).json({ success: false, message: 'Prénom, nom et email obligatoires' });
  const db = load(req);
  if (db.users.some((item) => item.email.toLowerCase() === email)) return res.status(409).json({ success: false, message: 'Cet email a déjà un compte' });
  const password = String(req.body.password || '').trim() || generatePassword('Prof');
  const userId = id('u');
  const subjectIds = Array.isArray(req.body.subjectIds) ? req.body.subjectIds : (req.body.subject ? [db.subjects.find((item) => item.name === req.body.subject)?.id].filter(Boolean) : []);
  const teacher = {
    id: id('t'),
    userId,
    firstName,
    lastName,
    email,
    phone: req.body.phone || '',
    photo: req.body.photo || '',
    gender: req.body.gender || '',
    address: req.body.address || '',
    subject: req.body.subject || school.subjectById(db, subjectIds[0])?.name || '',
    subjectIds,
    contract: req.body.contract || 'CDI',
    salary: req.body.salary || '',
    status: 'actif',
    year: school.yearOf(req, db),
    createdAt: now()
  };
  db.users.push({ id: userId, email, password, role: 'teacher', name: `${firstName} ${lastName}`, createdAt: now() });
  db.teachers.push(teacher);
  save(req, db);
  return res.status(201).json({ success: true, teacher: school.withTeacher(db, teacher), credentials: { email, password } });
});

app.put('/api/teachers/:id', requireStaff, (req, res) => {
  const db = load(req);
  const teacher = db.teachers.find((item) => item.id === req.params.id);
  if (!teacher) return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
  const email = String(req.body.email || teacher.email).trim().toLowerCase();
  if (db.users.some((item) => item.email.toLowerCase() === email && item.id !== teacher.userId)) {
    return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
  }
  Object.assign(teacher, pick(req.body, ['firstName', 'lastName', 'phone', 'photo', 'gender', 'address', 'subject', 'subjectIds', 'contract', 'salary', 'status']));
  teacher.email = email;
  const user = db.users.find((item) => item.id === teacher.userId);
  if (user) {
    user.email = email;
    user.name = `${teacher.firstName} ${teacher.lastName}`;
  }
  save(req, db);
  return res.json({ success: true, teacher: school.withTeacher(db, teacher) });
});

app.post('/api/teachers/:id/reset-password', requireStaff, (req, res) => {
  const db = load(req);
  const teacher = db.teachers.find((item) => item.id === req.params.id);
  const user = teacher && db.users.find((item) => item.id === teacher.userId);
  if (!teacher || !user) return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
  const password = generatePassword('Prof');
  user.password = password;
  save(req, db);
  return res.json({ success: true, credentials: { email: user.email, password } });
});

app.delete('/api/teachers/:id', requireStaff, (req, res) => {
  const db = load(req);
  const teacher = db.teachers.find((item) => item.id === req.params.id);
  if (!teacher) return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
  db.teachers = db.teachers.filter((item) => item.id !== teacher.id);
  db.users = db.users.filter((item) => item.id !== teacher.userId);
  db.courses = db.courses.map((course) => (course.teacherId === teacher.id ? { ...course, teacherId: '' } : course));
  save(req, db);
  return res.json({ success: true, message: 'Enseignant et compte supprimés' });
});

app.get('/api/classes', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const classes = db.classes.filter((item) => school.inYear(item, year)).map((classroom) => {
    const cycle = school.cycleOfClass(db, classroom);
    return {
      ...classroom,
      cycleId: classroom.cycleId || cycle?.id || '',
      cycleName: cycle?.name || classroom.level || '',
      gradingMode: cycle?.gradingMode || 'coefficient',
      ...school.classStats(db, classroom, year)
    };
  });
  return res.json({ success: true, classes });
});

app.get('/api/classes/:id', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const classroom = db.classes.find((item) => item.id === req.params.id);
  if (!classroom) return res.status(404).json({ success: false, message: 'Classe introuvable' });
  const stats = school.classStats(db, classroom, year);
  const cycle = school.cycleOfClass(db, classroom);
  const ranks = school.classRanking(db, classroom.id, year);
  const rankMap = Object.fromEntries(ranks.map((item) => [item.id, item]));
  const students = db.students
    .filter((item) => item.classId === classroom.id && school.inYear(item, year))
    .map((item) => school.withTuition(db, school.withRank(db, item, year, rankMap), year))
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank || b.average - a.average;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
    });
  const courses = db.courses.filter((item) => item.classId === classroom.id && school.inYear(item, year)).map((item) => school.withCourse(db, item));
  const teachers = db.teachers.filter((teacher) => courses.some((course) => course.teacherId === teacher.id)).map((item) => school.withTeacher(db, item));
  const timetable = db.timetable.filter((item) => item.classId === classroom.id && school.inYear(item, year)).map((item) => school.withSlot(db, item));
  const grades = db.grades.filter((grade) => students.some((student) => student.id === grade.studentId) && school.inYear(grade, year)).map((item) => school.withGrade(db, item));
  const attendance = db.attendance.filter((item) => item.classId === classroom.id && school.inYear(item, year)).map((item) => school.withAttendance(db, item));
  return res.json({
    success: true,
    class: { ...classroom, ...stats, cycleId: classroom.cycleId || cycle?.id || '', cycleName: cycle?.name || classroom.level || '', gradingMode: cycle?.gradingMode || 'coefficient' },
    students,
    courses,
    teachers,
    timetable,
    grades,
    attendance,
    average: stats.average,
    presenceRate: stats.presenceRate
  });
});

app.post('/api/classes', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Le nom de la classe est obligatoire' });
  const classroom = {
    id: id('class'),
    name,
    level: req.body.level || '',
    cycleId: req.body.cycleId || cycleIdFromLevel(req.body.level, name),
    mainTeacherId: req.body.mainTeacherId || '',
    room: req.body.room || '',
    year,
    createdAt: now()
  };
  db.classes.push(classroom);
  save(req, db);
  return res.status(201).json({ success: true, class: classroom });
});

app.put('/api/classes/:id', requireStaff, (req, res) => {
  const db = load(req);
  const classroom = db.classes.find((item) => item.id === req.params.id);
  if (!classroom) return res.status(404).json({ success: false, message: 'Classe introuvable' });
  Object.assign(classroom, pick(req.body, ['name', 'level', 'cycleId', 'mainTeacherId', 'room']));
  if (!classroom.cycleId) classroom.cycleId = cycleIdFromLevel(classroom.level, classroom.name);
  db.students.filter((item) => item.classId === classroom.id).forEach((student) => { student.className = classroom.name; });
  save(req, db);
  return res.json({ success: true, class: classroom });
});

app.delete('/api/classes/:id', requireStaff, (req, res) => {
  const db = load(req);
  const classId = req.params.id;
  db.classes = db.classes.filter((item) => item.id !== classId);
  db.students.forEach((student) => {
    if (student.classId === classId) {
      student.classId = '';
      student.className = '';
    }
  });
  db.courses = db.courses.filter((item) => item.classId !== classId);
  db.timetable = db.timetable.filter((item) => item.classId !== classId);
  db.attendance = db.attendance.filter((item) => item.classId !== classId);
  save(req, db);
  return res.json({ success: true, message: 'Classe supprimée' });
});

app.get('/api/subjects', requireAuth, (req, res) => {
  const db = load(req);
  return res.json({ success: true, subjects: db.subjects });
});

app.post('/api/subjects', requireStaff, (req, res) => {
  const db = load(req);
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Nom de matière obligatoire' });
  const subject = { id: id('sub'), name, code: req.body.code || name.slice(0, 3).toUpperCase(), coefficient: Number(req.body.coefficient || 1) };
  db.subjects.push(subject);
  save(req, db);
  return res.status(201).json({ success: true, subject });
});

app.put('/api/subjects/:id', requireStaff, (req, res) => {
  const db = load(req);
  const subject = db.subjects.find((item) => item.id === req.params.id);
  if (!subject) return res.status(404).json({ success: false, message: 'Matière introuvable' });
  Object.assign(subject, pick(req.body, ['name', 'code', 'coefficient']));
  save(req, db);
  return res.json({ success: true, subject });
});

app.delete('/api/subjects/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.subjects = db.subjects.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true });
});

app.get('/api/courses', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let courses = db.courses.filter((item) => school.inYear(item, year)).map((item) => school.withCourse(db, item));
  if (req.session.role === 'teacher') {
    const teacher = db.teachers.find((item) => item.userId === req.session.id);
    courses = courses.filter((item) => teacher && item.teacherId === teacher.id);
  }
  if (req.session.role === 'student') {
    const student = db.students.find((item) => item.userId === req.session.id);
    courses = courses.filter((item) => student && item.classId === student.classId);
  }
  return res.json({ success: true, courses });
});

app.post('/api/courses', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const subject = school.subjectById(db, req.body.subjectId);
  const classroom = school.classById(db, req.body.classId) || db.classes.find((item) => item.name === req.body.className);
  const title = String(req.body.title || subject?.name || '').trim();
  if (!title) return res.status(400).json({ success: false, message: 'Le titre ou la matière est obligatoire' });
  const course = {
    id: id('c'),
    title,
    classId: classroom ? classroom.id : '',
    className: classroom ? classroom.name : (req.body.className || ''),
    subjectId: req.body.subjectId || '',
    teacherId: req.body.teacherId || '',
    hours: Number(req.body.hours || 4),
    room: req.body.room || '',
    description: req.body.description || '',
    status: 'publié',
    year,
    createdAt: now()
  };
  db.courses.push(course);
  save(req, db);
  return res.status(201).json({ success: true, course: school.withCourse(db, course) });
});

app.put('/api/courses/:id', requireStaff, (req, res) => {
  const db = load(req);
  const course = db.courses.find((item) => item.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Cours introuvable' });
  Object.assign(course, pick(req.body, ['title', 'classId', 'subjectId', 'teacherId', 'hours', 'room', 'description', 'status']));
  const classroom = school.classById(db, course.classId);
  if (classroom) course.className = classroom.name;
  save(req, db);
  return res.json({ success: true, course: school.withCourse(db, course) });
});

app.delete('/api/courses/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.courses = db.courses.filter((item) => item.id !== req.params.id);
  db.grades = db.grades.filter((item) => item.courseId !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Cours supprimé' });
});

app.get('/api/timetable', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let slots = db.timetable.filter((item) => school.inYear(item, year));
  if (req.query.classId) slots = slots.filter((item) => item.classId === req.query.classId);
  if (req.session.role === 'teacher') {
    const teacher = db.teachers.find((item) => item.userId === req.session.id);
    slots = slots.filter((item) => teacher && item.teacherId === teacher.id);
  }
  if (req.session.role === 'student') {
    const student = db.students.find((item) => item.userId === req.session.id);
    slots = slots.filter((item) => student && item.classId === student.classId);
  }
  if (req.session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === req.session.id);
    const classIds = db.students.filter((item) => parent && parentChildIds(db, parent).includes(item.id)).map((item) => item.classId);
    slots = slots.filter((item) => classIds.includes(item.classId));
  }
  const enriched = slots.map((slot) => school.withSlot(db, slot));
  return res.json({ success: true, timetable: enriched });
});

app.post('/api/timetable', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const slot = {
    id: id('tt'),
    classId: req.body.classId,
    teacherId: req.body.teacherId || '',
    subjectId: req.body.subjectId || '',
    courseId: req.body.courseId || '',
    day: req.body.day,
    startTime: req.body.startTime,
    endTime: req.body.endTime || school.endTimeOf(req.body.startTime),
    room: req.body.room || '',
    year
  };
  if (!slot.classId || !slot.day || !slot.startTime) {
    return res.status(400).json({ success: false, message: 'Classe, jour et heure obligatoires' });
  }
  db.timetable = db.timetable.filter((item) => !(item.classId === slot.classId && item.day === slot.day && item.startTime === slot.startTime && item.year === year));
  db.timetable.push(slot);
  save(req, db);
  return res.status(201).json({ success: true, slot });
});

app.delete('/api/timetable/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.timetable = db.timetable.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true });
});

app.get('/api/attendance', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const date = req.query.date || today();
  let records = db.attendance.filter((item) => school.inYear(item, year) && (!req.query.date || item.date === date));
  if (req.query.classId) records = records.filter((item) => item.classId === req.query.classId);
  if (req.session.role === 'student') {
    const student = db.students.find((item) => item.userId === req.session.id);
    records = records.filter((item) => student && item.studentId === student.id);
  }
  if (req.session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === req.session.id);
    records = records.filter((item) => parent && parentChildIds(db, parent).includes(item.studentId));
  }
  const summary = {
    present: records.filter((item) => item.status === 'présent').length,
    absent: records.filter((item) => item.status === 'absent').length,
    late: records.filter((item) => item.status === 'retard').length
  };
  return res.json({ success: true, date, summary, attendance: records.map((item) => school.withAttendance(db, item)) });
});

app.post('/api/attendance/bulk', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const date = req.body.date || today();
  const classId = req.body.classId;
  const records = Array.isArray(req.body.records) ? req.body.records : [];
  db.attendance = db.attendance.filter((item) => !(item.date === date && item.classId === classId));
  records.forEach((record) => {
    db.attendance.push({
      id: id('att'),
      studentId: record.studentId,
      classId,
      date,
      status: record.status || 'présent',
      justified: Boolean(record.justified),
      method: record.method || 'manuel',
      year
    });
  });
  save(req, db);
  return res.json({ success: true, message: 'Appel enregistré' });
});

app.post('/api/attendance/face', requireAuth, (req, res) => {
  if (!STAFF.includes(req.session.role) && req.session.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Seul un enseignant ou l’administration peut valider une présence faciale' });
  }
  const db = load(req);
  const year = school.yearOf(req, db);
  const date = req.body.date || today();
  const classId = req.body.classId;
  const student = db.students.find((item) => item.id === req.body.studentId);
  if (!classId || !student) {
    return res.status(400).json({ success: false, message: 'Classe et étudiant obligatoires' });
  }
  if (student.classId !== classId) {
    return res.status(400).json({ success: false, message: 'Cet étudiant n’appartient pas à cette classe' });
  }
  const existing = db.attendance.find((item) => item.date === date && item.classId === classId && item.studentId === student.id);
  if (existing) {
    existing.status = 'présent';
    existing.method = 'facial';
    existing.recognizedAt = now();
  } else {
    db.attendance.push({
      id: id('att'),
      studentId: student.id,
      classId,
      date,
      status: 'présent',
      justified: false,
      method: 'facial',
      recognizedAt: now(),
      year
    });
  }
  save(req, db);
  const records = db.attendance.filter((item) => item.date === date && item.classId === classId);
  return res.json({
    success: true,
    message: `${school.fullName(student)} est marqué présent`,
    student: school.withStudent(db, student),
    attendance: records.map((item) => school.withAttendance(db, item)),
    summary: {
      present: records.filter((item) => item.status === 'présent').length,
      absent: records.filter((item) => item.status === 'absent').length,
      late: records.filter((item) => item.status === 'retard').length
    }
  });
});

app.get('/api/grades', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let grades = db.grades.filter((item) => school.inYear(item, year)).map((item) => school.withGrade(db, item));
  if (req.session.role === 'teacher') {
    const teacher = db.teachers.find((item) => item.userId === req.session.id);
    const courseIds = db.courses.filter((course) => teacher && course.teacherId === teacher.id).map((course) => course.id);
    grades = grades.filter((item) => courseIds.includes(item.courseId));
  }
  if (req.session.role === 'student') {
    const student = db.students.find((item) => item.userId === req.session.id);
    grades = grades.filter((item) => student && item.studentId === student.id);
  }
  if (req.session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === req.session.id);
    grades = grades.filter((item) => parent && parentChildIds(db, parent).includes(item.studentId));
  }
  if (req.query.classId) {
    const ids = db.students.filter((item) => item.classId === req.query.classId).map((item) => item.id);
    grades = grades.filter((item) => ids.includes(item.studentId));
  }
  if (req.query.courseId) grades = grades.filter((item) => item.courseId === req.query.courseId);
  return res.json({ success: true, grades, average: school.averageOf(grades) });
});

app.post('/api/grades', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const score = Number(req.body.score);
  if (!req.body.studentId || !req.body.courseId || Number.isNaN(score)) {
    return res.status(400).json({ success: false, message: 'Étudiant, cours et note sont obligatoires' });
  }
  const rules = school.resolveGradeRules(db, {
    courseId: req.body.courseId,
    typeId: req.body.typeId,
    label: req.body.label || req.body.type || 'Devoir',
    coefficient: req.body.coefficient
  });
  const grade = {
    id: id('g'),
    studentId: req.body.studentId,
    courseId: req.body.courseId,
    evaluationId: req.body.evaluationId || '',
    typeId: rules.typeId,
    label: rules.label,
    type: rules.typeName,
    term: req.body.term || 'Trimestre 1',
    score,
    coefficient: rules.coefficient,
    maxScore: rules.maxScore,
    year,
    createdAt: now()
  };
  db.grades.push(grade);
  save(req, db);
  return res.status(201).json({ success: true, grade: school.withGrade(db, grade) });
});

app.post('/api/grades/bulk', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const courseId = req.body.courseId;
  const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
  if (!courseId || !scores.length) {
    return res.status(400).json({ success: false, message: 'Cours et notes des étudiants obligatoires' });
  }
  const rules = school.resolveGradeRules(db, {
    courseId,
    typeId: req.body.typeId,
    label: req.body.label || req.body.type || 'Contrôle 1',
    coefficient: req.body.coefficient
  });
  const label = rules.label;
  const term = req.body.term || 'Trimestre 1';
  const evaluationId = req.body.evaluationId || '';
  scores.forEach((row) => {
    const score = Number(row.score);
    if (!row.studentId || Number.isNaN(score)) return;
    db.grades = db.grades.filter((item) => !(
      item.studentId === row.studentId
      && item.courseId === courseId
      && item.label === label
      && item.term === term
      && (!evaluationId || item.evaluationId === evaluationId)
      && school.inYear(item, year)
    ));
    db.grades.push({
      id: id('g'),
      studentId: row.studentId,
      courseId,
      evaluationId,
      typeId: rules.typeId,
      label,
      type: rules.typeName,
      term,
      score,
      coefficient: rules.coefficient,
      maxScore: rules.maxScore,
      year,
      createdAt: now()
    });
  });
  const saved = db.grades.filter((item) => item.courseId === courseId && item.label === label && school.inYear(item, year));
  save(req, db);
  return res.json({ success: true, message: 'Notes enregistrées', average: school.averageOf(saved), coefficient: rules.coefficient });
});

app.delete('/api/grades/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.grades = db.grades.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Note supprimée' });
});

app.get('/api/academic', requireSchool, (req, res) => {
  const db = load(req);
  return res.json({
    success: true,
    cycles: db.cycles || [],
    evaluationTypes: db.evaluationTypes || [],
    evaluations: (db.evaluations || []).map((item) => school.withEvaluation(db, item))
  });
});

app.put('/api/academic/cycles/:id', requireSchool, (req, res) => {
  const db = load(req);
  const cycle = (db.cycles || []).find((item) => item.id === req.params.id);
  if (!cycle) return res.status(404).json({ success: false, message: 'Cycle introuvable' });
  Object.assign(cycle, pick(req.body, ['name', 'active', 'gradingMode', 'teacherCanEditCoefficient', 'color']));
  if (cycle.gradingMode !== 'percent') cycle.gradingMode = 'coefficient';
  cycle.active = Boolean(cycle.active);
  cycle.teacherCanEditCoefficient = Boolean(cycle.teacherCanEditCoefficient);
  save(req, db);
  return res.json({ success: true, cycle, cycles: db.cycles });
});

app.post('/api/academic/types', requireSchool, (req, res) => {
  const db = load(req);
  const name = String(req.body.name || '').trim();
  const cycleId = String(req.body.cycleId || '').trim();
  if (!name || !cycleId) return res.status(400).json({ success: false, message: 'Cycle et nom du type d’évaluation obligatoires' });
  if (!(db.cycles || []).some((item) => item.id === cycleId)) {
    return res.status(404).json({ success: false, message: 'Cycle introuvable' });
  }
  const siblings = (db.evaluationTypes || []).filter((item) => item.cycleId === cycleId);
  const type = {
    id: id('et'),
    cycleId,
    name,
    coefficient: Number(req.body.coefficient || 1) || 1,
    weightPercent: Number(req.body.weightPercent || 0) || 0,
    maxScore: Number(req.body.maxScore || 20) || 20,
    order: Number(req.body.order || siblings.length + 1)
  };
  db.evaluationTypes = db.evaluationTypes || [];
  db.evaluationTypes.push(type);
  save(req, db);
  return res.status(201).json({ success: true, type, evaluationTypes: db.evaluationTypes });
});

app.put('/api/academic/types/:id', requireSchool, (req, res) => {
  const db = load(req);
  const type = (db.evaluationTypes || []).find((item) => item.id === req.params.id);
  if (!type) return res.status(404).json({ success: false, message: 'Type d’évaluation introuvable' });
  Object.assign(type, pick(req.body, ['name', 'coefficient', 'weightPercent', 'maxScore', 'order', 'cycleId']));
  type.coefficient = Number(type.coefficient || 1) || 1;
  type.weightPercent = Number(type.weightPercent || 0) || 0;
  type.maxScore = Number(type.maxScore || 20) || 20;
  save(req, db);
  return res.json({ success: true, type, evaluationTypes: db.evaluationTypes });
});

app.delete('/api/academic/types/:id', requireSchool, (req, res) => {
  const db = load(req);
  db.evaluationTypes = (db.evaluationTypes || []).filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Type d’évaluation supprimé', evaluationTypes: db.evaluationTypes });
});

app.get('/api/academic/evaluations', requireSchool, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let evaluations = (db.evaluations || []).filter((item) => school.inYear(item, year));
  if (req.session.role === 'teacher') {
    const teacher = db.teachers.find((item) => item.userId === req.session.id);
    const classIds = school.teacherClassIds(db, teacher);
    const courseIds = db.courses.filter((course) => teacher && course.teacherId === teacher.id).map((course) => course.id);
    evaluations = evaluations.filter((item) => classIds.includes(item.classId) || courseIds.includes(item.courseId) || item.teacherId === teacher?.id);
  }
  if (req.query.classId) evaluations = evaluations.filter((item) => item.classId === req.query.classId);
  if (req.query.courseId) evaluations = evaluations.filter((item) => item.courseId === req.query.courseId);
  return res.json({ success: true, evaluations: evaluations.map((item) => school.withEvaluation(db, item)) });
});

app.post('/api/academic/evaluations', requireSchool, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const courseId = String(req.body.courseId || '').trim();
  const typeId = String(req.body.typeId || '').trim();
  if (!courseId || !typeId) return res.status(400).json({ success: false, message: 'Matière et type d’évaluation obligatoires' });
  const course = db.courses.find((item) => item.id === courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Cours introuvable' });
  const rules = school.resolveGradeRules(db, {
    courseId,
    classId: req.body.classId || course.classId,
    typeId,
    label: req.body.title,
    coefficient: req.body.coefficient
  });
  const teacher = db.teachers.find((item) => item.userId === req.session.id);
  const evaluation = {
    id: id('evl'),
    classId: rules.classroom?.id || course.classId,
    courseId,
    typeId: rules.typeId,
    cycleId: rules.cycleId,
    title: String(req.body.title || rules.label).trim() || rules.label,
    date: req.body.date || today(),
    term: req.body.term || 'Trimestre 1',
    coefficient: rules.coefficient,
    weightPercent: rules.weightPercent,
    maxScore: rules.maxScore,
    teacherId: teacher?.id || '',
    year,
    createdAt: now()
  };
  db.evaluations = db.evaluations || [];
  db.evaluations.push(evaluation);
  save(req, db);
  return res.status(201).json({ success: true, evaluation: school.withEvaluation(db, evaluation) });
});

app.post('/api/academic/evaluations/:id/scores', requireSchool, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const evaluation = (db.evaluations || []).find((item) => item.id === req.params.id);
  if (!evaluation) return res.status(404).json({ success: false, message: 'Évaluation introuvable' });
  const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
  if (!scores.length) return res.status(400).json({ success: false, message: 'Notes des étudiants obligatoires' });
  const rules = school.resolveGradeRules(db, {
    courseId: evaluation.courseId,
    classId: evaluation.classId,
    typeId: evaluation.typeId,
    label: evaluation.title,
    coefficient: evaluation.coefficient
  });
  scores.forEach((row) => {
    const score = Number(row.score);
    if (!row.studentId || Number.isNaN(score)) return;
    db.grades = db.grades.filter((item) => !(item.evaluationId === evaluation.id && item.studentId === row.studentId));
    db.grades.push({
      id: id('g'),
      studentId: row.studentId,
      courseId: evaluation.courseId,
      evaluationId: evaluation.id,
      typeId: rules.typeId,
      label: evaluation.title,
      type: rules.typeName,
      term: evaluation.term,
      score,
      coefficient: rules.coefficient,
      maxScore: rules.maxScore,
      year,
      createdAt: now()
    });
  });
  save(req, db);
  const saved = db.grades.filter((item) => item.evaluationId === evaluation.id);
  return res.json({
    success: true,
    message: 'Notes enregistrées',
    evaluation: school.withEvaluation(db, evaluation),
    grades: saved.map((item) => school.withGrade(db, item)),
    average: school.averageOf(saved)
  });
});

app.delete('/api/academic/evaluations/:id', requireSchool, (req, res) => {
  const db = load(req);
  db.evaluations = (db.evaluations || []).filter((item) => item.id !== req.params.id);
  db.grades = db.grades.filter((item) => item.evaluationId !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Évaluation supprimée' });
});

app.get('/api/payments', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let payments = db.payments.filter((item) => school.inYear(item, year)).map((item) => school.withPayment(db, item));
  let tuition = null;
  if (req.session.role === 'student') {
    const student = db.students.find((item) => item.userId === req.session.id);
    payments = payments.filter((item) => student && item.studentId === student.id);
    if (student) tuition = school.tuitionOf(db, student, year);
  }
  if (req.session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === req.session.id);
    payments = payments.filter((item) => parent && parentChildIds(db, parent).includes(item.studentId));
  }
  const totals = {
    paid: payments.filter((item) => item.status === 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    unpaid: payments.filter((item) => item.status !== 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  };
  let situation = [];
  if (STAFF.includes(req.session.role)) {
    situation = db.students
      .filter((item) => school.inYear(item, year))
      .map((item) => school.withTuition(db, school.withStudent(db, item), year))
      .sort((a, b) => (a.className || '').localeCompare(b.className || '', 'fr') || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
    if (school.tuitionExpected(db) > 0) {
      totals.unpaid = situation.reduce((sum, item) => sum + Number(item.tuitionDue || 0), 0);
    }
  }
  return res.json({
    success: true,
    payments,
    totals,
    situation,
    tuition,
    tuitionAmount: school.tuitionExpected(db),
    paymentChannels: school.paymentChannels(db)
  });
});

app.post('/api/payments', requireStaff, (req, res) => {
  const amount = Number(req.body.amount);
  if (!req.body.studentId || Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Étudiant et montant valides obligatoires' });
  }
  const db = load(req);
  const year = school.yearOf(req, db);
  const payment = {
    id: id('p'),
    studentId: req.body.studentId,
    amount,
    method: req.body.method || 'Espèces',
    month: req.body.month || '',
    feeType: req.body.feeType || 'Frais de scolarité',
    status: req.body.status || 'payé',
    dueDate: req.body.dueDate || '',
    paidAt: req.body.status === 'en attente' ? '' : (req.body.paidAt || req.body.date || today()),
    receiptNumber: school.nextReceipt(db, year),
    year,
    createdAt: now()
  };
  db.payments.push(payment);
  save(req, db);
  return res.status(201).json({ success: true, payment: school.withPayment(db, payment), tuition: school.tuitionOf(db, { id: payment.studentId }, year) });
});

app.put('/api/payments/:id', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const payment = db.payments.find((item) => item.id === req.params.id);
  if (!payment) return res.status(404).json({ success: false, message: 'Paiement introuvable' });
  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (Number.isNaN(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Montant invalide' });
    payment.amount = amount;
  }
  if (req.body.method) payment.method = req.body.method;
  if (req.body.feeType) payment.feeType = req.body.feeType;
  if (req.body.dueDate !== undefined) payment.dueDate = req.body.dueDate;
  if (req.body.paidAt) payment.paidAt = req.body.paidAt;
  if (req.body.status) {
    payment.status = req.body.status;
    if (req.body.status === 'payé' && !payment.paidAt) payment.paidAt = req.body.paidAt || today();
  }
  save(req, db);
  return res.json({ success: true, payment: school.withPayment(db, payment), tuition: school.tuitionOf(db, { id: payment.studentId }, year) });
});

app.post('/api/payments/settle', requireStaff, (req, res) => {
  if (!req.body.studentId) return res.status(400).json({ success: false, message: 'Étudiant obligatoire' });
  const db = load(req);
  const year = school.yearOf(req, db);
  const student = db.students.find((item) => item.id === req.body.studentId);
  if (!student) return res.status(404).json({ success: false, message: 'Étudiant introuvable' });
  const method = req.body.method || 'Espèces';
  const paidAt = req.body.paidAt || today();
  const feeType = req.body.feeType || 'Frais de scolarité';
  db.payments
    .filter((item) => item.studentId === student.id && school.inYear(item, year) && item.status !== 'payé')
    .forEach((item) => {
      item.status = 'payé';
      item.paidAt = paidAt;
      if (!item.method) item.method = method;
    });
  const afterPending = school.tuitionOf(db, student, year);
  let amount = Number(req.body.amount);
  if (Number.isNaN(amount) || amount < 0) amount = afterPending.due;
  let payment = null;
  if (amount > 0) {
    payment = {
      id: id('p'),
      studentId: student.id,
      amount,
      method,
      month: req.body.month || '',
      feeType,
      status: 'payé',
      dueDate: '',
      paidAt,
      receiptNumber: school.nextReceipt(db, year),
      year,
      createdAt: now()
    };
    db.payments.push(payment);
  }
  const tuition = school.tuitionOf(db, student, year);
  if (!payment && tuition.paymentsCount === 0) {
    return res.status(400).json({ success: false, message: 'Indiquez le montant payé par l’étudiant' });
  }
  save(req, db);
  return res.json({
    success: true,
    message: 'Scolarité marquée comme payée',
    payment: payment ? school.withPayment(db, payment) : null,
    tuition
  });
});

app.delete('/api/payments/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.payments = db.payments.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Paiement supprimé' });
});

app.get('/api/announcements', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  return res.json({ success: true, announcements: db.announcements.filter((item) => school.inYear(item, year)) });
});

app.post('/api/announcements', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const item = { id: id('an'), title: req.body.title, body: req.body.body || '', date: req.body.date || today(), audience: req.body.audience || 'Tous', year, createdAt: now() };
  if (!item.title) return res.status(400).json({ success: false, message: 'Titre obligatoire' });
  db.announcements.unshift(item);
  save(req, db);
  return res.status(201).json({ success: true, announcement: item });
});

app.delete('/api/announcements/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.announcements = db.announcements.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true });
});

app.get('/api/events', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  return res.json({ success: true, events: db.events.filter((item) => school.inYear(item, year)) });
});

app.post('/api/events', requireStaff, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const item = { id: id('ev'), title: req.body.title, date: req.body.date, time: req.body.time || '', place: req.body.place || '', year };
  if (!item.title || !item.date) return res.status(400).json({ success: false, message: 'Titre et date obligatoires' });
  db.events.push(item);
  save(req, db);
  return res.status(201).json({ success: true, event: item });
});

app.delete('/api/events/:id', requireStaff, (req, res) => {
  const db = load(req);
  db.events = db.events.filter((item) => item.id !== req.params.id);
  save(req, db);
  return res.json({ success: true, message: 'Événement supprimé' });
});

app.get('/api/parents', requireStaff, (req, res) => {
  const db = load(req);
  let changed = false;
  db.parents.forEach((parent) => {
    if (school.syncFamilyLinks(db, { parent })) changed = true;
  });
  if (changed) save(req, db);
  const parents = db.parents.map((parent) => {
    const ids = parentChildIds(db, parent);
    return {
      ...parent,
      childrenIds: ids,
      children: db.students.filter((student) => ids.includes(student.id)).map((student) => school.withStudent(db, student))
    };
  });
  return res.json({ success: true, parents });
});

app.post('/api/parents', requireStaff, (req, res) => {
  const db = load(req);
  const email = String(req.body.email || '').trim().toLowerCase();
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  if (!email || !firstName || !lastName) return res.status(400).json({ success: false, message: 'Nom et email obligatoires' });
  if (db.users.some((item) => item.email.toLowerCase() === email)) return res.status(409).json({ success: false, message: 'Cet email a déjà un compte' });
  const password = String(req.body.password || '').trim() || generatePassword('Parent');
  const userId = id('u');
  const parent = {
    id: id('par'),
    userId,
    firstName,
    lastName,
    email,
    phone: req.body.phone || '',
    childrenIds: asIdList(req.body.childrenIds),
    createdAt: now()
  };
  db.users.push({ id: userId, email, password, role: 'parent', name: `${firstName} ${lastName}`, createdAt: now() });
  db.parents.push(parent);
  school.syncFamilyLinks(db, { parent });
  save(req, db);
  return res.status(201).json({
    success: true,
    parent: { ...parent, children: db.students.filter((student) => parentChildIds(db, parent).includes(student.id)) },
    credentials: { email, password }
  });
});

app.put('/api/parents/:id', requireStaff, (req, res) => {
  const db = load(req);
  const parent = db.parents.find((item) => item.id === req.params.id);
  if (!parent) return res.status(404).json({ success: false, message: 'Parent introuvable' });
  if (req.body.firstName) parent.firstName = String(req.body.firstName).trim();
  if (req.body.lastName) parent.lastName = String(req.body.lastName).trim();
  if (req.body.phone !== undefined) parent.phone = String(req.body.phone || '');
  if (req.body.email) {
    const email = String(req.body.email).trim().toLowerCase();
    if (db.users.some((item) => item.email.toLowerCase() === email && item.id !== parent.userId)) {
      return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
    }
    parent.email = email;
    const user = db.users.find((item) => item.id === parent.userId);
    if (user) {
      user.email = email;
      user.name = `${parent.firstName} ${parent.lastName}`;
    }
  }
  if (req.body.childrenIds !== undefined) parent.childrenIds = asIdList(req.body.childrenIds);
  school.syncFamilyLinks(db, { parent });
  save(req, db);
  const ids = parentChildIds(db, parent);
  return res.json({
    success: true,
    parent: {
      ...parent,
      childrenIds: ids,
      children: db.students.filter((student) => ids.includes(student.id)).map((student) => school.withStudent(db, student))
    }
  });
});

app.delete('/api/parents/:id', requireStaff, (req, res) => {
  const db = load(req);
  const parent = db.parents.find((item) => item.id === req.params.id);
  if (!parent) return res.status(404).json({ success: false, message: 'Parent introuvable' });
  db.parents = db.parents.filter((item) => item.id !== parent.id);
  db.users = db.users.filter((item) => item.id !== parent.userId);
  save(req, db);
  return res.json({ success: true, message: 'Compte parent supprimé' });
});

app.get('/api/users', requireStaff, (req, res) => {
  const db = load(req);
  return res.json({ success: true, users: db.users.map((user) => publicUser(user)) });
});

app.put('/api/users/:id/role', requireStaff, (req, res) => {
  const db = load(req);
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
  if (user.role === 'owner' || req.body.role === 'owner') {
    return res.status(403).json({ success: false, message: 'Le compte entreprise ne peut pas être modifié ici' });
  }
  user.role = req.body.role || user.role;
  save(req, db);
  return res.json({ success: true, user: publicUser(user) });
});

app.delete('/api/users/:id', requireStaff, (req, res) => {
  const db = load(req);
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
  if (user.id === req.session.id) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
  }

  const student = db.students.find((item) => item.userId === user.id);
  const teacher = db.teachers.find((item) => item.userId === user.id);
  const parent = db.parents.find((item) => item.userId === user.id);

  db.users = db.users.filter((item) => item.id !== user.id);
  if (student) {
    db.students = db.students.filter((item) => item.id !== student.id);
    db.grades = db.grades.filter((item) => item.studentId !== student.id);
    db.payments = db.payments.filter((item) => item.studentId !== student.id);
    db.attendance = db.attendance.filter((item) => item.studentId !== student.id);
    db.sanctions = db.sanctions.filter((item) => item.studentId !== student.id);
  }
  if (teacher) {
    db.teachers = db.teachers.filter((item) => item.id !== teacher.id);
    db.courses = db.courses.map((course) => (course.teacherId === teacher.id ? { ...course, teacherId: '' } : course));
  }
  if (parent) {
    db.parents = db.parents.filter((item) => item.id !== parent.id);
  }

  save(req, db);
  return res.json({ success: true, message: 'Utilisateur supprimé' });
});

app.get('/api/work', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  db.workItems = db.workItems || [];
  db.submissions = db.submissions || [];
  let items = db.workItems.filter((item) => school.inYear(item, year));

  if (req.session.role === 'teacher') {
    const teacher = sessionTeacher(db, req.session);
    items = items.filter((item) => teacher && item.teacherId === teacher.id);
  }
  if (req.session.role === 'student') {
    const student = sessionStudent(db, req.session);
    items = items.filter((item) => student && item.classId === student.classId);
  }
  if (req.session.role === 'parent') {
    const parent = db.parents.find((item) => item.userId === req.session.id);
    const classIds = db.students.filter((item) => parent && parentChildIds(db, parent).includes(item.id)).map((item) => item.classId);
    items = items.filter((item) => classIds.includes(item.classId));
  }
  if (req.query.classId) items = items.filter((item) => item.classId === req.query.classId);
  if (req.query.type) items = items.filter((item) => item.type === req.query.type);

  const student = sessionStudent(db, req.session);
  const parent = sessionParent(db, req.session);
  const childIds = parentChildIds(db, parent);
  const payload = items.map((item) => {
    const work = school.withWork(db, item);
    const related = db.submissions.filter((sub) => sub.workId === item.id);
    const mine = student ? related.find((sub) => sub.studentId === student.id) : null;
    const childSubmissions = childIds.length
      ? related.filter((sub) => childIds.includes(sub.studentId)).map((sub) => {
        const child = db.students.find((item) => item.id === sub.studentId);
        return {
          id: sub.id,
          studentId: sub.studentId,
          studentName: child ? `${child.firstName} ${child.lastName}` : '',
          fileName: sub.originalName,
          submittedAt: sub.submittedAt,
          score: sub.score,
          teacherComment: sub.teacherComment || '',
          gradedAt: sub.gradedAt || ''
        };
      })
      : [];
    return {
      ...work,
      storedName: undefined,
      submissionsCount: related.length,
      gradedCount: related.filter((sub) => sub.score !== null && sub.score !== undefined && sub.score !== '').length,
      mySubmission: mine ? {
        id: mine.id,
        fileName: mine.originalName,
        submittedAt: mine.submittedAt,
        score: mine.score,
        teacherComment: mine.teacherComment || '',
        gradedAt: mine.gradedAt || ''
      } : (childSubmissions[0] || null),
      childSubmissions
    };
  });
  return res.json({ success: true, work: payload });
});

app.post('/api/work', requireAuth, (req, res) => {
  if (!STAFF.includes(req.session.role) && req.session.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Seul un enseignant peut publier un cours ou un devoir' });
  }
  const db = load(req);
  const year = school.yearOf(req, db);
  const teacher = sessionTeacher(db, req.session);
  const title = String(req.body.title || '').trim();
  const type = req.body.type === 'devoir' ? 'devoir' : 'cours';
  const classroom = school.classById(db, req.body.classId);
  if (!title || !classroom) {
    return res.status(400).json({ success: false, message: 'Titre et classe obligatoires' });
  }
  if (req.session.role === 'teacher') {
    const allowed = school.teacherClassIds(db, teacher);
    if (allowed.length && !allowed.includes(classroom.id)) {
      return res.status(403).json({ success: false, message: 'Vous ne pouvez publier que pour vos classes' });
    }
  }
  if (!req.body.fileData) {
    return res.status(400).json({ success: false, message: 'Ajoutez un fichier PDF' });
  }
  let file;
  try {
    file = saveUpload(type === 'devoir' ? 'devoir' : 'cours', req.body.fileName, req.body.fileData);
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
  const item = {
    id: id('work'),
    type,
    title,
    description: String(req.body.description || ''),
    classId: classroom.id,
    subjectId: req.body.subjectId || '',
    teacherId: teacher ? teacher.id : (req.body.teacherId || ''),
    dueDate: type === 'devoir' ? (req.body.dueDate || '') : '',
    originalName: file.originalName,
    storedName: file.storedName,
    mime: file.mime,
    year,
    createdAt: now()
  };
  db.workItems = db.workItems || [];
  db.workItems.unshift(item);
  save(req, db);
  return res.status(201).json({ success: true, work: school.withWork(db, item), message: type === 'devoir' ? 'Devoir publié' : 'Cours publié' });
});

app.delete('/api/work/:id', requireAuth, (req, res) => {
  const db = load(req);
  db.workItems = db.workItems || [];
  db.submissions = db.submissions || [];
  const item = db.workItems.find((work) => work.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Document introuvable' });
  if (!canManageWork(db, req.session, item)) {
    return res.status(403).json({ success: false, message: 'Action non autorisée' });
  }
  removeUpload(item.storedName);
  db.submissions.filter((sub) => sub.workId === item.id).forEach((sub) => removeUpload(sub.storedName));
  db.submissions = db.submissions.filter((sub) => sub.workId !== item.id);
  db.grades = db.grades.filter((grade) => grade.workId !== item.id);
  db.workItems = db.workItems.filter((work) => work.id !== item.id);
  save(req, db);
  return res.json({ success: true, message: 'Document supprimé' });
});

app.get('/api/work/:id/copies', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const item = (db.workItems || []).find((work) => work.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Devoir introuvable' });
  if (!canManageWork(db, req.session, item)) {
    return res.status(403).json({ success: false, message: 'Action non autorisée' });
  }
  const students = db.students.filter((student) => student.classId === item.classId && school.inYear(student, year));
  const copies = students.map((student) => {
    const submission = (db.submissions || []).find((sub) => sub.workId === item.id && sub.studentId === student.id);
    return {
      studentId: student.id,
      studentName: school.fullName(student),
      submitted: Boolean(submission),
      submissionId: submission?.id || '',
      fileName: submission?.originalName || '',
      submittedAt: submission?.submittedAt || '',
      score: submission ? submission.score : null,
      teacherComment: submission?.teacherComment || ''
    };
  });
  return res.json({ success: true, work: school.withWork(db, { ...item, storedName: undefined }), copies });
});

app.post('/api/work/:id/submit', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Seul un étudiant peut déposer une réponse' });
  }
  const db = load(req);
  const student = sessionStudent(db, req.session);
  const item = (db.workItems || []).find((work) => work.id === req.params.id);
  if (!student || !item) return res.status(404).json({ success: false, message: 'Devoir introuvable' });
  if (item.classId !== student.classId) {
    return res.status(403).json({ success: false, message: 'Ce devoir ne concerne pas votre classe' });
  }
  if (item.type !== 'devoir') {
    return res.status(400).json({ success: false, message: 'Vous ne déposez une réponse que pour un devoir' });
  }
  db.submissions = db.submissions || [];
  const existing = db.submissions.find((sub) => sub.workId === item.id && sub.studentId === student.id);
  if (existing && existing.score !== null && existing.score !== undefined && existing.score !== '') {
    return res.status(400).json({ success: false, message: 'Le professeur a déjà noté ce devoir. Vous ne pouvez plus modifier votre réponse.' });
  }
  if (!req.body.fileData) {
    return res.status(400).json({ success: false, message: 'Ajoutez votre fichier de réponse' });
  }
  let file;
  try {
    file = saveUpload('reponse', req.body.fileName, req.body.fileData);
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
  if (existing) removeUpload(existing.storedName);
  const submission = {
    id: existing?.id || id('copy'),
    workId: item.id,
    studentId: student.id,
    originalName: file.originalName,
    storedName: file.storedName,
    mime: file.mime,
    comment: String(req.body.comment || ''),
    submittedAt: now(),
    score: null,
    teacherComment: '',
    gradedAt: '',
    year: item.year
  };
  if (existing) {
    Object.assign(existing, submission, { id: existing.id });
  } else {
    db.submissions.push(submission);
  }
  save(req, db);
  return res.json({ success: true, message: 'Réponse déposée', submission: { id: submission.id, fileName: submission.originalName, submittedAt: submission.submittedAt, score: null } });
});

app.post('/api/work/:id/grade', requireAuth, (req, res) => {
  const db = load(req);
  const item = (db.workItems || []).find((work) => work.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Devoir introuvable' });
  if (req.session.role === 'student' || !canManageWork(db, req.session, item)) {
    return res.status(403).json({ success: false, message: 'Seul le professeur peut noter' });
  }
  const score = Number(req.body.score);
  if (Number.isNaN(score) || score < 0 || score > 20) {
    return res.status(400).json({ success: false, message: 'Note entre 0 et 20 obligatoire' });
  }
  const studentId = req.body.studentId;
  const foundStudent = db.students.find((itemStudent) => itemStudent.id === studentId);
  if (!foundStudent) return res.status(404).json({ success: false, message: 'Étudiant introuvable' });
  db.submissions = db.submissions || [];
  let submission = db.submissions.find((sub) => sub.workId === item.id && sub.studentId === studentId);
  if (!submission) {
    submission = {
      id: id('copy'),
      workId: item.id,
      studentId,
      originalName: '',
      storedName: '',
      mime: '',
      comment: '',
      submittedAt: '',
      year: item.year
    };
    db.submissions.push(submission);
  }
  submission.score = score;
  submission.teacherComment = String(req.body.teacherComment || '');
  submission.gradedAt = now();

  db.grades = db.grades.filter((grade) => !(grade.workId === item.id && grade.studentId === studentId));
  db.grades.push({
    id: id('g'),
    studentId,
    courseId: '',
    workId: item.id,
    label: item.title,
    type: 'Devoir',
    term: req.body.term || 'Trimestre 1',
    score,
    coefficient: Number(req.body.coefficient || 1),
    year: item.year,
    createdAt: now()
  });
  save(req, db);
  return res.json({ success: true, message: 'Note enregistrée. L’étudiant la verra dans son compte.', score });
});

app.get('/api/work/:id/file', requireAuth, (req, res) => {
  const db = load(req);
  const item = (db.workItems || []).find((work) => work.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Fichier introuvable' });
  if (req.session.role === 'student') {
    const student = sessionStudent(db, req.session);
    if (!student || student.classId !== item.classId) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
  } else if (req.session.role === 'parent') {
    const parent = sessionParent(db, req.session);
    const classIds = db.students.filter((child) => parentChildIds(db, parent).includes(child.id)).map((child) => child.classId);
    if (!classIds.includes(item.classId)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
  } else if (req.session.role === 'teacher' && !canManageWork(db, req.session, item)) {
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }
  return sendUpload(res, item.storedName, item.originalName, item.mime);
});

app.get('/api/submissions/:id/file', requireAuth, (req, res) => {
  const db = load(req);
  const submission = (db.submissions || []).find((item) => item.id === req.params.id);
  if (!submission || !submission.storedName) return res.status(404).json({ success: false, message: 'Réponse introuvable' });
  const work = (db.workItems || []).find((item) => item.id === submission.workId);
  const student = sessionStudent(db, req.session);
  const parent = sessionParent(db, req.session);
  const allowed = STAFF.includes(req.session.role)
    || (student && student.id === submission.studentId)
    || (parent && parentChildIds(db, parent).includes(submission.studentId))
    || canManageWork(db, req.session, work);
  if (!allowed) return res.status(403).json({ success: false, message: 'Accès refusé' });
  return sendUpload(res, submission.storedName, submission.originalName, submission.mime);
});

app.get('/api/parent/children', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  let parent = sessionParent(db, req.session);
  if (!parent && STAFF.includes(req.session.role) && req.query.parentId) {
    parent = db.parents.find((item) => item.id === req.query.parentId);
  }
  if (req.session.role === 'parent' && !parent) {
    return res.status(404).json({ success: false, message: 'Compte parent introuvable' });
  }
  if (parent && school.syncFamilyLinks(db, { parent })) save(req, db);
  const ids = parent ? parentChildIds(db, parent) : [];
  const children = ids
    .map((studentId) => db.students.find((item) => item.id === studentId))
    .filter(Boolean)
    .map((student) => school.studentFiche(db, student, year));
  return res.json({ success: true, parent, children });
});

app.get('/api/documents/data', requireAuth, (req, res) => {
  const db = load(req);
  const year = school.yearOf(req, db);
  const type = req.query.type;
  const student = db.students.find((item) => item.id === req.query.studentId);
  const payment = db.payments.find((item) => item.id === req.query.paymentId);
  const classroom = db.classes.find((item) => item.id === req.query.classId);
  if (req.session.role === 'parent') {
    const parent = sessionParent(db, req.session);
    const ids = parentChildIds(db, parent);
    if (student && !ids.includes(student.id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    if (payment && !ids.includes(payment.studentId)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
  }
  if (req.session.role === 'student') {
    const me = sessionStudent(db, req.session);
    if (student && me && student.id !== me.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
  }
  return res.json({
    success: true,
    type,
    settings: db.settings,
    year,
    student: student ? school.studentFiche(db, student, year) : null,
    payment: payment ? school.withPayment(db, payment) : null,
    class: classroom || null,
    students: classroom
      ? db.students
        .filter((item) => item.classId === classroom.id && school.inYear(item, year))
        .map((item) => school.studentFiche(db, item, year))
        .sort((a, b) => {
          const ra = a.ranking?.rank || 0;
          const rb = b.ranking?.rank || 0;
          if (ra && rb) return ra - rb || (b.average || 0) - (a.average || 0);
          if (ra) return -1;
          if (rb) return 1;
          return `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`, 'fr');
        })
      : []
  });
});

app.get('/api/ai/desk', requireAuth, (req, res) => {
  if (req.session.role === 'owner') {
    return res.status(400).json({ success: false, message: 'Kelassi IA est disponible dans l’espace d’une école.' });
  }
  const db = load(req);
  const year = school.yearOf(req, db);
  return res.json(kelassiAi.desk(db, req.session, year));
});

app.post('/api/ai/ask', requireAuth, async (req, res) => {
  if (req.session.role === 'owner') {
    return res.status(400).json({ success: false, message: 'Kelassi IA est disponible dans l’espace d’une école.' });
  }
  try {
    const db = load(req);
    const year = school.yearOf(req, db);
    const result = await kelassiAi.ask(db, req.session, year, req.body.message, req.body.history);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Kelassi IA est indisponible.' });
  }
});

app.post('/api/ai/draft', requireAuth, async (req, res) => {
  if (!STAFF.includes(req.session.role) && req.session.role !== 'teacher' && req.session.role !== 'student' && req.session.role !== 'parent') {
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }
  if (req.session.role === 'owner') {
    return res.status(400).json({ success: false, message: 'Kelassi IA est disponible dans l’espace d’une école.' });
  }
  try {
    const db = load(req);
    const year = school.yearOf(req, db);
    const result = await kelassiAi.draft(db, req.session, year, req.body.kind, req.body.studentId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Kelassi IA est indisponible.' });
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `Route introuvable : ${req.method} ${req.originalUrl}` });
  }
  const indexFile = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexFile) && (req.method === 'GET' || req.method === 'HEAD')) {
    return res.sendFile(indexFile);
  }
  return res.json({
    success: true,
    message: 'API Kelassi Moderne',
    version: '2.0.0',
    hint: 'Lancez npm run build puis redémarrez le serveur pour servir le site.'
  });
});

async function start() {
  await boot();
  sessions = readSessionMap();
  const server = app.listen(PORT, HOST, () => {
    console.log(`SERVEUR KELASSI MODERNE — http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} (${HOST})`);
    console.log(`Données : ${persistMode()}`);
  });
  server.on('error', (error) => console.error('Erreur serveur :', error));

  async function shutdown() {
    try {
      await flush();
    } catch (error) {
      console.error('Flush données :', error.message);
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('Démarrage impossible :', error.message);
  process.exit(1);
});


