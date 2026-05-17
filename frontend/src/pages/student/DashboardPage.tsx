// ============================================================
// pages/student/DashboardPage.tsx — Student Operational Home
// ============================================================
// Composition root for the student dashboard.
//
// This page has ONE job: wire useDashboard() data to widgets.
// It contains ZERO API calls, ZERO business logic.
// It's a layout + data distribution layer.
//
// LAYOUT SYSTEM:
//   Row 1: Header banner (full width)
//   Row 2: 4 key stat cards (grid-cols-4)
//   Row 3: Quick Actions bar (full width)
//   Row 4: Attendance + Academic (2 columns, tall)
//   Row 5: Notifications + Tests (2 columns)
//   Row 6: Notes + Placement (2 columns)
//
// On mobile: all columns collapse to 1. On tablet: 2 columns.
// On desktop: full 2-column or 4-column layout.
// ============================================================

import type { JSX } from 'react';
import { useDashboard } from '@/hooks/useDashboard';

import { CalendarCheck, BarChart3, ClipboardList, Briefcase } from 'lucide-react';
import StatCard from '@/components/dashboard/stats/StatCard';
import DashboardHeader from '@/components/dashboard/cards/DashboardHeader';
import QuickActionsBar from '@/components/dashboard/cards/QuickActionsBar';
import AttendanceWidget from '@/components/dashboard/widgets/AttendanceWidget';
import NotificationsWidget from '@/components/dashboard/widgets/NotificationsWidget';
import TestsWidget from '@/components/dashboard/widgets/TestsWidget';
import NotesWidget from '@/components/dashboard/widgets/NotesWidget';
import AcademicWidget from '@/components/dashboard/widgets/AcademicWidget';
import PlacementWidget from '@/components/dashboard/widgets/PlacementWidget';

export default function StudentDashboardPage(): JSX.Element {
  const { data, status, errors } = useDashboard();

  // -------------------------------------------------------
  // DERIVED STAT VALUES
  // Each value is computed from real API data or shows '—'
  // while loading or if error.
  // -------------------------------------------------------
  const attendancePct = data.attendance?.overall_percentage;
  const cgpa          = data.transcript?.current_cgpa;
  const pendingTests  = data.tests?.filter(t => !t.already_attempted).length;
  const unreadNotifs  = data.notifications?.unread_count;

  return (
    <div className="space-y-5 pb-8">
      {/* ─── ROW 1: Header Banner ─── */}
      <DashboardHeader
        profile={data.profile}
        isLoading={status.profile === 'loading'}
      />

      {/* ─── ROW 2: Key Stat Cards ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Attendance"
          value={attendancePct !== undefined ? `${attendancePct.toFixed(1)}%` : '—'}
          subtitle="Overall percentage"
          Icon={CalendarCheck}
          colorScheme="green"
          badge={
            attendancePct !== undefined
              ? attendancePct >= 75
                ? { text: 'Good', variant: 'success' }
                : { text: 'Low', variant: 'danger' }
              : undefined
          }
        />
        <StatCard
          label="CGPA"
          value={cgpa !== undefined && cgpa !== null ? cgpa.toFixed(2) : '—'}
          subtitle="Cumulative GPA"
          Icon={BarChart3}
          colorScheme="purple"
          badge={
            cgpa !== undefined && cgpa !== null
              ? cgpa >= 7
                ? { text: 'Good', variant: 'success' }
                : { text: 'Low', variant: 'warning' }
              : undefined
          }
        />
        <StatCard
          label="Pending Tests"
          value={pendingTests !== undefined ? pendingTests : '—'}
          subtitle="Awaiting attempt"
          Icon={ClipboardList}
          colorScheme="amber"
          badge={
            pendingTests !== undefined && pendingTests > 0
              ? { text: 'Action needed', variant: 'warning' }
              : pendingTests === 0
              ? { text: 'All done', variant: 'success' }
              : undefined
          }
        />
        <StatCard
          label="Notifications"
          value={unreadNotifs !== undefined ? unreadNotifs : '—'}
          subtitle="Unread messages"
          Icon={Briefcase}
          colorScheme="blue"
          badge={
            unreadNotifs !== undefined && unreadNotifs > 0
              ? { text: 'Unread', variant: 'info' }
              : undefined
          }
        />
      </div>

      {/* ─── ROW 3: Quick Actions ─── */}
      <QuickActionsBar />

      {/* ─── ROW 4: Attendance + Academic (tall, equal columns) ─── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AttendanceWidget
          data={data.attendance}
          isLoading={status.attendance === 'loading'}
          error={errors.attendance}
        />
        <AcademicWidget
          data={data.transcript}
          isLoading={status.transcript === 'loading'}
          error={errors.transcript}
        />
      </div>

      {/* ─── ROW 5: Notifications + Tests ─── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <NotificationsWidget
          data={data.notifications}
          isLoading={status.notifications === 'loading'}
          error={errors.notifications}
        />
        <TestsWidget
          data={data.tests}
          isLoading={status.tests === 'loading'}
          error={errors.tests}
        />
      </div>

      {/* ─── ROW 6: Notes + Placement ─── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <NotesWidget
          data={data.notes}
          isLoading={status.notes === 'loading'}
          error={errors.notes}
        />
        <PlacementWidget
          postings={data.postings}
          applications={data.applications}
          isLoading={status.postings === 'loading' || status.applications === 'loading'}
          error={errors.postings ?? errors.applications}
        />
      </div>
    </div>
  );
}
