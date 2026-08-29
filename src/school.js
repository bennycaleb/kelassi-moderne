const { cycleIdFromLevel } = require('./store');

function yearOf(req, db) {
  return String(req.query.year || req.body?.year || db.settings.currentYear || '2026-2027');
}

function inYear(item, year) {
  return !item.year || item.year === year;
}

function classById(db, classId) {
  return db.classes.find((item) => item.id === classId) || null;
}

function subjectById(db, subjectId) {
  return db.subjects.find((item) => item.id === subjectId) || null;
}

function teacherById(db, teacherId) {
  return db.teachers.find((item) => item.id === teacherId) || null;
}

function studentById(db, studentId) {
  return db.students.find((item) => item.id === studentId) || null;
}

function fullName(person) {
  if (!person) return '';
  return `${person.firstName || ''} ${person.lastName || ''}`.trim();
}

function classNameOf(db, student) {
  if (!student) return '';
  const found = classById(db, student.classId);
  return found ? found.name : (student.className || '');
}

function withStudent(db, student) {
  const { faceDescriptor, ...rest } = student || {};
  return {
    ...rest,
    className: classNameOf(db, student),
    class: classById(db, student.classId),
    hasFace: Array.isArray(faceDescriptor) && faceDescriptor.length > 0
  };
}

function withStudentFace(db, student) {
  return {
    ...withStudent(db, student),
    faceDescriptor: Array.isArray(student.faceDescriptor) ? student.faceDescriptor : []
  };
}

function withTeacher(db, teacher) {
  const subjectNames = (teacher.subjectIds || [])
    .map((subjectId) => subjectById(db, subjectId)?.name)
    .filter(Boolean);
  const classIds = db.courses
    .filter((course) => course.teacherId === teacher.id)
    .map((course) => course.classId);
  const classes = db.classes.filter((item) => classIds.includes(item.id));
  return {
    ...teacher,
    subject: subjectNames[0] || teacher.subject || '',
    subjects: subjectNames,
    classes
  };
}

function withCourse(db, course) {
  const subject = subjectById(db, course.subjectId);
  const classroom = classById(db, course.classId);
  const teacher = teacherById(db, course.teacherId);
  return {
    ...course,
    title: course.title || subject?.name || 'Cours',
    subjectName: subject?.name || course.title || '',
    className: classroom?.name || course.className || '',
    teacherName: fullName(teacher) || 'Non assigné'
  };
}

function cycleById(db, cycleId) {
  return (db.cycles || []).find((item) => item.id === cycleId) || null;
}

function cycleOfClass(db, classroom) {
  if (!classroom) return cycleById(db, 'cycle_universite') || (db.cycles || [])[0] || null;
  return cycleById(db, classroom.cycleId)
    || cycleById(db, cycleIdFromLevel(classroom.level, classroom.name))
    || (db.cycles || [])[0]
    || null;
}

function evaluationTypeById(db, typeId) {
  return (db.evaluationTypes || []).find((item) => item.id === typeId) || null;
}

