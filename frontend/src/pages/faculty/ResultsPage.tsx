// ============================================================
// pages/faculty/ResultsPage.tsx — Faculty Results Browser
// ============================================================
// Faculty views test results for all their tests.
//
// FLOW:
//   1. Pick a test from the dropdown (left panel)
//   2. Results table loads (right panel):
//      - Rank, Roll No, Name, Score, %, Pass/Fail
//   3. Summary cards: avg score, pass rate, highest, lowest
//   4. Search filter: roll number or name
//
// DATA: useFacultyResults() → getFacultyTests() + getTestAllResults()
// NO new backend endpoints required.
// ============================================================

import React, { type JSX } from 'react';
import {
  Trophy, TrendingUp, TrendingDown, Users,
  CheckCircle2, XCircle, Search, Loader2,
  AlertTriangle, BarChart3, ClipboardList,
} from 'lucide-react';
import { useFacultyResults } from '@/hooks/useFacultyResults';
import type { RankedResult, ResultStats } from '@/hooks/useFacultyResults';
import type { TestDetail } from '@/types/test';

const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

export default function FacultyResultsPage(): JSX.Element {
  const {
    tests, testsLoading,
    selectedTestId, selectTest,
    resultsLoading, resultsError, stats,
    searchQuery, setSearchQuery,
    filtered,
  } = useFacultyResults();

  const selectedTest = tests.find(t => t.id === selectedTestId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Test Results</h1>
        <p className="mt-1 text-sm text-gray-500">
          View student results and performance analytics for your tests.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

        {/* ── Left: Test selector ───────────────────────────── */}
        <div className={`${CARD} flex flex-col h-fit`}>
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Your Tests
            </p>
          </div>
          {testsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            </div>
          ) : tests.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <ClipboardList className="mx-auto mb-2 h-7 w-7 text-gray-300" />
              <p className="text-xs text-gray-500">No tests created yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 overflow-y-auto max-h-[60vh]">
              {tests.map(test => (
                <TestListItem
                  key={test.id}
                  test={test}
                  isSelected={test.id === selectedTestId}
                  onClick={() => selectTest(test.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* ── Right: Results panel ──────────────────────────── */}
        <div className="space-y-6">

          {!selectedTestId && (
            <div className={`${CARD} flex flex-col items-center py-16 text-center`}>
              <BarChart3 className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Select a test to view results</p>
              <p className="mt-1 text-xs text-gray-400">Click any test on the left panel</p>
            </div>
          )}

          {selectedTestId && (
            <>
              {/* Test title */}
              {selectedTest && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedTest.title}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedTest.subject} · {selectedTest.total_marks} marks
                  </p>
                </div>
              )}

              {/* Stats row */}
              {stats && <StatsRow stats={stats} />}

              {/* Results table */}
              {resultsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                </div>
              ) : resultsError ? (
                <div className={`${CARD} flex items-center gap-3 p-4 text-rose-600`}>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">{resultsError}</p>
                </div>
              ) : (
                <ResultsTable
                  results={filtered}
                  totalMarks={selectedTest?.total_marks ?? 100}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Test list item (left panel)
// ============================================================
function TestListItem({
  test, isSelected, onClick,
}: {
  test:       TestDetail;
  isSelected: boolean;
  onClick:    () => void;
}): JSX.Element {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300 ${
          isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
        }`}
      >
        <p className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-800'}`}>
          {test.title}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {test.subject} · {test.total_marks}m
        </p>
      </button>
    </li>
  );
}


// ============================================================
// Stats row
// ============================================================
function StatsRow({ stats }: { stats: ResultStats }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard icon={Users}        label="Attempted"  value={stats.totalAttempts}          color="indigo" />
      <StatCard icon={TrendingUp}   label="Average"    value={stats.averageScore}            color="blue"   suffix="pts" />
      <StatCard icon={Trophy}       label="Highest"    value={stats.highestScore}            color="emerald" suffix="pts" />
      <StatCard icon={TrendingDown} label="Lowest"     value={stats.lowestScore}             color="amber"  suffix="pts" />
      <StatCard icon={CheckCircle2} label="Passed"     value={stats.passCount}               color="green" />
      <StatCard icon={XCircle}      label="Pass Rate"  value={stats.passRate}                color="violet" suffix="%" />
    </div>
  );
}


// ============================================================
// Results table
// ============================================================
function ResultsTable({
  results, totalMarks, searchQuery, onSearchChange,
}: {
  results:        RankedResult[];
  totalMarks:     number;
  searchQuery:    string;
  onSearchChange: (q: string) => void;
}): JSX.Element {
  return (
    <div className={CARD}>
      {/* Search bar */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name or roll number…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200"
          />
        </div>
      </div>

      {results.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          {searchQuery ? 'No results match your search.' : 'No submissions yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Roll No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Score</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">%</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map(r => (
                <ResultRow key={r.attempt_id} result={r} totalMarks={totalMarks} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ============================================================
// Result row
// ============================================================
function ResultRow({ result, totalMarks }: { result: RankedResult; totalMarks: number }): JSX.Element {
  const pct        = result.percentage ?? 0;
  const passed     = pct >= 40;
  const rankColors = result.rank === 1 ? 'text-amber-600 font-bold'
    : result.rank === 2 ? 'text-gray-500 font-semibold'
    : result.rank === 3 ? 'text-orange-500 font-semibold'
    : 'text-gray-400';

  return (
    <tr className="hover:bg-gray-50/50">
      <td className={`px-4 py-3 tabular-nums ${rankColors}`}>{result.rank}</td>
      <td className="px-4 py-3 font-mono text-xs text-gray-600">{result.roll_number}</td>
      <td className="px-4 py-3 text-gray-800">{result.full_name ?? '—'}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
        {result.score ?? '—'} / {totalMarks}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
        {result.is_submitted ? `${pct.toFixed(1)}%` : '—'}
      </td>
      <td className="px-4 py-3 text-center">
        {!result.is_submitted ? (
          <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            In Progress
          </span>
        ) : passed ? (
          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Pass
          </span>
        ) : (
          <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
            Fail
          </span>
        )}
      </td>
    </tr>
  );
}


// ============================================================
// Stat card
// ============================================================
function StatCard({
  icon: Icon, label, value, color, suffix = '',
}: {
  icon:    React.ElementType;
  label:   string;
  value:   number;
  color:   string;
  suffix?: string;
}): JSX.Element {
  const colorMap: Record<string, string> = {
    indigo:  'bg-indigo-50  text-indigo-600',
    blue:    'bg-blue-50    text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50   text-amber-600',
    green:   'bg-green-50   text-green-600',
    violet:  'bg-violet-50  text-violet-600',
  };
  return (
    <div className={`${CARD} flex flex-col items-center p-3 text-center`}>
      <div className={`mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[color] ?? 'bg-gray-50 text-gray-500'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-gray-900">{value}{suffix}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
