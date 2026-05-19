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
import StudentAttendancePage  from '@/pages/student/StudentAttendancePage';
import StudentResultsPage    from '@/pages/student/StudentResultsPage';
import NotesPage             from '@/pages/student/NotesPage';
import TestsPage             from '@/pages/student/TestsPage';
import TestExamPage          from '@/pages/student/TestExamPage';
import TestResultPage        from '@/pages/student/TestResultPage';
import FacultyTestsPage      from '@/pages/faculty/FacultyTestsPage';
import CreateTestPage        from '@/pages/faculty/CreateTestPage';
import TestAnalyticsPage     from '@/pages/faculty/TestAnalyticsPage';
import FacultyNotesPage      from '@/pages/faculty/FacultyNotesPage';
import UploadFacultyNotePage from '@/pages/faculty/UploadFacultyNotePage';
import EditFacultyNotePage          from '@/pages/faculty/EditFacultyNotePage';
import FacultyAttendancePage       from '@/pages/faculty/FacultyAttendancePage';
import MarkAttendancePage          from '@/pages/faculty/MarkAttendancePage';
import AttendanceHistoryPage       from '@/pages/faculty/AttendanceHistoryPage';
import EditAttendanceSessionPage   from '@/pages/faculty/EditAttendanceSessionPage';
import FacultySectionsPage        from '@/pages/faculty/SectionsPage';
import FacultyResultsPage         from '@/pages/faculty/ResultsPage';
import FacultyAssignmentsPage     from '@/pages/admin/FacultyAssignmentsPage';
import PlacementsPage           from '@/pages/student/PlacementsPage';
import JobDetailPage            from '@/pages/student/JobDetailPage';
import MyApplicationsPage      from '@/pages/student/MyApplicationsPage';
import AdminPlacementsPage     from '@/pages/admin/AdminPlacementsPage';
import CreateJobPage            from '@/pages/admin/CreateJobPage';
import JobApplicationsPage     from '@/pages/admin/JobApplicationsPage';
import AdminUsersPage          from '@/pages/admin/UsersPage';
import AdminDepartmentsPage    from '@/pages/admin/DepartmentsPage';
import AdminSectionsPage       from '@/pages/admin/SectionsPage';
import AdminSystemHealthPage   from '@/pages/admin/SystemHealthPage';
import AdminAnnouncementsPage  from '@/pages/admin/AnnouncementsPage';
import AdminAttendancePage     from '@/pages/admin/AttendancePage';
import { AdminErrorBoundary }  from '@/components/admin/AdminErrorBoundary';

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
          { path: 'attendance', element: <StudentAttendancePage /> },
          { path: 'notes',      element: <NotesPage /> },
          { path: 'tests',                    element: <TestsPage /> },
          { path: 'tests/:testId/exam',    element: <TestExamPage /> },
          { path: 'tests/:testId/result',  element: <TestResultPage /> },
          { path: 'results',    element: <StudentResultsPage /> },
          { path: 'placement',                       element: <PlacementsPage /> },
          { path: 'placement/applications',          element: <MyApplicationsPage /> },
          { path: 'placement/:jobId',                element: <JobDetailPage /> },
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
          { path: 'notes',                               element: <FacultyNotesPage /> },
          { path: 'notes/upload',                        element: <UploadFacultyNotePage /> },
          { path: 'notes/:noteId/edit',                   element: <EditFacultyNotePage /> },
          { path: 'attendance',              element: <FacultyAttendancePage /> },
          { path: 'attendance/mark',          element: <MarkAttendancePage /> },
          { path: 'attendance/history',       element: <AttendanceHistoryPage /> },
          { path: 'attendance/edit',          element: <EditAttendanceSessionPage /> },
          { path: 'sections',   element: <FacultySectionsPage /> },
          { path: 'results',    element: <FacultyResultsPage /> },
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
          { path: 'dashboard',  element: <AdminErrorBoundary><AdminDashboardPage /></AdminErrorBoundary> },
          // { path: 'students',   element: <AdminStudentsPage /> },
          // { path: 'faculty',    element: <AdminFacultyPage /> },
          // { path: 'subjects',   element: <AdminSubjectsPage /> },
          { path: 'placement',                           element: <AdminErrorBoundary><AdminPlacementsPage /></AdminErrorBoundary> },
          { path: 'placement/create-job',               element: <AdminErrorBoundary><CreateJobPage /></AdminErrorBoundary> },
          { path: 'placement/:jobId/edit',              element: <AdminErrorBoundary><CreateJobPage /></AdminErrorBoundary> },
          { path: 'placement/:jobId/applications',      element: <AdminErrorBoundary><JobApplicationsPage /></AdminErrorBoundary> },
          { path: 'users',         element: <AdminErrorBoundary><AdminUsersPage /></AdminErrorBoundary> },
          { path: 'departments',   element: <AdminErrorBoundary><AdminDepartmentsPage /></AdminErrorBoundary> },
          { path: 'sections',      element: <AdminErrorBoundary><AdminSectionsPage /></AdminErrorBoundary> },
          { path: 'system-health', element: <AdminErrorBoundary><AdminSystemHealthPage /></AdminErrorBoundary> },
          { path: 'announcements', element: <AdminErrorBoundary><AdminAnnouncementsPage /></AdminErrorBoundary> },
          { path: 'attendance',    element: <AdminErrorBoundary><AdminAttendancePage /></AdminErrorBoundary> },
          { path: 'faculty-assignments', element: <AdminErrorBoundary><FacultyAssignmentsPage /></AdminErrorBoundary> },
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
