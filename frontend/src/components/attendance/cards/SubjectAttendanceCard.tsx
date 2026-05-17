// ============================================================
// components/attendance/cards/SubjectAttendanceCard.tsx
// ============================================================
// Reusable card for ONE subject's attendance summary.
// Used in a responsive grid: 1 col (mobile) → 2 → 3 (desktop).
//
// DESIGN DECISION: progress bar vs. circle for subject cards?
//   Circle works well for the OVERALL summary (one big number).
//   Progress bar works better for COMPARISON across subjects
//   because horizontal bars can be scanned and compared quickly
//   with the eye — like how Spotify shows track lengths.
//
// The card also shows the attendance breakdown pill row:
//   [P:22] [A:3] [L:1] [E:0]
// This gives the student the raw counts at a glance, so they
// can tell if their absences were "excused" vs "unexcused".
// ============================================================

import { AlertTriangle } from 'lucide-react';
import type { SubjectBreakdown } from '@/types/attendance';
import type { JSX } from 'react';

interface SubjectAttendanceCardProps {
  data: SubjectBreakdown;
}

export default function SubjectAttendanceCard({ data }: SubjectAttendanceCardProps): JSX.Element {
  const pct   = data.percentage;
  const safe  = !data.is_below_threshold;

  const barColor =
    pct >= 90 ? 'bg-emerald-500'
    : pct >= 75 ? 'bg-indigo-500'
    : pct >= 60 ? 'bg-amber-500'
    : 'bg-rose-500';

  const borderColor = safe ? 'border-gray-200' : 'border-rose-200';
  const bgColor     = safe ? 'bg-white' : 'bg-rose-50/40';

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${borderColor} ${bgColor}`}>
      {/* Subject name + warning */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-800 leading-snug">{data.subject}</h4>
        {!safe && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />}
      </div>

      {/* Percentage + classes */}
      <div className="mb-2 flex items-end justify-between">
        <span className={`text-2xl font-bold ${safe ? 'text-gray-800' : 'text-rose-700'}`}>
          {pct.toFixed(1)}%
        </span>
        <span className="text-xs text-gray-400">
          {data.present_count}/{data.total_classes} classes
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Threshold reference line text */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">0%</span>
        <span className="text-xs text-gray-400">75% min</span>
        <span className="text-xs text-gray-400">100%</span>
      </div>

      {/* Status breakdown pills */}
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          P: {data.present_count}
        </span>
        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
          A: {data.absent_count}
        </span>
        {data.late_count > 0 && (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            L: {data.late_count}
          </span>
        )}
        {data.excused_count > 0 && (
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            E: {data.excused_count}
          </span>
        )}
      </div>
    </div>
  );
}
