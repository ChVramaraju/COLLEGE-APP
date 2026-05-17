// ============================================================
// hooks/useAttendance.ts — Attendance Data Orchestration
// ============================================================
// Responsibilities:
//   1. Fetch: records + analytics on mount
//   2. Transform: raw records → chart-ready arrays (memoized)
//   3. Filter: subject, status, date range (client-side, instant)
//   4. Paginate: slice filtered records into pages
//   5. Insights: derive best/worst subject, trend, risk count
//
// DATA FLOW DIAGRAM:
//
//   API: GET /attendance/me          API: GET /attendance/me/analytics
//         ↓                                    ↓
//   records: AttendanceRecord[]    analytics: AttendanceAnalytics
//         ↓                                    ↓
//   [useMemo] buildMonthlyTrend()  [useMemo] buildSubjectComparison()
//         ↓                                    ↓
//   monthlyTrend: point[]          subjectComparison: point[]
//         ↓
//   [useMemo] applyFilters()
//         ↓
//   filteredRecords: AttendanceRecord[]
//         ↓
//   [derived] paginate by page + PAGE_SIZE
//         ↓
//   paginatedRecords: AttendanceRecord[]  (to the table)
//
// WHY useMemo for transformations?
//   buildMonthlyTrend loops over 400+ records.
//   Without useMemo, it reruns on EVERY render — including when
//   the user changes page (which is just a state change).
//   useMemo caches the result until `records` changes.
//   This is the key performance pattern for analytics hooks.
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  AttendanceRecord,
  AttendanceAnalytics,
  AttendanceFilters,
  MonthlyTrendPoint,
  SubjectComparisonPoint,
  AttendanceInsights,
} from '@/types/attendance';
import { DEFAULT_FILTERS } from '@/types/attendance';
import {
  getMyAttendanceRecords,
  getMyAttendanceAnalytics,
} from '@/services/attendanceService';

// ---------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------
const PAGE_SIZE = 15;

// ---------------------------------------------------------------
// PURE TRANSFORMATION FUNCTIONS
// ---------------------------------------------------------------
// These are defined OUTSIDE the hook so they are not recreated
// on every render. They have no side effects — pure input → output.

/**
 * Groups raw attendance records by calendar month and computes
 * monthly attendance percentages for the trend line chart.
 *
 * WHY group by month?
 *   Individual daily records are too granular for a trend chart.
 *   Monthly aggregation shows the arc of a semester: are they
 *   improving or declining? This is how university analytics
 *   dashboards work — day-level for records, month-level for trends.
 */
function buildMonthlyTrend(records: AttendanceRecord[]): MonthlyTrendPoint[] {
  if (records.length === 0) return [];

  // Group records by "MMM 'YY" label
  const map = new Map<string, { present: number; absent: number; total: number; sortKey: string }>();

  for (const r of records) {
    const d = new Date(r.attendance_date);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    // sortKey: "YYYY-MM" for chronological sorting
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!map.has(label)) {
      map.set(label, { present: 0, absent: 0, total: 0, sortKey });
    }
    const bucket = map.get(label)!;
    bucket.total += 1;
    if (r.status === 'present' || r.status === 'late') {
      bucket.present += 1;
    } else if (r.status === 'absent') {
      bucket.absent += 1;
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([month, data]) => ({
      month,
      present: data.present,
      absent:  data.absent,
      total:   data.total,
      percentage: data.total > 0
        ? Math.round((data.present / data.total) * 1000) / 10
        : 0,
    }));
}

/**
 * Converts analytics.subject_breakdown into bar chart data.
 * Shortens long subject names to fit X axis labels.
 */
function buildSubjectComparison(analytics: AttendanceAnalytics | null): SubjectComparisonPoint[] {
  if (!analytics) return [];
  return analytics.subject_breakdown
    .sort((a, b) => b.percentage - a.percentage)
    .map(s => ({
      subject:          s.subject.length > 14 ? s.subject.slice(0, 12) + '…' : s.subject,
      percentage:       Math.round(s.percentage * 10) / 10,
      present:          s.present_count,
      total:            s.total_classes,
      isBelowThreshold: s.is_below_threshold,
    }));
}

/**
 * Derives human-readable insights from analytics data.
 * The "trend" is computed by comparing the last two months
 * of the monthly trend array.
 */
function computeInsights(
  analytics: AttendanceAnalytics | null,
  monthlyTrend: MonthlyTrendPoint[],
): AttendanceInsights {
  if (!analytics || analytics.subject_breakdown.length === 0) {
    return {
      bestSubject:     null,
      worstSubject:    null,
      subjectsAtRisk:  0,
      trend:           'insufficient_data',
      trendDelta:      0,
    };
  }

  const sorted  = [...analytics.subject_breakdown].sort((a, b) => b.percentage - a.percentage);
  const best    = sorted[0];
  const worst   = sorted[sorted.length - 1];
  const atRisk  = sorted.filter(s => s.is_below_threshold).length;

  // Trend: compare last two months
  let trend: AttendanceInsights['trend'] = 'insufficient_data';
  let delta = 0;
  if (monthlyTrend.length >= 2) {
    const last   = monthlyTrend[monthlyTrend.length - 1].percentage;
    const prev   = monthlyTrend[monthlyTrend.length - 2].percentage;
    delta = Math.round((last - prev) * 10) / 10;
    trend = delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable';
  }

  return {
    bestSubject:     { name: best.subject, percentage: best.percentage },
    worstSubject:    { name: worst.subject, percentage: worst.percentage },
    subjectsAtRisk:  atRisk,
    trend,
    trendDelta:      delta,
  };
}

