// ============================================================
// hooks/useStudentAttendance.ts — Student Attendance Dashboard
// ============================================================
// Central data + computation hub for the student attendance page.
//
// DATA SOURCES:
//   records   ← GET /attendance/me      (full raw history)
//   analytics ← GET /attendance/me/analytics  (pre-aggregated)
//
// DERIVED COMPUTATIONS (all memoized):
//   overallStats   — per-status counts + % from raw records
//   healthBadge    — Excellent/Safe/Warning/Critical
//   classesNeeded  — classes to reach 75% (0 if already safe)
//   weeklyTrend    — last 12 ISO-week buckets for area chart
//   pieData        — P/A/L/E segments for the pie chart
//   calendarData   — Map<date, CalendarDayData> for a given month
//   recentRecords  — last 12 records (newest-first)
//   filteredRecords — records after subject/date/status filter
//   paginatedRecords — current page slice
//   allSubjects    — sorted unique subject list for filter
//
// CALENDAR MONTH STATE:
//   Defaults to current month.
//   setCalendarMonth("YYYY-MM") navigates without refetch.
//
// WHY build a separate hook instead of extending useAttendance.ts?
//   useAttendance.ts is used by the OLD AttendancePage (still in tree).
//   A new hook means zero risk of breaking the old page, and we can
//   add richer computations without bloating the existing one.
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getMyAttendanceRecords,
  getMyAttendanceAnalytics,
} from '@/services/attendanceService';
import type {
  AttendanceRecord,
  AttendanceAnalytics,
  AttendanceStatus,
  SubjectBreakdown,
  HealthBadge,
  OverallStats,
  WeeklyTrendPoint,
  CalendarDayData,
  AttendancePiePoint,
} from '@/types/attendance';

const PAGE_SIZE = 15;

// ============================================================
// PURE COMPUTATION HELPERS
// ============================================================

function computeOverallStats(records: AttendanceRecord[]): OverallStats {
  let present = 0, absent = 0, late = 0, excused = 0;
  for (const r of records) {
    if      (r.status === 'present') present++;
    else if (r.status === 'absent')  absent++;
    else if (r.status === 'late')    late++;
    else if (r.status === 'excused') excused++;
  }
  const total         = records.length;
  const presentAndLate = present + late;
  const percentage    = total > 0 ? Math.round((presentAndLate / total) * 1000) / 10 : 0;
  return { total, present, absent, late, excused, presentAndLate, percentage };
}

function getHealthBadge(percentage: number): HealthBadge {
  if (percentage > 90) return 'excellent';
  if (percentage > 75) return 'safe';
  if (percentage > 65) return 'warning';
  return 'critical';
}

// How many consecutive future classes are needed to reach threshold?
// Formula derivation (threshold T=0.75):
//   (presentAndLate + x) / (total + x) >= 0.75
//   presentAndLate + x  >= 0.75 * total + 0.75x
//   0.25x >= 0.75 * total - presentAndLate
//   x >= (3*total - 4*presentAndLate)
function computeClassesNeeded(total: number, presentAndLate: number): number {
  if (total === 0) return 0;
  const pct = (presentAndLate / total) * 100;
  if (pct >= 75) return 0;
  return Math.ceil(3 * total - 4 * presentAndLate);
}

