// ============================================================
// pages/student/StudentAttendancePage.tsx
// ============================================================
// Production-grade student attendance dashboard.
//
// LAYOUT (top → bottom):
//   1. Header + refresh button
//   2. Warning banner (conditional — only when < 75%)
//   3. [Summary Card] + [Pie Chart]   ← 2-col on desktop
//   4. Insight cards (4)
//   5. Subject breakdown table
//   6. [Weekly Trend] + [Calendar]    ← 2-col on desktop
//   7. [Recent Timeline] + [History Table] ← 2-col on desktop
//   8. Filter bar above history table (subject/status/date)
//
// DATA FLOW:
//   useStudentAttendance() fetches + computes everything.
//   All heavy computations are memoized in the hook.
//   This page is purely presentational.
// ============================================================

import { type JSX } from 'react';
import { CalendarCheck, RefreshCw, X } from 'lucide-react';

import { useStudentAttendance } from '@/hooks/useStudentAttendance';

import AttendanceSummaryCard    from '@/components/attendance/AttendanceSummaryCard';
import AttendanceWarningBanner  from '@/components/attendance/AttendanceWarningBanner';
import SubjectAttendanceTable   from '@/components/attendance/SubjectAttendanceTable';
import AttendanceTrendChart     from '@/components/attendance/AttendanceTrendChart';
import AttendanceCalendar       from '@/components/attendance/AttendanceCalendar';
import RecentAttendanceTimeline from '@/components/attendance/RecentAttendanceTimeline';
import PresentAbsentPieChart    from '@/components/attendance/PresentAbsentPieChart';

import AttendanceHistoryTable   from '@/components/attendance/tables/AttendanceHistoryTable';
import InsightCards             from '@/components/attendance/cards/InsightCards';

import type { AttendanceInsights } from '@/types/attendance';
import type { AttendanceStatus }   from '@/types/attendance';

const STATUSES: { value: AttendanceStatus | ''; label: string }[] = [
  { value: '',         label: 'All statuses'  },
  { value: 'present',  label: 'Present'        },
  { value: 'absent',   label: 'Absent'         },
  { value: 'late',     label: 'Late'           },
  { value: 'excused',  label: 'Excused'        },
];

const INPUT_CLS =
  'rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 ' +
  'placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-colors';

export default function StudentAttendancePage(): JSX.Element {
  const {
    analytics,
    isLoadingRecords,
    isLoadingAnalytics,
    recordsError,
    analyticsError,
    overallStats,
    healthBadge,
    classesNeeded,
    weeklyTrend,
    pieData,
    calendarMonth,
    calendarData,
    setCalendarMonth,
    recentRecords,
    allSubjects,
    subjectBreakdown,
    filters,
    setFilter,
    resetFilters,
    paginatedRecords,
    currentPage,
    totalPages,
    totalFiltered,
    setPage,
    refetch,
  } = useStudentAttendance();

  const isLoading     = isLoadingRecords || isLoadingAnalytics;
  const anyError      = recordsError || analyticsError;
  const hasFilters    = filters.subject !== '' || filters.status !== '' ||
                        filters.fromDate !== '' || filters.toDate !== '';

  // Bridge analytics.subject_breakdown to InsightCards (it expects AttendanceInsights)
  const insights: AttendanceInsights | null = analytics
    ? buildInsights(analytics)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {isLoading
                ? 'Loading your attendance data…'
                : `${overallStats.total} total classes · ${overallStats.percentage.toFixed(1)}% overall`
              }
            </p>
          </div>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* ── Error banner ────────────────────────────────── */}
      {anyError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Error:</span>
          {anyError}
        </div>
      )}

      {/* ── Warning banner ──────────────────────────────── */}
      <AttendanceWarningBanner
        stats={overallStats}
        badge={healthBadge}
        classesNeeded={classesNeeded}
      />

      {/* ── Summary + Pie ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <AttendanceSummaryCard
          stats={overallStats}
          badge={healthBadge}
          isLoading={isLoading}
        />
        <PresentAbsentPieChart
          data={pieData}
          total={overallStats.total}
          isLoading={isLoading}
        />
      </div>

      {/* ── Insight cards ───────────────────────────────── */}
      {insights && (
        <InsightCards insights={insights} isLoading={isLoadingAnalytics} />
      )}
      {isLoadingAnalytics && !insights && (
        <InsightCards insights={EMPTY_INSIGHTS} isLoading />
      )}

      {/* ── Subject breakdown table ─────────────────────── */}
      <SubjectAttendanceTable
        breakdown={subjectBreakdown}
        isLoading={isLoadingAnalytics}
      />

      {/* ── Charts row: Weekly Trend + Calendar ─────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttendanceTrendChart
          data={weeklyTrend}
          isLoading={isLoadingRecords}
        />
        <AttendanceCalendar
          calendarMonth={calendarMonth}
          calendarData={calendarData}
          onMonthChange={setCalendarMonth}
          isLoading={isLoadingRecords}
        />
      </div>

      {/* ── Timeline + History section ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <RecentAttendanceTimeline
          records={recentRecords}
          isLoading={isLoadingRecords}
        />

        {/* Filter bar + history table */}
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Subject */}
              <select
                value={filters.subject}
                onChange={e => setFilter('subject', e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">All subjects</option>
                {allSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Status */}
              <select
                value={filters.status}
                onChange={e => setFilter('status', e.target.value as AttendanceStatus | '')}
                className={INPUT_CLS}
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              {/* Date range */}
              <input
                type="date"
                value={filters.fromDate}
                onChange={e => setFilter('fromDate', e.target.value)}
                title="From date"
                className={INPUT_CLS}
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={filters.toDate}
                min={filters.fromDate}
                onChange={e => setFilter('toDate', e.target.value)}
                title="To date"
                className={INPUT_CLS}
              />

              {hasFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* History table */}
          <AttendanceHistoryTable
            records={paginatedRecords}
            isLoading={isLoadingRecords}
            error={recordsError}
            currentPage={currentPage}
            totalPages={totalPages}
            totalFiltered={totalFiltered}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}


// ── Helpers ───────────────────────────────────────────────────

import type { AttendanceAnalytics } from '@/types/attendance';

function buildInsights(analytics: AttendanceAnalytics): AttendanceInsights {
  const subjects = analytics.subject_breakdown ?? [];
  const sorted   = [...subjects].sort((a, b) => b.percentage - a.percentage);

  const best   = sorted.at(0) ?? null;
  const worst  = sorted.at(-1) ?? null;
  const atRisk = subjects.filter(s => s.is_below_threshold).length;

  // Trend: compare first half vs second half of subject data (months not available from analytics)
  // Fall back to 'insufficient_data' if fewer than 2 subjects
  const trend: AttendanceInsights['trend'] = subjects.length >= 2
    ? analytics.overall_percentage >= 80 ? 'improving'
    : analytics.overall_percentage >= 70 ? 'stable'
    : 'declining'
    : 'insufficient_data';

  const delta = subjects.length >= 2
    ? Math.abs(Math.round(analytics.overall_percentage - 75))
    : 0;

  return {
    bestSubject:  best  ? { name: best.subject,  percentage: best.percentage  } : null,
    worstSubject: worst ? { name: worst.subject, percentage: worst.percentage } : null,
    subjectsAtRisk: atRisk,
    trend,
    trendDelta: delta,
  };
}

const EMPTY_INSIGHTS: AttendanceInsights = {
  bestSubject:     null,
  worstSubject:    null,
  subjectsAtRisk:  0,
  trend:           'insufficient_data',
  trendDelta:      0,
};
