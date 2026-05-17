// ============================================================
// components/attendance/filters/AttendanceFilterBar.tsx
// ============================================================
// Filter controls for the attendance history table.
//
// CONTROLLED COMPONENT PATTERN:
//   This component is FULLY CONTROLLED — it has zero internal state.
//   ALL state lives in useAttendance() (the hook).
//   This component only:
//   → Renders the current filter values (from props)
//   → Calls setFilter() when the user changes something
//
//   WHY fully controlled?
//   Because the table, pagination, and record count ALL need to
//   react to filter changes. If filter state lived inside this
//   component, they couldn't read it without prop drilling or
//   lifting state up. State in the hook = accessible everywhere.
//
// FILTERS PROVIDED:
//   Subject dropdown  → populated from allSubjects (unique from records)
//   Status dropdown   → hardcoded options (present/absent/late/excused)
//   From date input   → HTML date input, triggers instant filter
//   To date input     → HTML date input, triggers instant filter
//   Reset button      → clears all filters
// ============================================================

import { Filter, X } from 'lucide-react';
import type { AttendanceFilters } from '@/types/attendance';
import type { JSX } from 'react';

interface AttendanceFilterBarProps {
  filters:      AttendanceFilters;
  allSubjects:  string[];
  totalRecords: number;
  totalFiltered: number;
  setFilter:    <K extends keyof AttendanceFilters>(key: K, value: AttendanceFilters[K]) => void;
  resetFilters: () => void;
}

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent',  label: 'Absent'  },
  { value: 'late',    label: 'Late'    },
  { value: 'excused', label: 'Excused' },
] as const;

export default function AttendanceFilterBar({
  filters,
  allSubjects,
  totalRecords,
  totalFiltered,
  setFilter,
  resetFilters,
}: AttendanceFilterBarProps): JSX.Element {
  const hasActiveFilters =
    filters.subject !== '' ||
    filters.status  !== '' ||
    filters.fromDate !== '' ||
    filters.toDate  !== '';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filter Records</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {totalFiltered} of {totalRecords}
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Filter controls — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Subject filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
          <select
            value={filters.subject}
            onChange={e => setFilter('subject', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
          >
            <option value="">All Subjects</option>
            {allSubjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={filters.status}
            onChange={e => setFilter('status', e.target.value as AttendanceFilters['status'])}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">From Date</label>
          <input
            type="date"
            value={filters.fromDate}
            onChange={e => setFilter('fromDate', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
          />
        </div>

        {/* To date */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">To Date</label>
          <input
            type="date"
            value={filters.toDate}
            onChange={e => setFilter('toDate', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
          />
        </div>
      </div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {filters.subject && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {filters.subject}
              <button onClick={() => setFilter('subject', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.status && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">
              {filters.status}
              <button onClick={() => setFilter('status', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.fromDate && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              From: {filters.fromDate}
              <button onClick={() => setFilter('fromDate', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.toDate && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              To: {filters.toDate}
              <button onClick={() => setFilter('toDate', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
