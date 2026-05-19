// ============================================================
// pages/admin/AttendancePage.tsx — Admin Attendance Analytics
// ============================================================
// Institution-wide attendance overview for admins.
//
// LAYOUT (top → bottom):
//   1. Header + refresh button + generated-at timestamp
//   2. Four stat overview cards
//   3. Department comparison bar chart (Recharts)
//   4. Department breakdown table
//   5. Faculty marking activity table
//
// DATA FLOW:
//   Single fetch → GET /attendance/admin/analytics
//   All computation already done on backend.
//   This page is purely presentational.
//
// CHART: BarChart from recharts — department avg %
//   ResponsiveContainer ensures mobile-safe rendering.
//   Null-safe: renders empty state when data is empty.
// ============================================================

import { useState, useEffect, type JSX } from 'react';
import {
  CalendarCheck, RefreshCw, AlertTriangle, Users,
  BarChart3, TrendingDown, ClipboardList,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

import { getAdminAttendanceAnalytics } from '@/services/attendanceService';
import type {
  AdminAttendanceAnalytics,
  DepartmentAttendanceSummary,
  FacultyActivityItem,
} from '@/types/attendance';

const CARD = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';

// ── Colour helpers ─────────────────────────────────────────────
function pctColor(pct: number): string {
  if (pct >= 90) return '#10b981';   // emerald
  if (pct >= 75) return '#22c55e';   // green
  if (pct >= 65) return '#f59e0b';   // amber
  return '#ef4444';                  // rose
}

function pctBadge(pct: number): JSX.Element {
  const cls =
    pct >= 90 ? 'bg-emerald-100 text-emerald-800' :
    pct >= 75 ? 'bg-green-100   text-green-800'   :
    pct >= 65 ? 'bg-amber-100   text-amber-800'   :
               'bg-rose-100   text-rose-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {pct.toFixed(1)}%
    </span>
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function AdminAttendancePage(): JSX.Element {
  const [data,      setData]      = useState<AdminAttendanceAnalytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [fetchKey,  setFetchKey]  = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminAttendanceAnalytics()
      .then(d  => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analytics.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const generatedAt = data
    ? new Date(data.generated_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Analytics</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {loading
                ? 'Loading institution-wide data…'
                : generatedAt
                ? `Generated ${generatedAt}`
                : 'Institution-wide attendance overview'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setFetchKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Sessions"
          value={loading ? '—' : String(data?.total_sessions ?? 0)}
          sub="unique class sessions"
          Icon={ClipboardList}
          accent="indigo"
          isLoading={loading}
        />
        <StatCard
          label="Total Records"
          value={loading ? '—' : String(data?.total_records ?? 0)}
          sub="attendance entries"
          Icon={Users}
          accent="gray"
          isLoading={loading}
        />
        <StatCard
          label="Avg. Attendance"
          value={loading ? '—' : `${(data?.overall_avg_percentage ?? 0).toFixed(1)}%`}
          sub="institution-wide"
          Icon={BarChart3}
          accent={
            !data ? 'indigo' :
            data.overall_avg_percentage >= 75 ? 'emerald' : 'rose'
          }
          isLoading={loading}
        />
        <StatCard
          label="Low Attendance"
          value={loading ? '—' : String(data?.low_attendance_total ?? 0)}
          sub="students below 75%"
          Icon={TrendingDown}
          accent={(data?.low_attendance_total ?? 0) > 0 ? 'rose' : 'emerald'}
          isLoading={loading}
        />
      </div>

      {/* ── Department Bar Chart ────────────────────────────── */}
      <div className={CARD}>
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Department Attendance Comparison
        </h2>

        {loading ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : !data || data.department_summaries.length === 0 ? (
          <EmptyState message="No department data available yet." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.department_summaries}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Avg Attendance']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '75%', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
              <Bar dataKey="avg_percentage" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {data.department_summaries.map((entry) => (
                  <Cell
                    key={entry.department}
                    fill={pctColor(entry.avg_percentage)}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Department Breakdown Table ──────────────────────── */}
      <div className={CARD}>
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Department Breakdown</h2>

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : !data || data.department_summaries.length === 0 ? (
          <EmptyState message="No departments with attendance data yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-3 text-left">Dept</th>
                  <th className="px-3 py-3 text-center">Sections</th>
                  <th className="px-3 py-3 text-center">Students</th>
                  <th className="px-3 py-3 text-center">Sessions</th>
                  <th className="px-3 py-3 text-center">Avg %</th>
                  <th className="px-3 py-3 text-center">Low Att.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.department_summaries.map(dept => (
                  <DeptRow key={dept.department} dept={dept} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Faculty Activity Table ──────────────────────────── */}
      <div className={CARD}>
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Faculty Marking Activity
          <span className="ml-2 text-xs font-normal text-gray-400">(top 10 by sessions)</span>
        </h2>

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : !data || data.faculty_activity.length === 0 ? (
          <EmptyState message="No faculty attendance data available yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Faculty</th>
                  <th className="px-3 py-3 text-center">Sessions Marked</th>
                  <th className="px-3 py-3 text-right">Last Marked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.faculty_activity.map((f, i) => (
                  <FacultyRow key={f.faculty_id} item={f} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({
  label, value, sub, Icon, accent, isLoading,
}: {
  label:     string;
  value:     string;
  sub:       string;
  Icon:      React.ComponentType<{ className?: string }>;
  accent:    'indigo' | 'gray' | 'emerald' | 'rose';
  isLoading: boolean;
}): JSX.Element {
  const cls = {
    indigo:  { card: 'border-indigo-100 bg-indigo-50',  icon: 'bg-indigo-100 text-indigo-600',  val: 'text-indigo-900' },
    gray:    { card: 'border-gray-100   bg-gray-50',    icon: 'bg-gray-100   text-gray-600',    val: 'text-gray-900'   },
    emerald: { card: 'border-emerald-100 bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-900' },
    rose:    { card: 'border-rose-100   bg-rose-50',    icon: 'bg-rose-100   text-rose-600',    val: 'text-rose-900'   },
  }[accent];

  if (isLoading) {
    return (
      <div className={`rounded-2xl border p-5 animate-pulse ${cls.card}`}>
        <div className="mb-3 h-8 w-8 rounded-lg bg-white/60" />
        <div className="mb-1 h-6 w-16 rounded bg-white/60" />
        <div className="h-3 w-24 rounded bg-white/60" />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 ${cls.card}`}>
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${cls.icon}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className={`text-2xl font-extrabold tabular-nums ${cls.val}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  );
}

function DeptRow({ dept }: { dept: DepartmentAttendanceSummary }): JSX.Element {
  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      <td className="px-3 py-3 font-semibold text-gray-900">{dept.department}</td>
      <td className="px-3 py-3 text-center text-gray-600">{dept.total_sections}</td>
      <td className="px-3 py-3 text-center text-gray-600">{dept.total_students}</td>
      <td className="px-3 py-3 text-center text-gray-600">{dept.total_sessions}</td>
      <td className="px-3 py-3 text-center">{pctBadge(dept.avg_percentage)}</td>
      <td className="px-3 py-3 text-center">
        {dept.low_attendance_count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
            {dept.low_attendance_count}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

function FacultyRow({
  item, rank,
}: {
  item: FacultyActivityItem;
  rank: number;
}): JSX.Element {
  const lastDate = item.last_marked_date
    ? new Date(item.last_marked_date + 'T00:00:00').toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      <td className="px-3 py-3 text-xs font-semibold text-gray-400 tabular-nums">{rank}</td>
      <td className="px-3 py-3 font-medium text-gray-900">{item.faculty_name}</td>
      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          <ClipboardList className="h-3 w-3" aria-hidden="true" />
          {item.total_sessions}
        </span>
      </td>
      <td className="px-3 py-3 text-right text-xs text-gray-500">{lastDate}</td>
    </tr>
  );
}

function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-400">
      <CalendarCheck className="h-8 w-8 opacity-25" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function SkeletonTable({ rows, cols }: { rows: number; cols: number }): JSX.Element {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-8 rounded-lg bg-gray-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
