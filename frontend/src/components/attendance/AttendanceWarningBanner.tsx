// ============================================================
// components/attendance/AttendanceWarningBanner.tsx
// ============================================================
// Shown only when attendance < 75%.
// Explains exactly how many more classes are needed and why.
// Two severity levels: warning (65–75%) and critical (< 65%).
// ============================================================

import type { JSX } from 'react';
import { AlertTriangle, TrendingUp, XOctagon } from 'lucide-react';
import type { HealthBadge, OverallStats } from '@/types/attendance';

interface AttendanceWarningBannerProps {
  stats:         OverallStats;
  badge:         HealthBadge;
  classesNeeded: number;
}

export default function AttendanceWarningBanner({
  stats, badge, classesNeeded,
}: AttendanceWarningBannerProps): JSX.Element | null {
  if (badge === 'excellent' || badge === 'safe') return null;

  const isCritical = badge === 'critical';

  return (
    <div
      role="alert"
      className={`rounded-2xl border px-5 py-4 shadow-sm ${
        isCritical
          ? 'border-rose-300 bg-rose-50'
          : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        {/* Icon */}
        <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
          isCritical ? 'bg-rose-100' : 'bg-amber-100'
        }`}>
          {isCritical
            ? <XOctagon     className="h-5 w-5 text-rose-600"  aria-hidden="true" />
            : <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isCritical ? 'text-rose-900' : 'text-amber-900'}`}>
            {isCritical
              ? `Critical: Your attendance is ${stats.percentage.toFixed(1)}% — well below the 75% minimum`
              : `Warning: Your attendance is ${stats.percentage.toFixed(1)}% — below the 75% threshold`
            }
          </p>

          {classesNeeded > 0 && (
            <div className="mt-2 space-y-1.5">
              {/* Main action */}
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                isCritical ? 'bg-rose-100' : 'bg-amber-100'
              }`}>
                <TrendingUp className={`h-4 w-4 flex-shrink-0 ${isCritical ? 'text-rose-700' : 'text-amber-700'}`} aria-hidden="true" />
                <p className={`text-sm font-semibold ${isCritical ? 'text-rose-800' : 'text-amber-800'}`}>
                  Attend{' '}
                  <span className="underline decoration-dotted">{classesNeeded} consecutive class{classesNeeded !== 1 ? 'es' : ''}</span>
                  {' '}without any absence to reach 75%
                </p>
              </div>

              {/* Formula explanation */}
              <p className={`text-xs ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>
                How calculated: You attended{' '}
                <span className="font-semibold">{stats.presentAndLate}</span> of{' '}
                <span className="font-semibold">{stats.total}</span> classes.
                {' '}Need (present + x) / (total + x) ≥ 75% →
                {' '}x = ⌈(3 × {stats.total} − 4 × {stats.presentAndLate})⌉ ={' '}
                <span className="font-bold">{classesNeeded}</span>
              </p>
            </div>
          )}
        </div>

        {/* Right stat pill */}
        <div className={`flex-shrink-0 rounded-xl px-3 py-2 text-center ${
          isCritical ? 'bg-rose-100' : 'bg-amber-100'
        }`}>
          <p className={`text-xl font-extrabold tabular-nums ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
            {stats.percentage.toFixed(1)}%
          </p>
          <p className={`text-xs font-medium ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>
            current
          </p>
        </div>
      </div>
    </div>
  );
}
