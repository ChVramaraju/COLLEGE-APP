// ============================================================
// pages/student/StudentResultsPage.tsx — Student Test Results
// ============================================================
// Shows a student's full test history with analytics.
//
// DATA SOURCE: GET /tests/my-results → StudentResultSummary[]
//   - Only the authenticated student's own attempts
//   - Backend filters by student_user_id (enforced server-side)
//   - Includes in-progress and submitted attempts
//
// SECTIONS:
//   1. Stat cards  — attempted, avg %, highest, pass rate
//   2. Trend chart — percentage over time (Recharts LineChart)
//   3. Subject breakdown — avg % per subject (Recharts BarChart)
//   4. Results table — all attempts with pass/fail badges
//
// STATES: loading skeleton → empty state → data → error (retry)
// ============================================================

import React, { useState, useEffect, useMemo, type JSX } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  Trophy, TrendingUp, CheckCircle2, XCircle,
  Target, BarChart3, Loader2, AlertTriangle,
  ClipboardList, Calendar, BookOpen, RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMyResults } from '@/services/testService';
import type { StudentResultSummary } from '@/types/test';

const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';
const PASS_THRESHOLD = 40; // % to pass


// ============================================================
// DERIVED STATS
// ============================================================
interface Stats {
  attempted:   number;
  submitted:   number;
  averagePct:  number;
  highestPct:  number;
  lowestPct:   number;
  passCount:   number;
  failCount:   number;
  passRate:    number;
}

function computeStats(results: StudentResultSummary[]): Stats {
  const submitted = results.filter(r => r.is_submitted && r.percentage !== null);
  const pcts      = submitted.map(r => r.percentage!);
  if (pcts.length === 0) {
    return { attempted: results.length, submitted: 0, averagePct: 0, highestPct: 0, lowestPct: 0, passCount: 0, failCount: 0, passRate: 0 };
  }
  const passCount = pcts.filter(p => p >= PASS_THRESHOLD).length;
  return {
    attempted:  results.length,
    submitted:  submitted.length,
    averagePct: Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10,
    highestPct: Math.max(...pcts),
    lowestPct:  Math.min(...pcts),
    passCount,
    failCount:  submitted.length - passCount,
    passRate:   Math.round((passCount / submitted.length) * 100),
  };
}

interface TrendPoint { date: string; pct: number; title: string; }
interface SubjectPoint { subject: string; avg: number; count: number; }

function buildTrend(results: StudentResultSummary[]): TrendPoint[] {
  return results
    .filter(r => r.is_submitted && r.percentage !== null && r.submitted_at)
    .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime())
    .map(r => ({
      date:  new Date(r.submitted_at!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      pct:   Math.round(r.percentage! * 10) / 10,
      title: r.title,
    }));
}

