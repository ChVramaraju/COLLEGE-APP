// ============================================================
// pages/faculty/TestAnalyticsPage.tsx — Per-test analytics
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, RefreshCw, Users, Target, Trophy, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import type { JSX } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

import type { TestAnalytics, AllResultsItem } from '@/types/test';
import { getTestAnalytics, getTestAllResults } from '@/services/testService';

type Tab = 'overview' | 'questions' | 'students';

export default function TestAnalyticsPage(): JSX.Element {
  const { testId } = useParams<{ testId: string }>();
  const id = parseInt(testId ?? '0', 10);

  const [analytics,  setAnalytics]  = useState<TestAnalytics | null>(null);
  const [results,    setResults]    = useState<AllResultsItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<Tab>('overview');
  const [fetchKey,   setFetchKey]   = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getTestAnalytics(id), getTestAllResults(id)])
      .then(([a, r]) => {
        if (!cancelled) { setAnalytics(a); setResults(r); }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, fetchKey]);

  if (loading) return <LoadingSkeleton />;

  if (error || !analytics) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <p className="mb-4 text-gray-600">{error ?? 'Analytics not available.'}</p>
        <button
          onClick={() => setFetchKey(k => k + 1)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const PASS_THRESHOLD = 40;
  const passRate = analytics.submitted_count > 0
    ? Math.round((analytics.pass_count / analytics.submitted_count) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <Link
          to="/faculty/tests"
          className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> My Tests
        </Link>
        <h1 className="text-xl font-bold text-gray-900 line-clamp-1">{analytics.title}</h1>
        <p className="text-sm text-gray-500">{analytics.subject} · {analytics.total_marks} total marks</p>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {(['overview', 'questions', 'students'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={<Users className="h-5 w-5 text-indigo-500" />}  label="Total Attempts"  value={analytics.total_attempts} />
            <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Submitted" value={analytics.submitted_count} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-blue-500" />}  label="Avg Score"    value={`${analytics.average_score} / ${analytics.total_marks}`} />
            <StatCard icon={<Target className="h-5 w-5 text-amber-500" />}  label="Pass Rate"     value={`${passRate}%`} />
          </div>

          {/* Score range */}
          {analytics.submitted_count > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ScoreCard label="Highest Score" value={analytics.highest_score} total={analytics.total_marks} color="emerald" />
              <ScoreCard label="Average Score" value={analytics.average_score} total={analytics.total_marks} color="blue" />
              <ScoreCard label="Lowest Score"  value={analytics.lowest_score}  total={analytics.total_marks} color="rose" />
            </div>
          )}

          {/* Pass / fail */}
          {analytics.submitted_count > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <div>
                  <p className="text-xl font-bold text-emerald-700">{analytics.pass_count}</p>
                  <p className="text-xs text-emerald-600">Passed (&ge;{PASS_THRESHOLD}%)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <XCircle className="h-6 w-6 text-rose-400" />
                <div>
                  <p className="text-xl font-bold text-rose-700">{analytics.fail_count}</p>
                  <p className="text-xs text-rose-600">Failed (&lt;{PASS_THRESHOLD}%)</p>
                </div>
              </div>
            </div>
          )}

          {/* Topper */}
          {analytics.topper_roll_number && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <Trophy className="h-6 w-6 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Top Scorer</p>
                <p className="font-bold text-gray-900">{analytics.topper_roll_number}</p>
                <p className="text-xs text-gray-500">{analytics.topper_score} / {analytics.total_marks} marks</p>
              </div>
            </div>
          )}

          {analytics.total_attempts === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No students have attempted this test yet.</p>
          )}
        </div>
      )}

      {/* ── Questions tab ── */}
      {activeTab === 'questions' && (
        <div className="flex flex-col gap-4">
          {analytics.question_accuracy.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No answer data yet.</p>
          ) : (
            <>
              {/* Bar chart */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="mb-4 text-sm font-semibold text-gray-700">Question Accuracy (%)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={analytics.question_accuracy.map((q, i) => ({
                      name: `Q${i + 1}`,
                      accuracy: q.accuracy_percentage,
                    }))}
                    barSize={18}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, 'Accuracy']}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                      {analytics.question_accuracy.map((q, i) => (
                        <Cell
                          key={i}
                          fill={q.accuracy_percentage >= 60 ? '#10b981' : q.accuracy_percentage >= 30 ? '#f59e0b' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Question accuracy table */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                      <th className="px-4 py-3">Q#</th>
                      <th className="px-4 py-3">Question</th>
                      <th className="px-4 py-3 text-right">Correct</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.question_accuracy.map((q, i) => (
                      <tr key={q.question_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-700 line-clamp-1 max-w-xs">{q.question_text}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">{q.correct_answers}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{q.total_answers}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            q.accuracy_percentage >= 60
                              ? 'bg-emerald-100 text-emerald-700'
                              : q.accuracy_percentage >= 30
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700'
                          }`}>
                            {q.accuracy_percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Students tab ── */}
      {activeTab === 'students' && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
          {results.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No attempts recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-4 py-3">Roll No.</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">%</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.attempt_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.roll_number}</td>
                    <td className="px-4 py-3 text-gray-700">{r.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {r.score !== null ? `${r.score} / ${r.total_marks}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {r.percentage !== null ? `${r.percentage.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.is_submitted ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          (r.percentage ?? 0) >= 40
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {(r.percentage ?? 0) >= 40 ? 'Pass' : 'Fail'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          In Progress
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: JSX.Element; label: string; value: string | number }): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, total, color }: {
  label: string; value: number; total: number; color: 'emerald' | 'blue' | 'rose';
}): JSX.Element {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    blue:    'bg-blue-50   border-blue-100   text-blue-700',
    rose:    'bg-rose-50   border-rose-100   text-rose-700',
  }[color];
  return (
    <div className={`rounded-2xl border p-4 text-center ${cls}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-70">/ {total} marks</p>
      <p className="mt-1 text-xs">{label}</p>
    </div>
  );
}

function LoadingSkeleton(): JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-gray-100" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  );
}
