// ============================================================
// routes/ProtectedRoute.tsx — Auth + Role Guard
// ============================================================
// This component wraps every role-specific route section.
// It enforces two rules:
//
//   RULE 1 — Authentication:
//     If the user is not logged in, redirect to /login.
//     The `state` prop carries the attempted URL so after
//     login the user lands back where they were going.
//
//   RULE 2 — Authorization:
//     If the user IS logged in but has the wrong role
//     (e.g. a student hitting /faculty/*), redirect them
//     to their own dashboard instead of showing a 403.
//     This is friendlier UX than an error page.
//
//   RULE 3 — Loading:
//     During the initial session restoration (isLoading=true),
//     show a spinner. Without this, there's a flash where
//     a logged-in user briefly sees the login page, then
//     gets redirected. The spinner prevents that flicker.
//
// USAGE (in routes/index.tsx):
//   { path: '/student', element: <ProtectedRoute allowedRole="student" /> }
// ============================================================

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { getDashboardRoute } from '@/utils/constants';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  allowedRole: UserRole;
}

export default function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Rule 3: Still checking localStorage — show spinner
  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Rule 1: Not authenticated → go to login, remember where they were
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Rule 2: Wrong role → redirect to correct dashboard
  if (user.role !== allowedRole) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  // All checks passed → render the matched child route
  return <Outlet />;
}
