const { load: loadAll, save: saveAll, id, now, defaultCycles, defaultEvaluationTypes } = require('./store');

const SCHOOL_KEYS = [
  'users', 'students', 'teachers', 'classes', 'subjects', 'courses', 'grades', 'payments',
  'timetable', 'attendance', 'announcements', 'events', 'parents', 'sanctions',
  'workItems', 'submissions', 'cycles', 'evaluationTypes', 'evaluations', 'feeTypes'
];

function schoolById(db, schoolId) {
  return (db.schools || []).find((item) => item.id === schoolId) || null;
}

function provisionAcademic(schoolId) {
  const cycleMap = {};
  const cycles = defaultCycles().map((cycle) => {
    const nextId = id('cycle');
    cycleMap[cycle.id] = nextId;
    return { ...cycle, id: nextId, schoolId };
  });
  const evaluationTypes = defaultEvaluationTypes().map((type) => ({
    ...type,
    id: id('et'),
    cycleId: cycleMap[type.cycleId] || type.cycleId,
    schoolId
  }));
  const feeTypes = [
    { id: id('fee'), name: "Frais d'inscription", schoolId },
    { id: id('fee'), name: 'Frais de scolarité', schoolId },
    { id: id('fee'), name: "Frais d'examen", schoolId },
    { id: id('fee'), name: 'Autres frais', schoolId }
  ];
  return { cycles, evaluationTypes, feeTypes };
}

function read(req) {
  const db = loadAll();
  const session = req && req.session;
  if (!session) return db;
  if (session.role === 'owner') {
    const empty = { ...db };
    SCHOOL_KEYS.forEach((key) => {
      empty[key] = key === 'users'
        ? (db.users || []).filter((item) => item.role === 'owner')
        : [];
    });
    return empty;
  }
  const schoolId = session.schoolId;
  if (!schoolId) return db;
  const tenant = schoolById(db, schoolId);
  const scoped = { ...db };
  SCHOOL_KEYS.forEach((key) => {
    scoped[key] = (db[key] || []).filter((item) => {
      if (key === 'users' && item.role === 'owner') return false;
      return item.schoolId === schoolId;
    });
  });
  if (tenant) {
    scoped.settings = {
      ...(tenant.settings || db.settings || {}),
      schoolName: tenant.name,
      address: tenant.address || tenant.settings?.address || '',
      phone: tenant.phone || tenant.settings?.phone || '',
      email: tenant.email || tenant.settings?.email || ''
    };
    if (!scoped.settings.currentYear) scoped.settings.currentYear = db.settings?.currentYear;
    if (!scoped.settings.terms) scoped.settings.terms = db.settings?.terms;
    if (!scoped.settings.currency) scoped.settings.currency = db.settings?.currency || 'FC';
  }
  scoped._schoolId = schoolId;
  return scoped;
}

function write(req, scoped) {
  if (!req?.session) {
    saveAll(scoped);
    return;
  }
  if (req.session.role === 'owner') return;
  if (!req.session.schoolId) {
    const ownerUser = loadAll().users.find((item) => item.id === req.session.id);
    if (ownerUser?.schoolId) req.session.schoolId = ownerUser.schoolId;
  }
  if (!req.session.schoolId) {
    console.error('Écriture annulée : aucune école liée à la session');
    return;
  }
  const schoolId = req.session.schoolId;
  const full = loadAll();
  SCHOOL_KEYS.forEach((key) => {
    const others = (full[key] || []).filter((item) => {
      if (key === 'users' && item.role === 'owner') return true;
      return item.schoolId !== schoolId;
    });
    const mine = (scoped[key] || [])
      .filter((item) => key !== 'users' || item.role !== 'owner')
      .map((item) => ({ ...item, schoolId }));
    full[key] = others.concat(mine);
  });
  const tenant = schoolById(full, schoolId);
  if (tenant && scoped.settings) {
    tenant.name = scoped.settings.schoolName || tenant.name;
    tenant.address = scoped.settings.address || tenant.address;
    tenant.phone = scoped.settings.phone || tenant.phone;
    tenant.email = scoped.settings.email || tenant.email;
    tenant.settings = { ...tenant.settings, ...scoped.settings };
  }
  if (Array.isArray(scoped.years) && scoped.years.length) full.years = scoped.years;
  saveAll(full);
}

function createTenant({ name, city, address, phone, adminName, adminEmail, adminPassword }) {
  const db = loadAll();
  const schoolName = String(name || '').trim();
  const email = String(adminEmail || '').trim().toLowerCase();
  const password = String(adminPassword || '').trim();
  if (!schoolName) return { status: 400, body: { success: false, message: 'Le nom de l’école est obligatoire' } };
  if (!email || !password) return { status: 400, body: { success: false, message: 'Email et mot de passe de l’admin obligatoires' } };
  if (password.length < 6) return { status: 400, body: { success: false, message: 'Le mot de passe admin doit faire au moins 6 caractères' } };
  if (db.users.some((user) => String(user.email || '').trim().toLowerCase() === email)) {
    return { status: 400, body: { success: false, message: 'Cet email est déjà utilisé. Choisissez un autre email.' } };
  }
  const schoolId = id('school');
  const adminId = id('u');
  const academic = provisionAcademic(schoolId);
  const createdAt = now();
  const settings = {
    schoolName,
    logo: '',
    address: address || '',
    phone: phone || '',
    email,
    currency: 'FC',
    currentYear: db.settings?.currentYear || '2026-2027',
    terms: db.settings?.terms || ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']
  };
  const tenant = {
    id: schoolId,
    name: schoolName,
    status: 'active',
    city: city || '',
    address: address || '',
    phone: phone || '',
    email,
    adminUserId: adminId,
    settings,
    createdAt
  };
  db.schools.push(tenant);
  db.users.push({
    id: adminId,
    email,
    password,
    role: 'admin',
    name: String(adminName || 'Administrateur').trim() || 'Administrateur',
    schoolId,
    createdAt
  });
  db.cycles = (db.cycles || []).concat(academic.cycles);
  db.evaluationTypes = (db.evaluationTypes || []).concat(academic.evaluationTypes);
  db.feeTypes = (db.feeTypes || []).concat(academic.feeTypes);
  saveAll(db);
  return {
    status: 201,
    body: {
      success: true,
      school: publicSchool(db, tenant),
      credentials: { email, password, role: 'admin' }
    }
  };
}

function publicSchool(db, tenant) {
  const admin = db.users.find((user) => user.id === tenant.adminUserId);
  const schoolId = tenant.id;
  return {
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    city: tenant.city || '',
    address: tenant.address || '',
    phone: tenant.phone || '',
    email: tenant.email || '',
    createdAt: tenant.createdAt,
    adminEmail: admin?.email || '',
    adminName: admin?.name || '',
    students: (db.students || []).filter((item) => item.schoolId === schoolId).length,
    teachers: (db.teachers || []).filter((item) => item.schoolId === schoolId).length,
    classes: (db.classes || []).filter((item) => item.schoolId === schoolId).length
  };
}

module.exports = { read, write, loadAll, saveAll, createTenant, publicSchool, schoolById, SCHOOL_KEYS };
