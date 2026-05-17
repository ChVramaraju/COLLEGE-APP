// ============================================================
// pages/common/NotFoundPage.tsx — 404
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import { getDashboardRoute, ROUTES } from '@/utils/constants';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handleBack = () => {
    if (isAuthenticated && user) {
      navigate(getDashboardRoute(user.role));
    } else {
      navigate(ROUTES.LOGIN);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-8xl font-bold text-indigo-600">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-500">This page doesn't exist or you don't have access to it.</p>
        <button
          onClick={handleBack}
          className="mt-8 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
