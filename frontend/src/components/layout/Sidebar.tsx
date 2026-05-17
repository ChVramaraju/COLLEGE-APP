// ============================================================
// components/layout/Sidebar.tsx — Role-aware Navigation
// ============================================================
// The sidebar renders a different nav set per user role.
//
// WHY role-aware sidebar (not separate components per role)?
//   → One component to maintain, one place to add nav items.
//   → Avoids code duplication across 3 role-specific sidebars.
//   → The role simply selects which navItems array to use.
//
// NavLink (not Link) is used because React Router's NavLink
// automatically adds an `isActive` class when its `to` path
// matches the current URL — no manual comparison needed.
// ============================================================

import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  ClipboardList,
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  Briefcase,
  Settings,
  LogOut,
  Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/store/authStore';
import type { UserRole } from '@/types';

// ---------------------------------------------------------------
// NAV ITEM DEFINITION
// ---------------------------------------------------------------
interface NavItem {
  label: string;
  to: string;
  Icon: LucideIcon;
}

// ---------------------------------------------------------------
// NAV ITEMS PER ROLE
// These define the complete navigation for each role.
// Add new pages by adding an entry here.
// ---------------------------------------------------------------
const studentNav: NavItem[] = [
  { label: 'Dashboard',  to: '/student/dashboard',  Icon: LayoutDashboard },
  { label: 'Attendance', to: '/student/attendance',  Icon: CalendarCheck    },
  { label: 'Notes',      to: '/student/notes',       Icon: FileText         },
  { label: 'Tests',      to: '/student/tests',       Icon: ClipboardList    },
  { label: 'Results',    to: '/student/results',     Icon: BarChart3        },
  { label: 'Placement',  to: '/student/placement',   Icon: Briefcase        },
];

const facultyNav: NavItem[] = [
  { label: 'Dashboard',  to: '/faculty/dashboard',   Icon: LayoutDashboard },
  { label: 'Sections',   to: '/faculty/sections',    Icon: Users           },
  { label: 'Attendance', to: '/faculty/attendance',  Icon: CalendarCheck   },
  { label: 'Notes',      to: '/faculty/notes',       Icon: FileText        },
  { label: 'Tests',      to: '/faculty/tests',       Icon: ClipboardList   },
  { label: 'Results',    to: '/faculty/results',     Icon: BarChart3       },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard',  to: '/admin/dashboard',     Icon: LayoutDashboard },
  { label: 'Students',   to: '/admin/students',      Icon: GraduationCap   },
  { label: 'Faculty',    to: '/admin/faculty',        Icon: Users           },
  { label: 'Sections',   to: '/admin/sections',      Icon: Building2       },
  { label: 'Subjects',   to: '/admin/subjects',      Icon: BookOpen        },
  { label: 'Placement',  to: '/admin/placement',     Icon: Briefcase       },
  { label: 'Settings',   to: '/admin/settings',      Icon: Settings        },
];

const navByRole: Record<UserRole, NavItem[]> = {
  student: studentNav,
  faculty: facultyNav,
  admin:   adminNav,
};

// ---------------------------------------------------------------
// ROLE DISPLAY CONFIG
// ---------------------------------------------------------------
const roleConfig: Record<UserRole, { label: string; color: string }> = {
  student: { label: 'Student',  color: 'bg-emerald-500' },
  faculty: { label: 'Faculty',  color: 'bg-amber-500'   },
  admin:   { label: 'Admin',    color: 'bg-rose-500'    },
};

// ---------------------------------------------------------------
// SIDEBAR COMPONENT
// ---------------------------------------------------------------
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = navByRole[user.role];
  const { label: roleLabel, color: roleColor } = roleConfig[user.role];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // ---------------------------------------------------------------
  // ACTIVE LINK STYLES
  // NavLink's className accepts a function that receives { isActive }.
  // ---------------------------------------------------------------
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900
          transform transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + App Name */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Smart College</p>
            <p className="text-xs text-slate-500 leading-tight">Ecosystem</p>
          </div>
        </div>

        {/* Role Badge */}
        <div className="px-4 pt-4 pb-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${roleColor}`}>
            {roleLabel} Portal
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navItems.map(({ label, to, Icon }) => (
            <NavLink key={to} to={to} className={linkClass} onClick={onClose}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-slate-800 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800 hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
