// ============================================================
// layouts/DashboardLayout.tsx — Authenticated App Shell
// ============================================================
// The persistent shell for every authenticated page.
// Structure:
//
//   ┌──────────────────────────────────────────────┐
//   │ Sidebar (fixed, 256px)  │ Navbar (h-16)      │
//   │                         │─────────────────── │
//   │  Nav items...           │                    │
//   │                         │  <Outlet />        │
//   │                         │  (page content)    │
//   │  [Sign Out]             │                    │
//   └──────────────────────────────────────────────┘
//
// On mobile: sidebar is off-screen by default, slides in
// when the hamburger is clicked. Clicking the overlay closes it.
//
// Outlet renders the matched child route (e.g. StudentDashboardPage).
// The shell (sidebar + navbar) stays mounted and never re-renders
// during page navigation — only the Outlet content swaps.
// ============================================================

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout() {
  // Controls mobile sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — static on desktop, drawer on mobile */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
