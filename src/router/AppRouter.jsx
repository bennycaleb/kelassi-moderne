import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { roleHome } from '../constants';
import { api } from '../services/api';

import Login from '../pages/Login';
import AdminLayout from '../layout/AdminLayout';
import TeacherLayout from '../layout/TeacherLayout';
import StudentLayout from '../layout/StudentLayout';
import ParentLayout from '../layout/ParentLayout';

import Dashboard from '../pages/dashboard/Dashboard';
import Students from '../pages/students/Students';
import StudentProfile from '../pages/students/StudentProfile';
import Teachers from '../pages/teachers/Teachers';
import TeacherProfile from '../pages/teachers/TeacherProfile';
import Courses from '../pages/courses/Courses';
import Grades from '../pages/grades/Grades';
import Payments from '../pages/payments/Payments';
import Classes from '../pages/classes/Classes';
import ClassDetail from '../pages/classes/ClassDetail';
import Subjects from '../pages/subjects/Subjects';
import Timetable from '../pages/timetable/Timetable';
import Attendance from '../pages/attendance/Attendance';
import FaceAttendance from '../pages/attendance/FaceAttendance';
import Documents from '../pages/documents/Documents';
import PrintDocument from '../pages/documents/PrintDocument';
import Parents from '../pages/parents/Parents';
import Communication from '../pages/communication/Communication';
import SettingsPage from '../pages/settings/Settings';
import AiDesk from '../pages/ai/AiDesk';
import UsersPage from '../pages/users/Users';
import AcademicConfig from '../pages/academic/AcademicConfig';
import TeacherEvaluations from '../pages/academic/TeacherEvaluations';
import OwnerLayout from '../layout/OwnerLayout';
import Tenants from '../pages/owner/Tenants';
import StudentWork from '../pages/work/StudentWork';
import TeacherWork from '../pages/work/TeacherWork';
import StudentHome, { TeacherHome, ParentHome, SimpleList, PaymentsList, StudentAbsences, StudentDocuments, TeacherMessages } from '../pages/portal/PortalPages';

const STAFF = ['admin', 'superadmin', 'director', 'secretary', 'accountant'];

