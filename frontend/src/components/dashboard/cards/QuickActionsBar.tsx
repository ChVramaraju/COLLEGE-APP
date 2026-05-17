// ============================================================
// components/dashboard/cards/QuickActionsBar.tsx
// ============================================================
// Horizontal row of shortcut action buttons.
// Lets students jump directly to key pages in one click.
//
// WHY quick actions on a dashboard?
//   Research shows 80% of users only ever use 20% of features.
//   For a student, those are: check attendance, get notes,
//   take a test, check placement. Quick actions surface these
//   without requiring sidebar navigation.
// ============================================================

import { useNavigate } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  CalendarCheck,
  FileText,
  ClipboardList,
  Briefcase,
  Bell,
  BarChart3,
} from 'lucide-react';
import type { JSX } from 'react';

interface QuickAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
  color: string;
  bg: string;
}

const actions: QuickAction[] = [
  {
    label:  'Attendance',
    icon:   CalendarCheck,
    to:     '/student/attendance',
    color:  'text-emerald-600',
    bg:     'bg-emerald-50 hover:bg-emerald-100',
  },
  {
    label: 'Notes',
    icon:   FileText,
    to:     '/student/notes',
    color:  'text-indigo-600',
    bg:     'bg-indigo-50 hover:bg-indigo-100',
  },
  {
    label: 'Tests',
    icon:   ClipboardList,
    to:     '/student/tests',
    color:  'text-amber-600',
    bg:     'bg-amber-50 hover:bg-amber-100',
  },
  {
    label: 'Results',
    icon:   BarChart3,
    to:     '/student/results',
    color:  'text-purple-600',
    bg:     'bg-purple-50 hover:bg-purple-100',
  },
  {
    label: 'Placement',
    icon:   Briefcase,
    to:     '/student/placement',
    color:  'text-rose-600',
    bg:     'bg-rose-50 hover:bg-rose-100',
  },
  {
    label: 'Inbox',
    icon:   Bell,
    to:     '/student/notifications',
    color:  'text-blue-600',
    bg:     'bg-blue-50 hover:bg-blue-100',
  },
];

export default function QuickActionsBar(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Quick Access
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {actions.map(({ label, icon: Icon, to, color, bg }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${bg}`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
