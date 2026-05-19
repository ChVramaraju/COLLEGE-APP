// ============================================================
// pages/faculty/SectionsPage.tsx — Faculty Sections Dashboard
// ============================================================
// Shows all sections this faculty is assigned to teach in.
// One card per unique section, listing subjects and quick actions.
//
// DATA: useFacultySections() → getMyFacultyAssignments()
// EMPTY STATE: prompts admin to create assignments
// QUICK ACTIONS: mark attendance, view history
// ============================================================

import React, { type JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ClipboardList, Clock, Loader2,
  AlertTriangle, LayoutGrid, GraduationCap,
  Users, ChevronRight,
} from 'lucide-react';
import { useFacultySections } from '@/hooks/useFacultySections';
import type { SectionCard } from '@/hooks/useFacultySections';

const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

const DEPT_COLORS: Record<string, string> = {
  cse:  'bg-indigo-100 text-indigo-700',
  ece:  'bg-violet-100 text-violet-700',
  mech: 'bg-orange-100 text-orange-700',
  civil:'bg-green-100  text-green-700',
  eee:  'bg-yellow-100 text-yellow-700',
  it:   'bg-cyan-100   text-cyan-700',
};

export default function FacultySectionsPage(): JSX.Element {
  const { sectionCards, totalSections, totalSubjects, isLoading, error } =
    useFacultySections();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-rose-400" />
        <p className="text-sm font-medium text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Sections</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sections and subjects you are assigned to teach.
        </p>
      </div>

      {/* Stat row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={LayoutGrid}  label="Sections"  value={totalSections} color="indigo" />
        <StatCard icon={BookOpen}    label="Subjects"  value={totalSubjects}  color="violet" />
        <StatCard icon={GraduationCap} label="Assignments" value={totalSubjects} color="emerald" />
        <StatCard icon={Users}       label="Modules"   value={totalSections}  color="amber" />
      </div>

      {/* Empty state */}
      {sectionCards.length === 0 && (
        <div className={`${CARD} flex flex-col items-center px-6 py-16 text-center`}>
          <LayoutGrid className="mb-4 h-10 w-10 text-gray-300" />
          <h2 className="mb-1 text-base font-semibold text-gray-700">No Sections Assigned</h2>
          <p className="max-w-sm text-sm text-gray-500">
            You haven't been assigned to any sections yet. Ask your admin to create
            faculty assignments from the Admin → Faculty Assignments page.
          </p>
        </div>
      )}

      {/* Section cards grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sectionCards.map(card => (
          <SectionCardView key={card.section_id} card={card} />
        ))}
      </div>
    </div>
  );
}


// ============================================================
// Section Card
// ============================================================
function SectionCardView({ card }: { card: SectionCard }): JSX.Element {
  const deptKey   = card.department.toLowerCase();
  const deptBadge = DEPT_COLORS[deptKey] ?? 'bg-gray-100 text-gray-600';
  const deptLabel = card.department.toUpperCase();

  return (
    <div className={`${CARD} flex flex-col overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">{card.section_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deptBadge}`}>
              {deptLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Semester {card.semester} · {card.academic_year}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
          <GraduationCap className="h-5 w-5 text-indigo-500" />
        </div>
      </div>

      {/* Subjects */}
      <div className="flex-1 px-5 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Subjects Teaching
        </p>
        <ul className="space-y-1.5">
          {card.subjects.map(sub => (
            <li key={sub} className="flex items-center gap-2 text-sm text-gray-700">
              <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
              {sub}
            </li>
          ))}
        </ul>
      </div>

      {/* Quick actions */}
      <div className="border-t border-gray-100 px-5 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Quick Actions
        </p>
        <div className="flex flex-col gap-1.5">
          <QuickAction
            to={`/faculty/attendance/mark`}
            icon={ClipboardList}
            label="Mark Attendance"
            color="indigo"
          />
          <QuickAction
            to={`/faculty/attendance/history`}
            icon={Clock}
            label="View History"
            color="gray"
          />
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Sub-components
// ============================================================
function StatCard({
  icon: Icon, label, value, color,
}: {
  icon:  React.ElementType;
  label: string;
  value: number;
  color: 'indigo' | 'violet' | 'emerald' | 'amber';
}): JSX.Element {
  const colors = {
    indigo:  'bg-indigo-50  text-indigo-600',
    violet:  'bg-violet-50  text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50   text-amber-600',
  };
  return (
    <div className={`${CARD} flex items-center gap-3 p-4`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function QuickAction({
  to, icon: Icon, label, color,
}: {
  to:    string;
  icon:  React.ElementType;
  label: string;
  color: 'indigo' | 'gray';
}): JSX.Element {
  const cls = color === 'indigo'
    ? 'text-indigo-600 hover:bg-indigo-50'
    : 'text-gray-600 hover:bg-gray-50';
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${cls}`}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 opacity-50" />
    </Link>
  );
}