function typesForCycle(db, cycleId) {
  return (db.evaluationTypes || [])
    .filter((item) => item.cycleId === cycleId)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function gradeWeightFromType(cycle, type, requestedCoefficient) {
  if (!type) return Number(requestedCoefficient || 1) || 1;
  const locked = !cycle || cycle.teacherCanEditCoefficient === false;
  const requested = requestedCoefficient === undefined || requestedCoefficient === null || requestedCoefficient === ''
    ? null
    : Number(requestedCoefficient);
  if (cycle?.gradingMode === 'percent') {
    const fallback = Number(type.weightPercent || type.coefficient || 1) || 1;
    return locked || requested === null ? fallback : requested;
  }
  const fallback = Number(type.coefficient || 1) || 1;
  return locked || requested === null ? fallback : requested;
}

function resolveGradeRules(db, { courseId, classId, typeId, label, coefficient }) {
  const course = db.courses.find((item) => item.id === courseId);
  const classroom = classById(db, classId || course?.classId);
  const cycle = cycleOfClass(db, classroom);
  const types = typesForCycle(db, cycle?.id);
  const type = evaluationTypeById(db, typeId)
    || types.find((item) => item.name === label)
    || null;
  const resolvedLabel = type?.name || label || 'Devoir';
  return {
    cycle,
    type,
    classroom,
    course,
    label: resolvedLabel,
    typeName: resolvedLabel,
    typeId: type?.id || typeId || '',
    cycleId: cycle?.id || '',
    coefficient: gradeWeightFromType(cycle, type, coefficient),
    weightPercent: type ? Number(type.weightPercent || 0) : 0,
    maxScore: type ? Number(type.maxScore || 20) : 20,
    gradingMode: cycle?.gradingMode || 'coefficient',
    teacherCanEditCoefficient: Boolean(cycle?.teacherCanEditCoefficient)
  };
}

function withEvaluation(db, evaluation) {
  const classroom = classById(db, evaluation.classId);
  const course = db.courses.find((item) => item.id === evaluation.courseId);
  const type = evaluationTypeById(db, evaluation.typeId);
  const cycle = cycleById(db, evaluation.cycleId) || cycleOfClass(db, classroom);
  const teacher = teacherById(db, evaluation.teacherId);
  return {
    ...evaluation,
    className: classroom?.name || '',
    courseTitle: course ? withCourse(db, course).title : '',
    typeName: type?.name || evaluation.title || '',
    cycleName: cycle?.name || '',
    gradingMode: cycle?.gradingMode || 'coefficient',
    teacherCanEditCoefficient: Boolean(cycle?.teacherCanEditCoefficient),
    teacherName: fullName(teacher)
  };
}

function withGrade(db, grade) {
  const student = studentById(db, grade.studentId);
  const course = db.courses.find((item) => item.id === grade.courseId);
  const work = (db.workItems || []).find((item) => item.id === grade.workId);
  const type = evaluationTypeById(db, grade.typeId);
  const evaluation = (db.evaluations || []).find((item) => item.id === grade.evaluationId);
  return {
    ...grade,
    studentName: fullName(student),
    courseTitle: course ? withCourse(db, course).title : (work?.title || grade.label || 'Cours'),
    className: classNameOf(db, student),
    typeName: type?.name || grade.type || grade.label || '',
    evaluationTitle: evaluation?.title || ''
  };
}

function withWork(db, item) {
  const classroom = classById(db, item.classId);
  const subject = subjectById(db, item.subjectId);
  const teacher = teacherById(db, item.teacherId);
  const { storedName, ...safe } = item;
  return {
    ...safe,
    className: classroom?.name || '',
    level: classroom?.level || '',
    subjectName: subject?.name || '',
    teacherName: fullName(teacher)
  };
}

function teacherClassIds(db, teacher) {
  if (!teacher) return [];
  const fromCourses = db.courses.filter((course) => course.teacherId === teacher.id).map((course) => course.classId);
  const fromMain = db.classes.filter((classroom) => classroom.mainTeacherId === teacher.id).map((classroom) => classroom.id);
  return [...new Set([...fromCourses, ...fromMain].filter(Boolean))];
}

function withPayment(db, payment) {
  const student = studentById(db, payment.studentId);
  return {
    ...payment,
    studentName: fullName(student),
    className: classNameOf(db, student)
  };
}

function averageOf(grades) {
  if (!grades.length) return 0;
  const totalCoef = grades.reduce((sum, grade) => sum + Number(grade.coefficient || 1), 0);
  const total = grades.reduce((sum, grade) => sum + Number(grade.score || 0) * Number(grade.coefficient || 1), 0);
  return totalCoef ? Math.round((total / totalCoef) * 10) / 10 : 0;
}

function endTimeOf(startTime, hours = 2) {
  if (!startTime) return '';
  const [hour, minute] = String(startTime).split(':').map(Number);
  if (Number.isNaN(hour)) return '';
  return `${String((hour + hours) % 24).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
}

function withSlot(db, slot) {
  return {
    ...slot,
    className: classById(db, slot.classId)?.name || slot.className || '',
    subjectName: subjectById(db, slot.subjectId)?.name || slot.subjectName || '',
    teacherName: fullName(teacherById(db, slot.teacherId)),
    endTime: slot.endTime || endTimeOf(slot.startTime)
  };
}

function withAttendance(db, item) {
  const student = studentById(db, item.studentId);
  return {
    ...item,
    studentName: fullName(student),
    className: classNameOf(db, student)
  };
}

function attachChild(parent, studentId) {
  if (!parent || !studentId) return false;
  const ids = parent.childrenIds || [];
  if (ids.includes(studentId)) return false;
  parent.childrenIds = ids.concat(studentId);
  return true;
}

function linkedStudentIds(db, parent) {
  if (!parent) return [];
  const ids = new Set(parent.childrenIds || []);
  const email = String(parent.email || '').trim().toLowerCase();
  if (email) {
    (db.students || []).forEach((student) => {
      if (String(student.parentEmail || '').trim().toLowerCase() === email) ids.add(student.id);
    });
  }
  return [...ids];
}

function syncFamilyLinks(db, { parent, student } = {}) {
  let changed = false;
  if (student) {
    const email = String(student.parentEmail || '').trim().toLowerCase();
    if (email) {
      (db.parents || []).forEach((item) => {
        if (String(item.email || '').trim().toLowerCase() === email && attachChild(item, student.id)) changed = true;
      });
    }
  }
  if (parent) {
    linkedStudentIds(db, parent).forEach((studentId) => {
      if (attachChild(parent, studentId)) changed = true;
    });
  }
  return changed;
}

function parentsOf(db, studentId) {
  return (db.parents || []).filter((parent) => linkedStudentIds(db, parent).includes(studentId));
}

function monthKey(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Autre';
  return value.toLocaleDateString('fr-FR', { month: 'short' });
}

function buildStats(db, year) {
  const students = db.students.filter((item) => inYear(item, year));
  const teachers = db.teachers.filter((item) => item.status === 'actif');
  const classes = db.classes.filter((item) => inYear(item, year));
  const courses = db.courses.filter((item) => inYear(item, year));
  const payments = db.payments.filter((item) => inYear(item, year));
  const grades = db.grades.filter((item) => inYear(item, year));
  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = db.attendance.filter((item) => item.date === today && inYear(item, year));
  const present = todayAttendance.filter((item) => item.status === 'présent').length;
  const absent = todayAttendance.filter((item) => item.status === 'absent').length;
  const late = todayAttendance.filter((item) => item.status === 'retard').length;
  const taken = todayAttendance.length;
  const paid = payments.filter((item) => item.status === 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  let unpaid = payments.filter((item) => item.status !== 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (tuitionExpected(db) > 0) {
    unpaid = students.reduce((sum, student) => sum + tuitionOf(db, student, year).due, 0);
  }
  const month = new Date().toISOString().slice(0, 7);
  const newEnrollments = students.filter((item) => String(item.createdAt || '').startsWith(month)).length;

  const enrollmentChart = {};
  students.forEach((student) => {
    const key = monthKey(student.createdAt);
    enrollmentChart[key] = (enrollmentChart[key] || 0) + 1;
  });

  const paymentChart = {};
  payments.forEach((payment) => {
    const key = monthKey(payment.createdAt);
    if (!paymentChart[key]) paymentChart[key] = { paid: 0, unpaid: 0 };
    if (payment.status === 'payé') paymentChart[key].paid += Number(payment.amount || 0);
    else paymentChart[key].unpaid += Number(payment.amount || 0);
  });

  const resultsChart = classes.map((classroom) => {
    const classStudents = students.filter((student) => student.classId === classroom.id);
    const classGrades = grades.filter((grade) => classStudents.some((student) => student.id === grade.studentId));
    return { label: classroom.name, value: averageOf(classGrades) };
  }).filter((item) => item.value);

  const alerts = [];
  if (!taken) alerts.push({ level: 'warning', text: "L'appel du jour n'est pas encore complet." });
  if (absent) alerts.push({ level: 'danger', text: `${absent} absence${absent > 1 ? 's' : ''} aujourd'hui.` });
  const unpaidStudents = students.filter((student) => ['impayé', 'partiel'].includes(tuitionOf(db, student, year).status)).length;
  if (unpaid) alerts.push({ level: 'warning', text: `Impayés : ${unpaid.toLocaleString('fr-FR')} ${db.settings.currency || 'FC'}.` });
  if (unpaidStudents) alerts.push({ level: 'warning', text: `${unpaidStudents} élève${unpaidStudents > 1 ? 's n’ont' : ' n’a'} pas soldé la scolarité.` });
  const overdue = payments.filter((item) => item.status !== 'payé' && item.dueDate && item.dueDate < today);
  if (overdue.length) alerts.push({ level: 'danger', text: `${overdue.length} échéance(s) dépassée(s).` });

  return {
    stats: {
      students: students.length,
      teachers: teachers.length,
      classes: classes.length,
      courses: courses.length,
      presenceRate: taken ? Math.round((present / taken) * 100) : 0,
      present,
      absent,
      late,
      paymentsTotal: paid,
      unpaidTotal: unpaid,
      newEnrollments,
      grades: grades.length
    },
    charts: {
      enrollments: Object.entries(enrollmentChart).map(([label, value]) => ({ label, value })),
      payments: Object.entries(paymentChart).map(([label, value]) => ({ label, ...value })),
      results: resultsChart
    },
    alerts,
    recentStudents: students.slice(-5).reverse().map((student) => withStudent(db, student)),
    recentPayments: payments.slice(-5).reverse().map((payment) => withPayment(db, payment)),
    announcements: db.announcements.filter((item) => inYear(item, year)).slice(0, 5),
    events: db.events.filter((item) => inYear(item, year)).sort((a, b) => a.date.localeCompare(b.date))
  };
}

function nextMatricule(db, year) {
  const prefix = `KEL-${String(year).slice(0, 4)}`;
  const count = db.students.filter((item) => String(item.matricule || '').startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(4, '0')}`;
}

function nextReceipt(db, year) {
  const prefix = `REC-${String(year).slice(0, 4)}`;
  const count = db.payments.filter((item) => String(item.receiptNumber || '').startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(4, '0')}`;
}

function presenceRate(records) {
  if (!records.length) return 0;
  const ok = records.filter((item) => item.status === 'présent' || item.status === 'retard').length;
  return Math.round((ok / records.length) * 100);
}

function rankLabel(rank) {
  if (!rank) return '—';
  return rank === 1 ? '1er' : `${rank}ème`;
}

function classRanking(db, classId, year) {
  const classmates = db.students.filter((item) => item.classId === classId && inYear(item, year));
  const rows = classmates.map((item) => ({
    id: item.id,
    average: averageOf(db.grades.filter((grade) => grade.studentId === item.id && inYear(grade, year)))
  }));
  const withNotes = rows.filter((item) => item.average > 0).sort((a, b) => b.average - a.average);
  const without = rows.filter((item) => !item.average);
  let index = 0;
  while (index < withNotes.length) {
    const avg = withNotes[index].average;
    let end = index + 1;
    while (end < withNotes.length && withNotes[end].average === avg) end += 1;
    const rank = index + 1;
    for (let i = index; i < end; i += 1) {
      withNotes[i].rank = rank;
      withNotes[i].rankLabel = rankLabel(rank);
    }
    index = end;
  }
  without.forEach((item) => {
    item.rank = 0;
    item.rankLabel = '—';
  });
  const total = classmates.length;
  return withNotes.concat(without).map((item) => ({ ...item, total }));
}

function rankingsByClass(db, year) {
  const map = {};
  [...new Set(db.students.map((item) => item.classId).filter(Boolean))].forEach((classId) => {
    classRanking(db, classId, year).forEach((item) => {
      map[item.id] = item;
    });
  });
  return map;
}

function rankingOf(db, student, year) {
  if (!student?.classId) return { rank: 0, rankLabel: '—', total: 0, average: 0 };
  const row = classRanking(db, student.classId, year).find((item) => item.id === student.id);
  return {
    rank: row?.rank || 0,
    rankLabel: row?.rankLabel || '—',
    total: row?.total || 0,
    average: row?.average || 0
  };
}

function withRank(db, student, year, ranks) {
  const row = (ranks && ranks[student.id]) || rankingOf(db, student, year);
  return {
    ...withStudent(db, student),
    average: row.average || 0,
    rank: row.rank || 0,
    rankLabel: row.rankLabel || '—',
    classSize: row.total || 0
  };
}

function appreciation(average) {
  if (average >= 16) return 'Excellent travail. Continue ainsi.';
  if (average >= 14) return 'Très bon trimestre. Des efforts réguliers.';
  if (average >= 12) return 'Bon travail. Peut encore progresser.';
  if (average >= 10) return 'Résultats satisfaisants. Plus de régularité est souhaitée.';
  if (average > 0) return 'Des difficultés. Un accompagnement est nécessaire.';
  return 'Pas encore de notes enregistrées.';
}

function decision(average) {
  if (!average) return 'En cours';
  return average >= 10 ? 'Admis(e)' : 'À rattraper';
}

function classStats(db, classroom, year) {
  const students = db.students.filter((item) => item.classId === classroom.id && inYear(item, year));
  const studentAverages = students
    .map((student) => averageOf(db.grades.filter((grade) => grade.studentId === student.id && inYear(grade, year))))
    .filter((value) => value > 0);
  const attendance = db.attendance.filter((item) => item.classId === classroom.id && inYear(item, year));
  return {
    studentsCount: students.length,
    average: studentAverages.length
      ? Math.round((studentAverages.reduce((sum, value) => sum + value, 0) / studentAverages.length) * 10) / 10
      : 0,
    presenceRate: presenceRate(attendance),
    mainTeacherName: fullName(teacherById(db, classroom.mainTeacherId))
  };
}

function subjectAverages(grades) {
  const groups = {};
  grades.forEach((grade) => {
    const key = grade.courseTitle || 'Matière';
    if (!groups[key]) groups[key] = [];
    groups[key].push(grade);
  });
  return Object.entries(groups).map(([subject, items]) => ({
    subject,
    average: averageOf(items),
    coefficient: items[0]?.coefficient || 1
  }));
}

function paidPercent(payments) {
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (!total) return 0;
  const paid = payments.filter((item) => item.status === 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return Math.round((paid / total) * 100);
}

function tuitionExpected(db) {
  return Number(db.settings?.tuitionAmount || 0);
}

function paymentChannels(db) {
  const settings = db.settings || {};
  const momoNumber = String(settings.momoNumber || '').trim();
  const airtelMoneyNumber = String(settings.airtelMoneyNumber || '').trim();
  return {
    momoName: String(settings.momoName || '').trim(),
    momoNumber,
    airtelMoneyName: String(settings.airtelMoneyName || '').trim(),
    airtelMoneyNumber,
    paymentInstructions: String(settings.paymentInstructions || '').trim(),
    hasAny: Boolean(momoNumber || airtelMoneyNumber)
  };
}

function tuitionOf(db, student, year) {
  const payments = (db.payments || []).filter((item) => item.studentId === student.id && inYear(item, year));
  const paid = payments.filter((item) => item.status === 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = payments.filter((item) => item.status !== 'payé').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expected = tuitionExpected(db);
  const due = expected > 0 ? Math.max(0, Math.round((expected - paid) * 100) / 100) : pending;
  let status = 'non renseigné';
  let statusLabel = 'Non renseigné';
  if (expected > 0) {
    if (paid >= expected) {
      status = 'payé';
      statusLabel = 'Payé';
    } else if (paid > 0) {
      status = 'partiel';
      statusLabel = 'Partiel';
    } else {
      status = 'impayé';
      statusLabel = 'Impayé';
    }
  } else if (payments.length) {
    if (pending === 0 && paid > 0) {
      status = 'payé';
      statusLabel = 'Payé';
    } else if (paid > 0 && pending > 0) {
      status = 'partiel';
      statusLabel = 'Partiel';
    } else {
      status = 'impayé';
      statusLabel = 'Impayé';
    }
  }
  const basis = expected > 0 ? expected : (paid + pending);
  return {
    paid,
    pending,
    due,
    expected,
    status,
    statusLabel,
    paidPercent: basis ? Math.min(100, Math.round((paid / basis) * 100)) : 0,
    paymentsCount: payments.length
  };
}

function withTuition(db, student, year) {
  const info = tuitionOf(db, student, year);
  return {
    ...student,
    tuition: info,
    tuitionStatus: info.status,
    tuitionLabel: info.statusLabel,
    tuitionPaid: info.paid,
    tuitionDue: info.due,
    paidPercent: info.paidPercent
  };
}

function studentFiche(db, student, year) {
  const grades = db.grades.filter((item) => item.studentId === student.id && inYear(item, year)).map((item) => withGrade(db, item));
  const payments = db.payments.filter((item) => item.studentId === student.id && inYear(item, year)).map((item) => withPayment(db, item));
  const attendance = db.attendance.filter((item) => item.studentId === student.id && inYear(item, year));
  const sanctions = db.sanctions.filter((item) => item.studentId === student.id && inYear(item, year));
  const timetable = db.timetable.filter((item) => item.classId === student.classId && inYear(item, year)).map((item) => withSlot(db, item));
  const documents = (db.documents || []).filter((item) => item.studentId === student.id && inYear(item, year));
  const parents = parentsOf(db, student.id);
  const average = averageOf(grades);
  const rank = rankingOf(db, student, year);
  const tuition = tuitionOf(db, student, year);
  const history = Array.isArray(student.history) && student.history.length
    ? student.history
    : [{ year: student.year || year, className: classNameOf(db, student), status: student.status || 'actif' }];
  return {
    student: withStudent(db, student),
    grades,
    subjects: subjectAverages(grades),
    average,
    ranking: rank,
    appreciation: appreciation(average),
    decision: decision(average),
    payments,
    tuition,
    paidPercent: tuition.paidPercent,
    attendance: attendance.map((item) => withAttendance(db, item)),
    sanctions,
    timetable,
    documents,
    parents,
    history,
    absences: attendance.filter((item) => item.status === 'absent').length,
    lates: attendance.filter((item) => item.status === 'retard').length,
    presenceRate: presenceRate(attendance)
  };
}

module.exports = {
  yearOf,
  inYear,
  classById,
  subjectById,
  teacherById,
  studentById,
  fullName,
  classNameOf,
  withStudent,
  withStudentFace,
  withTeacher,
  withCourse,
  withGrade,
  withEvaluation,
  cycleById,
  cycleOfClass,
  evaluationTypeById,
  typesForCycle,
  gradeWeightFromType,
  resolveGradeRules,
  withPayment,
  withWork,
  teacherClassIds,
  averageOf,
  buildStats,
  nextMatricule,
  nextReceipt,
  studentFiche,
  presenceRate,
  rankingOf,
  rankLabel,
  classRanking,
  rankingsByClass,
  withRank,
  appreciation,
  decision,
  classStats,
  subjectAverages,
  paidPercent,
  tuitionExpected,
  paymentChannels,
  tuitionOf,
  withTuition,
  endTimeOf,
  withSlot,
  withAttendance,
  parentsOf,
  linkedStudentIds,
  syncFamilyLinks,
  attachChild
};