function buildSubjectBreakdown(results: StudentResultSummary[]): SubjectPoint[] {
  const map = new Map<string, number[]>();
  for (const r of results) {
    if (!r.is_submitted || r.percentage === null) continue;
    if (!map.has(r.subject)) map.set(r.subject, []);
    map.get(r.subject)!.push(r.percentage!);
  }
  return Array.from(map.entries())
    .map(([subject, pcts]) => ({
      subject: subject.length > 14 ? subject.slice(0, 13) + '…' : subject,
      avg:     Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10,
      count:   pcts.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

function subjectBarColor(avg: number): string {
  if (avg >= 75) return '#22c55e';
  if (avg >= 50) return '#3b82f6';
  if (avg >= 40) return '#f59e0b';
  return '#ef4444';
}


// ============================================================
// PAGE
// ============================================================
export default function StudentResultsPage(): JSX.Element {
  const [results,   setResults]   = useState<StudentResultSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [fetchKey,  setFetchKey]  = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getMyResults()
      .then(data  => { if (!cancelled) setResults(data); })
      .catch(e    => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load results.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const stats    = useMemo(() => computeStats(results), [results]);
  const trend    = useMemo(() => buildTrend(results), [results]);
  const subjects = useMemo(() => buildSubjectBreakdown(results), [results]);
  const submitted = useMemo(() => results.filter(r => r.is_submitted), [results]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Results</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your complete test history and performance analytics.
        </p>
      </div>

      {/* Loading */}
      {isLoading && <LoadingSkeleton />}

      {/* Error */}
      {!isLoading && error && (
        <ErrorState message={error} onRetry={() => setFetchKey(k => k + 1)} />
      )}

      {/* Empty */}
      {!isLoading && !error && results.length === 0 && <EmptyState />}

      {/* Data */}
      {!isLoading && !error && results.length > 0 && (
        <div className="space-y-8">

          {/* ── STAT CARDS ───────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={ClipboardList} label="Attempted"  value={stats.attempted}           suffix="" color="indigo" />
            <StatCard icon={Target}        label="Average"    value={stats.averagePct}           suffix="%" color="blue"   />
            <StatCard icon={Trophy}        label="Best Score" value={stats.highestPct}           suffix="%" color="emerald"/>
            <StatCard icon={CheckCircle2}  label="Pass Rate"  value={stats.submitted > 0 ? stats.passRate : 0} suffix="%" color="violet"/>
          </div>

          {/* ── CHARTS ROW ───────────────────────────────────── */}
          {trend.length >= 2 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <TrendChart data={trend} />
              {subjects.length > 0 && <SubjectChart data={subjects} />}
            </div>
          )}
          {trend.length >= 2 && subjects.length === 0 && (
            <TrendChart data={trend} />
          )}
          {trend.length < 2 && subjects.length > 0 && (
            <SubjectChart data={subjects} />
          )}

          {/* ── RESULTS TABLE ────────────────────────────────── */}
          <ResultsTable results={results} />

        </div>
      )}
    </div>
  );
}


// ============================================================
// STAT CARD
// ============================================================
function StatCard({
  icon: Icon, label, value, suffix, color,
}: {
  icon:   React.ElementType;
  label:  string;
  value:  number;
  suffix: string;
  color:  'indigo' | 'blue' | 'emerald' | 'violet';
}): JSX.Element {
  const colors = {
    indigo:  'bg-indigo-50  text-indigo-600',
    blue:    'bg-blue-50    text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50  text-violet-600',
  };
  return (
    <div className={`${CARD} flex items-center gap-3 p-4`}>
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">
          {value}{suffix}
        </p>
      </div>
    </div>
  );
}


// ============================================================
// TREND CHART
// ============================================================
function TrendChart({ data }: { data: TrendPoint[] }): JSX.Element {
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-800">Performance Trend</h2>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            formatter={(v: number) => [`${v}%`, 'Score']}
            labelFormatter={(l: string) => l}
          />
          <ReferenceLine y={PASS_THRESHOLD} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Pass', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
          <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '75%', position: 'right', fontSize: 10, fill: '#22c55e' }} />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


// ============================================================
// SUBJECT CHART
// ============================================================
function SubjectChart({ data }: { data: SubjectPoint[] }): JSX.Element {
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold text-gray-800">Subject-wise Average</h2>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            formatter={(v: number, _name: string, entry: { payload: SubjectPoint }) => [
              `${v}% (${entry.payload.count} test${entry.payload.count > 1 ? 's' : ''})`, 'Avg',
            ]}
          />
          <ReferenceLine y={PASS_THRESHOLD} stroke="#f59e0b" strokeDasharray="4 4" />
          <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={subjectBarColor(entry.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {[
          { color: '#22c55e', label: '≥75% Excellent'  },
          { color: '#3b82f6', label: '50–74% Good'     },
          { color: '#f59e0b', label: '40–49% Pass'     },
          { color: '#ef4444', label: '<40% Fail'       },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}


// ============================================================
// RESULTS TABLE
// ============================================================
function ResultsTable({ results }: { results: StudentResultSummary[] }): JSX.Element {
  const sorted = [...results].sort((a, b) => {
    if (a.submitted_at && b.submitted_at)
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    return (b.is_submitted ? 1 : 0) - (a.is_submitted ? 1 : 0);
  });

  return (
    <div className={CARD}>
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <ClipboardList className="h-4 w-4 text-indigo-500" />
          All Attempts
        </h2>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <Th>Test</Th>
              <Th>Subject</Th>
              <Th align="right">Score</Th>
              <Th align="right">%</Th>
              <Th>Submitted</Th>
              <Th align="center">Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(r => (
              <tr key={r.attempt_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <Link
                    to={`/student/tests/${r.test_id}/result`}
                    className="font-medium text-gray-900 hover:text-indigo-600 hover:underline"
                  >
                    {r.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-gray-600">
                    <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                    {r.subject}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                  {r.is_submitted
                    ? `${r.score ?? '—'} / ${r.total_marks}`
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.is_submitted && r.percentage !== null
                    ? <PctBadge pct={r.percentage} />
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {r.submitted_at
                    ? <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge result={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-gray-100 md:hidden">
        {sorted.map(r => (
          <div key={r.attempt_id} className="px-4 py-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link
                to={`/student/tests/${r.test_id}/result`}
                className="font-medium text-gray-900 hover:text-indigo-600"
              >
                {r.title}
              </Link>
              <StatusBadge result={r} />
            </div>
            <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
              <BookOpen className="h-3.5 w-3.5" />{r.subject}
            </p>
            {r.is_submitted && r.percentage !== null && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">
                  {r.score ?? '—'} / {r.total_marks}
                </span>
                <PctBadge pct={r.percentage} />
                {r.submitted_at && (
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================================
// HELPERS
// ============================================================
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }): JSX.Element {
  const cls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${cls}`}>
      {children}
    </th>
  );
}

function PctBadge({ pct }: { pct: number }): JSX.Element {
  const cls =
    pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
    pct >= 50 ? 'bg-blue-100 text-blue-700'       :
    pct >= 40 ? 'bg-amber-100 text-amber-700'      :
               'bg-rose-100 text-rose-700';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function StatusBadge({ result }: { result: StudentResultSummary }): JSX.Element {
  if (!result.is_submitted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        In Progress
      </span>
    );
  }
  const passed = (result.percentage ?? 0) >= PASS_THRESHOLD;
  return passed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
      <XCircle className="h-3 w-3" />Fail
    </span>
  );
}


// ============================================================
// LOADING SKELETON
// ============================================================
function LoadingSkeleton(): JSX.Element {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${CARD} h-20 bg-gray-100`} />
        ))}
      </div>
      <div className={`${CARD} h-64 bg-gray-100`} />
      <div className={`${CARD} h-48 bg-gray-100`} />
    </div>
  );
}


// ============================================================
// EMPTY STATE
// ============================================================
function EmptyState(): JSX.Element {
  return (
    <div className={`${CARD} flex flex-col items-center px-6 py-20 text-center`}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <Trophy className="h-8 w-8 text-indigo-300" />
      </div>
      <h2 className="mb-1 text-base font-semibold text-gray-800">No Results Yet</h2>
      <p className="mb-6 max-w-xs text-sm text-gray-500">
        You haven't submitted any tests yet. Head to the Tests page to get started.
      </p>
      <Link
        to="/student/tests"
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Browse Tests
      </Link>
    </div>
  );
}


// ============================================================
// ERROR STATE
// ============================================================
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <div className={`${CARD} flex flex-col items-center px-6 py-16 text-center`}>
      <AlertTriangle className="mb-3 h-8 w-8 text-rose-400" />
      <p className="mb-4 text-sm font-medium text-gray-700">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        <RotateCcw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}
