// ============================================================
// components/attendance/SubjectAttendanceTable.tsx
// ============================================================
// Per-subject breakdown table with inline progress bars.
// Sorted worst-first (lowest % at top) so attention is drawn
// to subjects that need immediate action.
// ============================================================

import { useState, type JSX } from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { SubjectBreakdown } from '@/types/attendance';
import type { HealthBadge } from '@/types/attendance';

function getSubjectBadge(pct: number): { badge: HealthBadge; label: string; bg: string; text: string } {
  if (pct > 90) return { badge: 'excellent', label: 'Excellent', bg: 'bg-emerald-100', text: 'text-emerald-800' };
  if (pct > 75) return { badge: 'safe',      label: 'Safe',      bg: 'bg-green-100',   text: 'text-green-800'  };
  if (pct > 65) return { badge: 'warning',   label: 'Warning',   bg: 'bg-amber-100',   text: 'text-amber-800'  };
  return            { badge: 'critical',  label: 'Critical',  bg: 'bg-rose-100',    text: 'text-rose-800'   };
}

function ProgressBar({ pct }: { pct: number }): JSX.Element {
  const color =
    pct > 90 ? '#10b981' :
    pct > 75 ? '#22c55e' :
    pct > 65 ? '#f59e0b' :
    '#ef4444';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

type SortKey = 'subject' | 'percentage' | 'total_classes' | 'absent_count';

interface SubjectAttendanceTableProps {
  breakdown: SubjectBreakdown[];
  isLoading: boolean;
}

export default function SubjectAttendanceTable({
  breakdown, isLoading,
}: SubjectAttendanceTableProps): JSX.Element {
  const [sortKey, setSortKey]   = useState<SortKey>('percentage');
  const [sortAsc, setSortAsc]   = useState(true); // worst first = ascending %

  const sorted = [...breakdown].sort((a, b) => {
    let diff = 0;
    if      (sortKey === 'percentage')   diff = a.percentage   - b.percentage;
    else if (sortKey === 'total_classes')diff = a.total_classes - b.total_classes;
    else if (sortKey === 'absent_count') diff = a.absent_count  - b.absent_count;
    else diff = a.subject.localeCompare(b.subject);
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none ${
        sortKey === k ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'
      }`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
    </button>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-800">Subject-wise Breakdown</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {breakdown.length} subjects
        </span>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-5 py-3.5">
              <div className="h-3.5 w-32 rounded bg-gray-200" />
              <div className="h-3.5 flex-1 rounded bg-gray-200" />
              <div className="h-3.5 w-16 rounded bg-gray-200" />
              <div className="h-5 w-16 rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      ) : breakdown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-400">
          <p className="text-sm">No subject data available yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-3 text-left"><SortBtn k="subject"      label="Subject" /></th>
                <th className="px-4 py-3 text-center"><SortBtn k="total_classes" label="Total" /></th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Present</th>
                <th className="px-4 py-3 text-center"><SortBtn k="absent_count" label="Absent" /></th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Late</th>
                <th className="px-4 py-3 text-center"><SortBtn k="percentage" label="%" /></th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Progress</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(s => {
                const { bg, text, label } = getSubjectBadge(s.percentage);
                const rowBg = s.is_below_threshold
                  ? 'bg-rose-50/20 hover:bg-rose-50/40'
                  : 'hover:bg-gray-50/60';
                return (
                  <tr key={s.subject} className={`transition-colors ${rowBg}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {s.is_below_threshold && (
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                      )}
                      {s.subject}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 tabular-nums">{s.total_classes}</td>
                    <td className="hidden px-4 py-3 text-center text-emerald-700 tabular-nums sm:table-cell">{s.present_count}</td>
                    <td className="px-4 py-3 text-center font-semibold text-rose-600 tabular-nums">{s.absent_count}</td>
                    <td className="hidden px-4 py-3 text-center text-amber-600 tabular-nums sm:table-cell">{s.late_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold tabular-nums ${
                        s.percentage < 65 ? 'text-rose-700' :
                        s.percentage < 75 ? 'text-amber-700' :
                        'text-emerald-700'
                      }`}>
                        {s.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="w-24">
                        <ProgressBar pct={s.percentage} />
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}>
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