function AppRouter() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = () => {
    localStorage.removeItem('kelassi_user');
    localStorage.removeItem('kelassi_token');
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('kelassi_token');
    if (!token) {
      localStorage.removeItem('kelassi_user');
      setReady(true);
      return;
    }

    api('/api/auth/me', { skipYear: true })
      .then((data) => {
        setUser(data.user);
        localStorage.setItem('kelassi_user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('kelassi-auth'));
      })
      .catch(() => {
        localStorage.removeItem('kelassi_user');
        localStorage.removeItem('kelassi_token');
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    function onLogout() {
      setUser(null);
    }
    window.addEventListener('kelassi-logout', onLogout);
    return () => window.removeEventListener('kelassi-logout', onLogout);
  }, []);

  const login = (data) => {
    const { token, ...userData } = data;
    setUser(userData);
    localStorage.setItem('kelassi_user', JSON.stringify(userData));
    if (token) localStorage.setItem('kelassi_token', token);
    window.dispatchEvent(new Event('kelassi-auth'));
  };

  const home = user ? roleHome(user.role) : '/login';

  if (!ready) {
    return <p style={{ padding: 24 }}>Chargement…</p>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login onLogin={login} />} />
      <Route path="/print/:type" element={user ? <PrintDocument /> : <Navigate to="/login" replace />} />

      <Route
        path="/owner/*"
        element={
          user && user.role === 'owner' ? (
            <OwnerLayout user={user} logout={logout}>
              <Routes>
                <Route index element={<Tenants />} />
              </Routes>
            </OwnerLayout>
          ) : (
            <Navigate to={user ? home : '/login'} replace />
          )
        }
      />

      <Route
        path="/dashboard/*"
        element={
          user && STAFF.includes(user.role) ? (
            <AdminLayout user={user} logout={logout}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="students/:id" element={<StudentProfile />} />
                <Route path="teachers" element={<Teachers />} />
                <Route path="teachers/:id" element={<TeacherProfile />} />
                <Route path="classes" element={<Classes />} />
                <Route path="classes/:id" element={<ClassDetail />} />
                <Route path="subjects" element={<Subjects />} />
                <Route path="courses" element={<Courses />} />
                <Route path="timetable" element={<Timetable />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="face" element={<FaceAttendance />} />
                <Route path="grades" element={<Grades />} />
                <Route path="evaluations" element={<TeacherEvaluations />} />
                <Route path="academic" element={<AcademicConfig />} />
                <Route path="payments" element={<Payments />} />
                <Route path="documents" element={<Documents />} />
                <Route path="parents" element={<Parents />} />
                <Route path="communication" element={<Communication />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="ai" element={<AiDesk />} />
              </Routes>
            </AdminLayout>
          ) : (
            <Navigate to={user ? home : '/login'} replace />
          )
        }
      />

      <Route
        path="/teacher/*"
        element={
          user && user.role === 'teacher' ? (
            <TeacherLayout user={user} logout={logout}>
              <Routes>
                <Route index element={<TeacherHome />} />
                <Route path="ai" element={<AiDesk />} />
                <Route path="courses" element={<TeacherWork />} />
                <Route path="work" element={<TeacherWork />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="face" element={<FaceAttendance />} />
                <Route path="timetable" element={<SimpleList title="Mon emploi du temps" path="/api/timetable" field="timetable" line={(item) => `${item.day} ${item.startTime}–${item.endTime} — ${item.subjectName} (${item.className})`} />} />
                <Route path="grades" element={<Grades />} />
                <Route path="evaluations" element={<TeacherEvaluations />} />
                <Route path="academic" element={<AcademicConfig />} />
                <Route path="messages" element={<TeacherMessages />} />
              </Routes>
            </TeacherLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/student/*"
        element={
          user && user.role === 'student' ? (
            <StudentLayout user={user} logout={logout}>
              <Routes>
                <Route index element={<StudentHome />} />
                <Route path="courses" element={<StudentWork />} />
                <Route path="work" element={<StudentWork />} />
                <Route path="reponses" element={<StudentWork />} />
                <Route path="grades" element={<SimpleList title="📝 Mes notes" path="/api/grades" field="grades" line={(item) => `${item.courseTitle} (${item.type || item.label}) : ${item.score}/20`} />} />
                <Route path="timetable" element={<SimpleList title="📅 Mon emploi du temps" path="/api/timetable" field="timetable" line={(item) => `${item.day} ${item.startTime}–${item.endTime} — ${item.subjectName} (${item.room})`} />} />
                <Route path="absences" element={<StudentAbsences />} />
                <Route path="payments" element={<PaymentsList />} />
                <Route path="documents" element={<StudentDocuments />} />
                <Route path="announcements" element={<SimpleList title="📢 Annonces" path="/api/announcements" field="announcements" line={(item) => `${item.title} — ${item.body}`} />} />
              </Routes>
            </StudentLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/parent/*"
        element={
          user && user.role === 'parent' ? (
            <ParentLayout user={user} logout={logout}>
              <Routes>
                <Route index element={<ParentHome />} />
                <Route path="grades" element={<SimpleList title="Notes" path="/api/grades" field="grades" line={(item) => `${item.studentName} — ${item.courseTitle} : ${item.score}/20`} />} />
                <Route path="attendance" element={<SimpleList title="Absences & présences" path="/api/attendance" field="attendance" line={(item) => `${item.date} — ${item.studentName || ''} — ${item.status}${item.method === 'facial' ? ' (reconnaissance faciale)' : ''}${item.justified ? ' (justifié)' : ''}`} />} />
                <Route path="timetable" element={<SimpleList title="Emploi du temps" path="/api/timetable" field="timetable" line={(item) => `${item.day} ${item.startTime} — ${item.subjectName} (${item.className})`} />} />
                <Route path="payments" element={<PaymentsList />} />
                <Route path="announcements" element={<SimpleList title="Annonces" path="/api/announcements" field="announcements" line={(item) => `${item.title} — ${item.body}`} />} />
              </Routes>
            </ParentLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default AppRouter;
