// ============================================================
// components/attendance/tables/AttendanceHistoryTable.tsx
// ============================================================
// Paginated table of all attendance records.
//
// PRODUCTION TABLE DESIGN RULES:
//
//  1. NEVER render all rows at once.
//     400 rows = 400 DOM nodes = jank. Paginate to 15 rows/page.
//
//  2. Status pills must be visually distinct.
//     present → green, absent → red, late → amber, excused → blue
//     A student can scan 100 rows and spot absences instantly.
//
//  3. Responsive: on mobile, collapse secondary columns.
//     Period number and faculty ID are hidden on small screens.
//     Date + subject + status = minimum viable mobile row.
//
//  4. Sortable columns (future): add sort indicators to headers.
//     Not implemented now, but columns are designed to support it.
//
//  5. Empty state: when no rows match filters, show a helpful
//     message, not a blank white box.
//
// PAGINATION COMPONENT:
//   Separate component at the bottom — prev/next + page numbers.
//   Renders the correct subset from paginatedRecords prop.
//   Never renders more page buttons than needed.
// ============================================================

import { CalendarCheck, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { AttendanceRecord } from '@/types/attendance';
import type { JSX } from 'react';

// ---------------------------------------------------------------
// STATUS PILL — color-coded badge for attendance status
// ---------------------------------------------------------------
const statusConfig = {
  present: { label: 'Present', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  absent:  { label: 'Absent',  bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
  late:    { label: 'Late',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  excused: { label: 'Excused', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
} as const;

function StatusPill({ status }: { status: AttendanceRecord['status'] }): JSX.Element {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00'); // avoid timezone shift
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

// ---------------------------------------------------------------
// PAGINATION CONTROLS
// ---------------------------------------------------------------
interface PaginationProps {
  currentPage: number;
  totalPages:  number;
  onPageChange: (p: number) => void;
  totalFiltered: number;
  pageSize: number;
}

function PaginationControls({ currentPage, totalPages, onPageChange, totalFiltered, pageSize }: PaginationProps): JSX.Element {
  const from = (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, totalFiltered);

  // Build visible page number array (max 5 buttons)
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-col items-center gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-between">
      <p className="text-xs text-gray-400">
        Showing <span className="font-medium text-gray-600">{from}–{to}</span> of{' '}
        <span className="font-medium text-gray-600">{totalFiltered}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
              p === currentPage
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// MAIN TABLE
// ---------------------------------------------------------------
interface AttendanceHistoryTableProps {
  records:       AttendanceRecord[];
  isLoading:     boolean;
  error:         string | null;
  currentPage:   number;
  totalPages:    number;
  totalFiltered: number;
  onPageChange:  (p: number) => void;
}

const PAGE_SIZE = 15;

export default function AttendanceHistoryTable({
  records,
  isLoading,
  error,
  currentPage,
  totalPages,
  totalFiltered,
  onPageChange,
}: AttendanceHistoryTableProps): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
          <CalendarCheck className="h-4 w-4 text-indigo-600" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">Attendance History</h3>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {totalFiltered} records
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-5 py-3.5 animate-pulse">
                <div className="h-3.5 w-20 rounded bg-gray-200" />
                <div className="h-3.5 flex-1 rounded bg-gray-200" />
                <div className="h-3.5 w-16 rounded bg-gray-200" />
                <div className="h-5 w-16 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-500">Failed to load records</p>
            <p className="text-xs text-gray-400">{error}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No records match your filters</p>
            <p className="text-xs text-gray-400">Try clearing the filters above</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 sm:table-cell">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 lg:table-cell">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${
                    r.status === 'absent' ? 'bg-rose-50/10' : ''
                  }`}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-800">{formatDate(r.attendance_date)}</p>
                    <p className="text-xs text-gray-400">{formatDay(r.attendance_date)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{r.subject}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell">
                    P{r.period_number}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 lg:table-cell">
                    {r.remarks ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !error && totalFiltered > 0 && (
        <div className="px-5 py-4">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalFiltered={totalFiltered}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}
    </div>
  );
}
