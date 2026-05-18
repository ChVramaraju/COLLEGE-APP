// ============================================================
// routes/index.tsx — Application Route Tree
// ============================================================
// createBrowserRouter defines the complete route hierarchy.
// React Router v7 uses this declarative tree to match URLs
// and render the correct component chain.
//
// ROUTE TREE:
//
//   /                    → redirect to /login
//   /login               → AuthLayout > LoginPage
//   /student/*           → ProtectedRoute(student) > DashboardLayout > pages
//   /faculty/*           → ProtectedRoute(faculty) > DashboardLayout > pages
//   /admin/*             → ProtectedRoute(admin)   > DashboardLayout > pages
//   *                    → NotFoundPage
//
// WHY nested routes?
//   React Router renders the ENTIRE chain for a matched path.
//   /student/dashboard renders:
//     ProtectedRoute → DashboardLayout → StudentDashboardPage
//   Each parent renders its <Outlet /> which is filled by the
//   next level. This means:
//     - ProtectedRoute enforces auth before DashboardLayout mounts
//     - DashboardLayout (sidebar + navbar) wraps all student pages
//     - Navigating between /student/dashboard and /student/attendance
//       ONLY re-renders the page content, not the sidebar/navbar
// ============================================================

import { createBrowserRouter, Navigate } from 'react-router-dom';

import AuthLayout            from '@/layouts/AuthLayout';
import DashboardLayout       from '@/layouts/DashboardLayout';
import ProtectedRoute        from '@/routes/ProtectedRoute';

import LoginPage             from '@/pages/auth/LoginPage';
import StudentDashboardPage  from '@/pages/student/DashboardPage';
import FacultyDashboardPage  from '@/pages/faculty/DashboardPage';
import AdminDashboardPage    from '@/pages/admin/DashboardPage';
import NotFoundPage          from '@/pages/common/NotFoundPage';
import AttendancePage        from '@/pages/student/AttendancePage';
import NotesPage             from '@/pages/student/NotesPage';
import TestsPage             from '@/pages/student/TestsPage';
import TestExamPage          from '@/pages/student/TestExamPage';
import TestResultPage        from '@/pages/student/TestResultPage';
import FacultyTestsPage      from '@/pages/faculty/FacultyTestsPage';
import CreateTestPage        from '@/pages/faculty/CreateTestPage';
import TestAnalyticsPage     from '@/pages/faculty/TestAnalyticsPage';

const router = createBrowserRouter([
  // Root: redirect to login
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },

  // Auth routes — no sidebar, no auth check
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      { index: true, element: <LoginPage /> },
    ],
  },

  // Student routes — requires role=student
  {
    path: '/student',
    element: <ProtectedRoute allowedRole="student" />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard',  element: <StudentDashboardPage /> },
          { path: 'attendance', element: <AttendancePage /> },
          { path: 'notes',      element: <NotesPage /> },
          { path: 'tests',                    element: <TestsPage /> },
          { path: 'tests/:testId/exam',    element: <TestExamPage /> },
          { path: 'tests/:testId/result',  element: <TestResultPage /> },
          // { path: 'results',    element: <StudentResultsPage /> },
          // { path: 'placement',  element: <StudentPlacementPage /> },
        ],
      },
    ],
  },

  // Faculty routes — requires role=faculty
  {
    path: '/faculty',
    element: <ProtectedRoute allowedRole="faculty" />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard',  element: <FacultyDashboardPage /> },
          { path: 'tests',                              element: <FacultyTestsPage /> },
          { path: 'tests/create',                       element: <CreateTestPage /> },
          { path: 'tests/:testId/edit',                 element: <CreateTestPage /> },
          { path: 'tests/:testId/analytics',            element: <TestAnalyticsPage /> },
          // { path: 'sections',   element: <FacultySectionsPage /> },
          // { path: 'attendance', element: <FacultyAttendancePage /> },
          // { path: 'notes',      element: <FacultyNotesPage /> },
          // { path: 'results',    element: <FacultyResultsPage /> },
        ],
      },
    ],
  },

  // Admin routes — requires role=admin
  {
    path: '/admin',
    element: <ProtectedRoute allowedRole="admin" />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard',  element: <AdminDashboardPage /> },
          // { path: 'students',   element: <AdminStudentsPage /> },
          // { path: 'faculty',    element: <AdminFacultyPage /> },
          // { path: 'sections',   element: <AdminSectionsPage /> },
          // { path: 'subjects',   element: <AdminSubjectsPage /> },
          // { path: 'placement',  element: <AdminPlacementPage /> },
          // { path: 'settings',   element: <AdminSettingsPage /> },
        ],
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;
