// ============================================================
// pages/student/AttendancePage.tsx — Attendance Portal
// ============================================================
// Composition root. Calls useAttendance() ONCE, distributes
// data down to all widgets as props.
//
// PAGE LAYOUT (top to bottom):
//   Header + subtitle
//   AttendanceSummaryBanner   ← overall %, ring, count breakdown
//   InsightCards (×4)         ← best/worst/risk/trend
//   Subject grid              ← SubjectAttendanceCard × N
//   Charts row                ← MonthlyTrend | SubjectComparison
//   FilterBar                 ← subject/status/date filters
//   AttendanceHistoryTable    ← paginated records
// ============================================================

import type { JSX } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useAttendance } from '@/hooks/useAttendance';

import AttendanceSummaryBanner   from '@/components/attendance/cards/AttendanceSummaryBanner';
import InsightCards              from '@/components/attendance/cards/InsightCards';
import SubjectAttendanceCard     from '@/components/attendance/cards/SubjectAttendanceCard';
import MonthlyTrendChart         from '@/components/attendance/charts/MonthlyTrendChart';
import SubjectComparisonChart    from '@/components/attendance/charts/SubjectComparisonChart';
import AttendanceFilterBar       from '@/components/attendance/filters/AttendanceFilterBar';
import AttendanceHistoryTable    from '@/components/attendance/tables/AttendanceHistoryTable';

export default function AttendancePage(): JSX.Element {
  const {
    analytics,
    monthlyTrend,
    subjectComparison,
    insights,
    paginatedRecords,
    allSubjects,
    isLoadingRecords,
    isLoadingAnalytics,
    recordsError,
    analyticsError,
    filters,
    setFilter,
    resetFilters,
    currentPage,
    totalPages,
    totalFiltered,
    records,
    setPage,
    refetch,
  } = useAttendance();

  return (
    <div className="space-y-5 pb-8">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">My Attendance</h1>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            Track your attendance, identify risks, and view your history
          </p>
        </div>
      </div>

      {/* ─── Overall Summary Banner ─── */}
      <AttendanceSummaryBanner
        analytics={analytics}
        isLoading={isLoadingAnalytics}
        error={analyticsError}
        onRefetch={refetch}
      />

      {/* ─── Quick Insight Cards ─── */}
      <InsightCards
        insights={insights}
        isLoading={isLoadingAnalytics}
      />

      {/* ─── Subject-wise Breakdown Grid ─── */}
      {(isLoadingAnalytics || (analytics && analytics.subject_breakdown.length > 0)) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Subject Breakdown</h2>
          {isLoadingAnalytics ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white h-36" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analytics!.subject_breakdown.map(sub => (
                <SubjectAttendanceCard key={sub.subject} data={sub} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Analytics Charts Row ─── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MonthlyTrendChart
          data={monthlyTrend}
          isLoading={isLoadingRecords}
        />
        <SubjectComparisonChart
          data={subjectComparison}
          isLoading={isLoadingAnalytics}
        />
      </div>

      {/* ─── History Table Section ─── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Attendance Records</h2>

        <div className="space-y-3">
          <AttendanceFilterBar
            filters={filters}
            allSubjects={allSubjects}
            totalRecords={records.length}
            totalFiltered={totalFiltered}
            setFilter={setFilter}
            resetFilters={resetFilters}
          />

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
      </section>
    </div>
  );
}
