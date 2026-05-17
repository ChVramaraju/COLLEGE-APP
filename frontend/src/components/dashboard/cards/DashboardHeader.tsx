// ============================================================
// components/dashboard/cards/DashboardHeader.tsx
// ============================================================
// The greeting banner at the top of the student dashboard.
// Shows: name, roll number, department, section, current time.
//
// WHY compute a time-based greeting in the frontend?
//   The backend doesn't know or care what time it is for the user.
//   "Good morning" is a UI concern, not a data concern.
//   This is the correct separation — UI personality lives in
//   the presentation layer, not the API layer.
// ============================================================

import { GraduationCap, MapPin, Calendar } from 'lucide-react';
import type { StudentProfile } from '@/types/dashboard';
import type { JSX } from 'react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const deptLabels: Record<string, string> = {
  cse: 'Computer Science & Engineering',
  ece: 'Electronics & Communication',
  mech: 'Mechanical Engineering',
  civil: 'Civil Engineering',
  eee: 'Electrical & Electronics',
  it: 'Information Technology',
  aids: 'AI & Data Science',
};

interface DashboardHeaderProps {
  profile: StudentProfile | undefined;
  isLoading: boolean;
}

export default function DashboardHeader({ profile, isLoading }: DashboardHeaderProps): JSX.Element {
  if (isLoading || !profile) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white animate-pulse">
        <div className="h-6 w-48 rounded bg-white/20 mb-2" />
        <div className="h-4 w-32 rounded bg-white/20" />
      </div>
    );
  }

  const deptLabel = deptLabels[profile.department] ?? profile.department.toUpperCase();

  return (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: greeting + name */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 flex-shrink-0">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-sm text-indigo-200">{getGreeting()} 👋</p>
            <h2 className="text-xl font-bold leading-tight">
              {profile.full_name ?? profile.roll_number}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 text-xs text-indigo-200">
                <span className="font-mono font-semibold text-white">{profile.roll_number}</span>
              </span>
              <span className="text-indigo-400">·</span>
              <span className="text-xs text-indigo-200">{deptLabel}</span>
              <span className="text-indigo-400">·</span>
              <span className="text-xs text-indigo-200">Semester {profile.semester}</span>
            </div>
          </div>
        </div>

        {/* Right: section + date */}
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          {profile.section && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20">
              <MapPin className="h-3 w-3" />
              Section: {profile.section.name}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-indigo-200">
            <Calendar className="h-3 w-3" />
            {formatDate()}
          </span>
        </div>
      </div>
    </div>
  );
}
