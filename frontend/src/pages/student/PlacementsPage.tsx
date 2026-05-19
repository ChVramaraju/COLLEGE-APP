// ============================================================
// pages/student/PlacementsPage.tsx   — /student/placement
// ============================================================
// Student job browse dashboard.
//
// LAYOUT:
//   Header + refresh
//   Stats row (total / eligible / applied)
//   Filter bar (search · eligibility toggle · package · dept)
//   Job cards grid (2–3 cols)
//   Empty state
// ============================================================

import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, RefreshCw, Search, SlidersHorizontal,
  ClipboardList, X,
} from 'lucide-react';
import { usePlacements } from '@/hooks/usePlacements';
import JobCard from '@/components/placement/JobCard';
import { DEPARTMENTS } from '@/types/placement';

const INPUT_CLS =
  'rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 ' +
  'placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-colors';

export default function PlacementsPage(): JSX.Element {
  const {
    filteredJobs, isLoading, error,
    filters, setFilter, resetFilters,
    appliedIds, applyingId, applyError, apply,
    refetch, totalJobs, eligibleCount, appliedCount,
  } = usePlacements();

  const hasFilters =
    filters.search !== '' || filters.eligibleOnly ||
    filters.minPackage !== '' || filters.maxPackage !== '' ||
    filters.department !== '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-rose-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Placement Portal</h1>
            <p className="mt-0.5 text-sm text-gray-500">Explore companies and apply to open positions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/student/placement/applications"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            My Applications
          </Link>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}
      {applyError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Apply error:</span> {applyError}
        </div>
      )}

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Open Jobs',         value: totalJobs,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Eligible for You',  value: eligibleCount,  color: 'text-emerald-700',bg: 'bg-emerald-50' },
            { label: 'Already Applied',   value: appliedCount,   color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border border-gray-200 ${s.bg} p-4 shadow-sm`}>
              <p className={`text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />

          {/* Search */}
          <div className="relative min-w-0 flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              placeholder="Search company or role…"
              className={`${INPUT_CLS} pl-9 w-full`}
            />
          </div>

          {/* Eligible only toggle */}
          <button
            onClick={() => setFilter('eligibleOnly', !filters.eligibleOnly)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none ${
              filters.eligibleOnly
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Eligible only
          </button>

          {/* Department */}
          <select
            value={filters.department}
            onChange={e => setFilter('department', e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          {/* Package */}
          <input
            type="number" min={0} step={0.5}
            value={filters.minPackage}
            onChange={e => setFilter('minPackage', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Min LPA"
            className={`${INPUT_CLS} w-24`}
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="number" min={0} step={0.5}
            value={filters.maxPackage}
            onChange={e => setFilter('maxPackage', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Max LPA"
            className={`${INPUT_CLS} w-24`}
          />

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 focus:outline-none"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Job cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-gray-200" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Briefcase className="h-12 w-12 text-gray-200" aria-hidden="true" />
          <p className="text-lg font-semibold text-gray-500">
            {hasFilters ? 'No jobs match your filters' : 'No open positions right now'}
          </p>
          {hasFilters && (
            <button onClick={resetFilters} className="text-sm text-indigo-600 underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">{filteredJobs.length} position{filteredJobs.length !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                applied={appliedIds.has(job.id)}
                applying={applyingId === job.id}
                onApply={apply}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
