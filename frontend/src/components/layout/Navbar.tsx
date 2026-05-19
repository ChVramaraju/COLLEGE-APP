// ============================================================
// components/layout/Navbar.tsx — Top Navigation Bar
// ============================================================
// Shows: hamburger (mobile), page title, user info.
//
// The hamburger button toggles the mobile sidebar.
// On desktop (lg+), the sidebar is always visible and the
// hamburger is hidden.
// ============================================================

import { Menu, User } from 'lucide-react';
import { useAuth } from '@/store/authStore';
import type { UserRole } from '@/types';
import NotificationBell from '@/components/notifications/NotificationBell';

const roleLabels: Record<UserRole, string> = {
  student: 'Student',
  faculty: 'Faculty',
  admin:   'Administrator',
};

interface NavbarProps {
  onMenuClick: () => void;
  pageTitle?: string;
}

export default function Navbar({ onMenuClick, pageTitle = 'Dashboard' }: NavbarProps) {
  const { user } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">{pageTitle}</h1>
      </div>

      {/* Right: notifications + user info */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        {/* User avatar + role */}
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          {user && (
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">
                {user.userId}
              </p>
              <p className="text-xs text-gray-500 leading-tight">
                {roleLabels[user.role]}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
