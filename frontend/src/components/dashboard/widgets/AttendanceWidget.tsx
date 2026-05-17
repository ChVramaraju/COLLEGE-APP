// ============================================================
// components/dashboard/widgets/AttendanceWidget.tsx
// ============================================================
// Displays: overall attendance %, per-subject breakdown,
// and a red warning if student is below 75%.
//
// The circular progress arc is pure CSS/SVG — no chart library.
// WHY avoid a chart library for a single circle?
//   Libraries like Chart.js add 200KB+ to your bundle.
//   A single SVG circle path is 10 lines and zero dependency.
//   Match the tool to the problem.
//
// The attendance threshold (75%) matches your backend's
// is_below_threshold logic in SubjectBreakdown.
// ============================================================

import { useNavigate } from 'react-router-dom';
import { CalendarCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import type { AttendanceAnalytics, SubjectBreakdown } from '@/types/dashboard';
import SkeletonCard from '@/components/common/SkeletonCard';
import type { JSX } from 'react';

// ---------------------------------------------------------------
// SVG CIRCULAR PROGRESS
// radius=40 → circumference = 2π×40 ≈ 251.3
// strokeDashoffset = circumference × (1 - percentage/100)
// ---------------------------------------------------------------
function CircularProgress({ percentage }: { percentage: number }): JSX.Element {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);
  const color = percentage >= 75 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        {/* Track circle */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        {/* Progress arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-bold text-gray-900">{percentage.toFixed(1)}%</p>
        <p className="text-xs text-gray-400">Overall</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// SUBJECT ROW
// ---------------------------------------------------------------
function SubjectRow({ item }: { item: SubjectBreakdown }): JSX.Element {
  const pct = item.percentage;
  const barColor = item.is_below_threshold
    ? 'bg-rose-500'
    : pct >= 90
    ? 'bg-emerald-500'
    : 'bg-indigo-500';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]">
            {item.subject}
          </span>
          {item.is_below_threshold && (
            <AlertTriangle className="h-3 w-3 flex-shrink-0 text-rose-500" />
          )}
        </div>
        <span className={`text-sm font-semibold ${item.is_below_threshold ? 'text-rose-600' : 'text-gray-700'}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        {item.present_count} / {item.total_classes} classes
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// WIDGET
// ---------------------------------------------------------------
interface AttendanceWidgetProps {
  data:      AttendanceAnalytics | undefined;
  isLoading: boolean;
  error:     string | undefined;
}

export default function AttendanceWidget({
  data,
  isLoading,
  error,
}: AttendanceWidgetProps): JSX.Element {
  const navigate = useNavigate();

  if (isLoading) return <SkeletonCard rows={4} className="h-full" />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mb-2 h-6 w-6 text-red-400" />
        <p className="text-sm font-medium text-red-600">Attendance unavailable</p>
        <p className="mt-1 text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return <SkeletonCard rows={4} />;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Attendance</h3>
        </div>
        {data.is_low_attendance && (
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
            <AlertTriangle className="h-3 w-3" />
            Low
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Circular progress */}
        <div className="flex items-center gap-4">
          <CircularProgress percentage={data.overall_percentage} />
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {data.overall_present}
              <span className="text-base font-normal text-gray-400"> / {data.overall_total}</span>
            </p>
            <p className="text-sm text-gray-500">Classes attended</p>
            {data.is_low_attendance && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                ⚠ Below 75% threshold
              </p>
            )}
          </div>
        </div>

        {/* Subject breakdown */}
        {data.subject_breakdown.length > 0 && (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Subject-wise
            </p>
            {data.subject_breakdown.slice(0, 4).map(item => (
              <SubjectRow key={item.subject} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => navigate('/student/attendance')}
        className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-xs font-medium text-indigo-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        View full attendance <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
