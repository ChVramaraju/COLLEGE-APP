// ============================================================
// App.tsx — Application Root
// ============================================================
// Two providers wrap the entire app:
//
//   AuthProvider — makes auth state available everywhere via
//                  useAuth() hook. Must be outermost so that
//                  ProtectedRoute and Sidebar can read it.
//
//   RouterProvider — renders the route tree defined in
//                    routes/index.tsx. RouterProvider must be
//                    inside AuthProvider so route components
//                    can call useAuth().
// ============================================================

import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/store/AuthProvider';
import { NotificationProvider } from '@/contexts/NotificationContext';
import router from '@/routes/index';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </AuthProvider>
  );
}