// ISO week key: "YYYY-WW" — Monday as first day of week
function getIsoWeekKey(dateStr: string): { key: string; label: string } {
  const d      = new Date(dateStr + 'T00:00:00');
  const day    = d.getDay(); // 0=Sun
  const toMon  = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + toMon);

  const y      = monday.getFullYear();
  const jan1   = new Date(y, 0, 1);
  const weekN  = Math.ceil(((monday.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
  const key    = `${y}-${String(weekN).padStart(2, '0')}`;
  const label  = monday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return { key, label: `${label}` };
}

function buildWeeklyTrend(records: AttendanceRecord[]): WeeklyTrendPoint[] {
  if (records.length === 0) return [];

  const map = new Map<string, {
    label: string; present: number; absent: number; late: number; total: number;
  }>();

  for (const r of records) {
    const { key, label } = getIsoWeekKey(r.attendance_date);
    if (!map.has(key)) map.set(key, { label, present: 0, absent: 0, late: 0, total: 0 });
    const b = map.get(key)!;
    b.total++;
    if      (r.status === 'present') b.present++;
    else if (r.status === 'absent')  b.absent++;
    else if (r.status === 'late')    { b.late++; b.present++; } // late counts as attended
  }

  return Array.from(map.entries())
    .map(([sortKey, d]) => ({
      week:       d.label,
      present:    d.present,
      absent:     d.absent,
      late:       d.late,
      total:      d.total,
      percentage: d.total > 0 ? Math.round((d.present / d.total) * 1000) / 10 : 0,
      sortKey,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-12); // Last 12 weeks
}

function buildCalendarData(
  records: AttendanceRecord[],
  yearMonth: string,
): Map<string, CalendarDayData> {
  const map = new Map<string, CalendarDayData>();

  for (const r of records) {
    if (!r.attendance_date.startsWith(yearMonth)) continue;
    const date = r.attendance_date;
    if (!map.has(date)) {
      map.set(date, { date, dominant: 'none', records: [], presentCount: 0, absentCount: 0, lateCount: 0 });
    }
    const day = map.get(date)!;
    day.records.push(r);
    if      (r.status === 'present') day.presentCount++;
    else if (r.status === 'absent')  day.absentCount++;
    else if (r.status === 'late')    day.lateCount++;
  }

  // Dominant: any absent → absent; any late (no absent) → late; all present → present
  for (const day of map.values()) {
    if (day.records.length === 0) { day.dominant = 'none'; continue; }
    if (day.absentCount > 0)      day.dominant = 'absent';
    else if (day.lateCount > 0)   day.dominant = 'late';
    else                          day.dominant = 'present';
  }

  return map;
}

function buildPieData(stats: OverallStats): AttendancePiePoint[] {
  const pts: AttendancePiePoint[] = [];
  if (stats.present  > 0) pts.push({ name: 'Present',  value: stats.present,  color: '#10b981' });
  if (stats.absent   > 0) pts.push({ name: 'Absent',   value: stats.absent,   color: '#ef4444' });
  if (stats.late     > 0) pts.push({ name: 'Late',     value: stats.late,     color: '#f59e0b' });
  if (stats.excused  > 0) pts.push({ name: 'Excused',  value: stats.excused,  color: '#3b82f6' });
  return pts;
}


// ============================================================
// FILTER TYPES
// ============================================================

export interface DashboardFilters {
  subject:   string;
  status:    AttendanceStatus | '';
  fromDate:  string;
  toDate:    string;
}

export const EMPTY_FILTERS: DashboardFilters = {
  subject: '', status: '', fromDate: '', toDate: '',
};


// ============================================================
// HOOK RETURN TYPE
// ============================================================

export interface UseStudentAttendanceReturn {
  // API state
  records:            AttendanceRecord[];
  analytics:          AttendanceAnalytics | null;
  isLoadingRecords:   boolean;
  isLoadingAnalytics: boolean;
  recordsError:       string | null;
  analyticsError:     string | null;

  // Computed (memoized)
  overallStats:      OverallStats;
  healthBadge:       HealthBadge;
  classesNeeded:     number;
  weeklyTrend:       WeeklyTrendPoint[];
  pieData:           AttendancePiePoint[];
  recentRecords:     AttendanceRecord[];
  allSubjects:       string[];
  subjectBreakdown:  SubjectBreakdown[];   // from analytics, sorted worst-first

  // Calendar
  calendarMonth:     string;              // "YYYY-MM"
  calendarData:      Map<string, CalendarDayData>;
  setCalendarMonth:  (m: string) => void;

  // Filters + pagination
  filters:           DashboardFilters;
  setFilter:         <K extends keyof DashboardFilters>(k: K, v: DashboardFilters[K]) => void;
  resetFilters:      () => void;
  filteredRecords:   AttendanceRecord[];
  paginatedRecords:  AttendanceRecord[];
  currentPage:       number;
  totalPages:        number;
  totalFiltered:     number;
  setPage:           (p: number) => void;

  refetch: () => void;
}


// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useStudentAttendance(): UseStudentAttendanceReturn {

  // ── Fetch state ──────────────────────────────────────────
  const [records,            setRecords]            = useState<AttendanceRecord[]>([]);
  const [analytics,          setAnalytics]          = useState<AttendanceAnalytics | null>(null);
  const [isLoadingRecords,   setIsLoadingRecords]   = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [recordsError,       setRecordsError]       = useState<string | null>(null);
  const [analyticsError,     setAnalyticsError]     = useState<string | null>(null);
  const [fetchKey,           setFetchKey]           = useState(0);

  // ── Calendar month ───────────────────────────────────────
  const [calendarMonth, setCalendarMonth] = useState<string>(
    () => new Date().toISOString().slice(0, 7),
  );

  // ── Filters ──────────────────────────────────────────────
  const [filters,      setFilters]      = useState<DashboardFilters>(EMPTY_FILTERS);
  const [currentPage,  setCurrentPage]  = useState(1);

  const setFilter = useCallback(<K extends keyof DashboardFilters>(
    k: K, v: DashboardFilters[K],
  ) => {
    setFilters(prev => ({ ...prev, [k]: v }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  }, []);

  const refetch = useCallback(() => { setFetchKey(k => k + 1); }, []);

  // ── Fetch records ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoadingRecords(true);
    setRecordsError(null);
    getMyAttendanceRecords()
      .then(data  => { if (!cancelled) setRecords(data); })
      .catch(err  => { if (!cancelled) setRecordsError(err instanceof Error ? err.message : 'Failed to load records.'); })
      .finally(() => { if (!cancelled) setIsLoadingRecords(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  // ── Fetch analytics ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoadingAnalytics(true);
    setAnalyticsError(null);
    getMyAttendanceAnalytics()
      .then(data  => { if (!cancelled) setAnalytics(data); })
      .catch(err  => { if (!cancelled) setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics.'); })
      .finally(() => { if (!cancelled) setIsLoadingAnalytics(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  // ── Derived (all memoized) ───────────────────────────────

  const overallStats = useMemo(() => computeOverallStats(records), [records]);

  const healthBadge = useMemo(
    () => getHealthBadge(overallStats.percentage),
    [overallStats.percentage],
  );

  const classesNeeded = useMemo(
    () => computeClassesNeeded(overallStats.total, overallStats.presentAndLate),
    [overallStats.total, overallStats.presentAndLate],
  );

  const weeklyTrend = useMemo(() => buildWeeklyTrend(records), [records]);

  const pieData = useMemo(() => buildPieData(overallStats), [overallStats]);

  const calendarData = useMemo(
    () => buildCalendarData(records, calendarMonth),
    [records, calendarMonth],
  );

  const recentRecords = useMemo(
    () => [...records].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date)).slice(0, 12),
    [records],
  );

  const allSubjects = useMemo(() => {
    const set = new Set(records.map(r => r.subject));
    return Array.from(set).sort();
  }, [records]);

  const subjectBreakdown = useMemo(() => {
    if (!analytics?.subject_breakdown) return [];
    return [...analytics.subject_breakdown].sort((a, b) => a.percentage - b.percentage);
  }, [analytics]);

  // ── Filtered + paginated records ─────────────────────────
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filters.subject  && r.subject !== filters.subject)                      return false;
      if (filters.status   && r.status  !== filters.status)                       return false;
      if (filters.fromDate && r.attendance_date < filters.fromDate)               return false;
      if (filters.toDate   && r.attendance_date > filters.toDate)                 return false;
      return true;
    }).sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  }, [records, filters]);

  const totalFiltered  = filteredRecords.length;
  const totalPages     = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage       = Math.min(currentPage, totalPages);

  const paginatedRecords = useMemo(
    () => filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRecords, safePage],
  );

  const setPage = useCallback((p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
  }, [totalPages]);

  return {
    records,
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
    recentRecords,
    allSubjects,
    subjectBreakdown,
    calendarMonth,
    calendarData,
    setCalendarMonth,
    filters,
    setFilter,
    resetFilters,
    filteredRecords,
    paginatedRecords,
    currentPage: safePage,
    totalPages,
    totalFiltered,
    setPage,
    refetch,
  };
}
