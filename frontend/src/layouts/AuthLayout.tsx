// ============================================================
// layouts/AuthLayout.tsx — Shell for unauthenticated pages
// ============================================================
// Used by: /login
// No sidebar, no navbar. Just a full-screen container that
// centers its content (the login form) beautifully.
//
// Outlet renders LoginPage (or any other future auth page).
// ============================================================

import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { getDashboardRoute } from '@/utils/constants';

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Still restoring session — wait before deciding
  if (isLoading) return <LoadingSpinner fullScreen />;

  // Already logged in — don't show login page, go to dashboard
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <Outlet />
    </div>
  );
}