// ---------------------------------------------------------------
// THE HOOK
// ---------------------------------------------------------------
export interface UseAttendanceReturn {
  // Raw data
  records:   AttendanceRecord[];
  analytics: AttendanceAnalytics | null;

  // Transformed (chart-ready)
  monthlyTrend:       MonthlyTrendPoint[];
  subjectComparison:  SubjectComparisonPoint[];
  insights:           AttendanceInsights;

  // Filtered + paginated (for the table)
  filteredRecords:    AttendanceRecord[];
  paginatedRecords:   AttendanceRecord[];
  allSubjects:        string[];          // unique subject names for filter dropdown

  // Loading / error
  isLoadingRecords:   boolean;
  isLoadingAnalytics: boolean;
  recordsError:       string | null;
  analyticsError:     string | null;

  // Filter controls (consumed by FilterBar component)
  filters:     AttendanceFilters;
  setFilter:   <K extends keyof AttendanceFilters>(key: K, value: AttendanceFilters[K]) => void;
  resetFilters: () => void;

  // Pagination controls (consumed by Table component)
  currentPage:   number;
  totalPages:    number;
  totalFiltered: number;
  setPage:       (p: number) => void;

  // Actions
  refetch: () => void;
}

export function useAttendance(): UseAttendanceReturn {
  // -----------------------------------------------------------
  // API STATE
  // -----------------------------------------------------------
  const [records,   setRecords]   = useState<AttendanceRecord[]>([]);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);

  const [isLoadingRecords,   setIsLoadingRecords]   = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [recordsError,       setRecordsError]       = useState<string | null>(null);
  const [analyticsError,     setAnalyticsError]     = useState<string | null>(null);

  // -----------------------------------------------------------
  // FILTER STATE
  // -----------------------------------------------------------
  const [filters,     setFilters]     = useState<AttendanceFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  // -----------------------------------------------------------
  // FETCH FUNCTIONS
  // -----------------------------------------------------------
  const fetchRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    setRecordsError(null);
    try {
      const data = await getMyAttendanceRecords();
      setRecords(data);
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const data = await getMyAttendanceAnalytics();
      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  const refetch = useCallback(() => {
    void fetchRecords();
    void fetchAnalytics();
  }, [fetchRecords, fetchAnalytics]);

  // Run on mount
  useEffect(() => {
    void fetchRecords();
    void fetchAnalytics();
  }, [fetchRecords, fetchAnalytics]);

  // -----------------------------------------------------------
  // MEMOIZED CHART TRANSFORMS
  // Only recompute when the underlying data changes,
  // NOT when filters or pagination changes.
  // -----------------------------------------------------------
  const monthlyTrend      = useMemo(() => buildMonthlyTrend(records),           [records]);
  const subjectComparison = useMemo(() => buildSubjectComparison(analytics),     [analytics]);
  const insights          = useMemo(() => computeInsights(analytics, monthlyTrend), [analytics, monthlyTrend]);

  // Unique subject names (for filter dropdown)
  const allSubjects = useMemo(
    () => [...new Set(records.map(r => r.subject))].sort(),
    [records],
  );

  // -----------------------------------------------------------
  // CLIENT-SIDE FILTERING (instant — no API call needed)
  // -----------------------------------------------------------
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filters.subject  && r.subject !== filters.subject)   return false;
      if (filters.status   && r.status  !== filters.status)    return false;
      if (filters.fromDate && r.attendance_date < filters.fromDate) return false;
      if (filters.toDate   && r.attendance_date > filters.toDate)   return false;
      return true;
    });
  }, [records, filters]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [filters]);

  // -----------------------------------------------------------
  // PAGINATION (client-side slicing)
  // -----------------------------------------------------------
  const totalPages    = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage      = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredRecords.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // -----------------------------------------------------------
  // FILTER HELPERS
  // -----------------------------------------------------------
  const setFilter = useCallback(<K extends keyof AttendanceFilters>(
    key: K,
    value: AttendanceFilters[K],
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  return {
    records,
    analytics,
    monthlyTrend,
    subjectComparison,
    insights,
    filteredRecords,
    paginatedRecords,
    allSubjects,
    isLoadingRecords,
    isLoadingAnalytics,
    recordsError,
    analyticsError,
    filters,
    setFilter,
    resetFilters,
    currentPage:   safePage,
    totalPages,
    totalFiltered: filteredRecords.length,
    setPage:       setCurrentPage,
    refetch,
  };
}
