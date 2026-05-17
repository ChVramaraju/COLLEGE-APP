// ============================================================
// components/attendance/cards/AttendanceSummaryBanner.tsx
// ============================================================
// The "hero" section at the top of the attendance page.
// Shows: overall %, attended/total, absent count, risk status.
//
// The large circular SVG arc visualizes the attendance percentage
// at a glance — users don't need to read a number to understand
// whether they're safe or at risk. Color = instant signal.
//
// COLOR CODING:
//   ≥ 75% → green  (safe zone)
//   60–74% → amber  (warning zone)
//   < 60%  → red    (danger zone)
//
// This matches the institution's 75% minimum attendance policy
// which is enforced by the backend's is_low_attendance flag.
// ============================================================

import { AlertTriangle, CheckCircle2, TrendingUp, RefreshCw } from 'lucide-react';
import type { AttendanceAnalytics } from '@/types/attendance';
import type { JSX } from 'react';

// SVG ring progress — same technique as the dashboard widget
// but LARGER (120px) for the hero position
function RingProgress({ percentage }: { percentage: number }): JSX.Element {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percentage, 100) / 100);
  const color =
    percentage >= 75 ? '#10b981'
    : percentage >= 60 ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="130" height="130" className="-rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-gray-900">{percentage.toFixed(1)}%</p>
        <p className="text-xs text-gray-400">overall</p>
      </div>
    </div>
  );
}

interface AttendanceSummaryBannerProps {
  analytics:  AttendanceAnalytics | null;
  isLoading:  boolean;
  error:      string | null;
  onRefetch:  () => void;
}

export default function AttendanceSummaryBanner({
  analytics,
  isLoading,
  error,
  onRefetch,
}: AttendanceSummaryBannerProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex gap-6 items-center">
          <div className="h-[130px] w-[130px] rounded-full bg-gray-200 flex-shrink-0" />
          <div className="space-y-3 flex-1">
            <div className="h-5 w-48 rounded bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-gray-200" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <div>
            <p className="font-medium text-red-700">Failed to load analytics</p>
            <p className="text-sm text-red-500">{error ?? 'Unknown error'}</p>
          </div>
        </div>
        <button onClick={onRefetch} className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const absent  = analytics.overall_total - analytics.overall_present;
  const pct     = analytics.overall_percentage;
  const safe    = pct >= 75;

  // Classes needed to reach 75% (if below)
  // Formula: (75 * total - 100 * present) / (100 - 75) = (3*total - 4*present)
  const classesNeeded = !safe
    ? Math.ceil((75 * analytics.overall_total - 100 * analytics.overall_present) / 25)
    : 0;

  return (
    <div className={`rounded-2xl border shadow-sm p-6 ${
      safe ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50/40'
    }`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Ring + percentage */}
        <div className="flex-shrink-0">
          <RingProgress percentage={pct} />
        </div>

        {/* Stats */}
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            {safe
              ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700">Attendance Safe Zone</span></>
              : <><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="text-sm font-medium text-amber-700">Below 75% Threshold</span></>
            }
            <button
              onClick={onRefetch}
              className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">{analytics.overall_present}</p>
              <p className="text-xs text-emerald-600">Present</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-center">
              <p className="text-xl font-bold text-rose-700">{absent}</p>
              <p className="text-xs text-rose-600">Absent</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{analytics.overall_total}</p>
              <p className="text-xs text-indigo-600">Total</p>
            </div>
          </div>

          {!safe && classesNeeded > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2">
              <TrendingUp className="h-4 w-4 flex-shrink-0 text-amber-700" />
              <p className="text-xs font-medium text-amber-800">
                Attend <span className="font-bold">{classesNeeded} more consecutive classes</span> to reach 75%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
