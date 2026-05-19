// ============================================================
// components/attendance/AttendanceSummaryCard.tsx
// ============================================================
// Hero card at the top of the student dashboard.
// Large animated ring + health badge + 5-stat breakdown.
// ============================================================

import type { JSX } from 'react';
import type { OverallStats, HealthBadge } from '@/types/attendance';

const HEALTH_CONFIG: Record<HealthBadge, {
  label: string; badgeBg: string; badgeText: string; ringColor: string; cardBorder: string; cardBg: string;
}> = {
  excellent: { label: 'Excellent',  badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-800', ringColor: '#10b981', cardBorder: 'border-emerald-200', cardBg: 'bg-emerald-50/30' },
  safe:      { label: 'Safe',       badgeBg: 'bg-green-100',   badgeText: 'text-green-800',   ringColor: '#22c55e', cardBorder: 'border-green-200',   cardBg: 'bg-white'          },
  warning:   { label: 'Warning',    badgeBg: 'bg-amber-100',   badgeText: 'text-amber-800',   ringColor: '#f59e0b', cardBorder: 'border-amber-200',   cardBg: 'bg-amber-50/30'    },
  critical:  { label: 'Critical',   badgeBg: 'bg-rose-100',    badgeText: 'text-rose-800',    ringColor: '#ef4444', cardBorder: 'border-rose-200',    cardBg: 'bg-rose-50/30'     },
};

function RingChart({ percentage, color }: { percentage: number; color: string }): JSX.Element {
  const r    = 58;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percentage, 100) / 100);
  return (
    <div className="relative flex items-center justify-center">
      <svg width="144" height="144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#f3f4f6" strokeWidth="11" />
        <circle
          cx="72" cy="72" r={r}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-extrabold tabular-nums text-gray-900">
          {percentage.toFixed(1)}
          <span className="text-lg font-semibold text-gray-400">%</span>
        </p>
        <p className="text-xs font-medium text-gray-400 tracking-wide">overall</p>
      </div>
    </div>
  );
}

function StatTile({
  label, value, bg, text,
}: { label: string; value: number; bg: string; text: string }): JSX.Element {
  return (
    <div className={`rounded-xl px-3 py-2.5 text-center ${bg}`}>
      <p className={`text-lg font-bold tabular-nums ${text}`}>{value}</p>
      <p className={`text-xs font-medium ${text} opacity-80`}>{label}</p>
    </div>
  );
}

interface AttendanceSummaryCardProps {
  stats:     OverallStats;
  badge:     HealthBadge;
  isLoading: boolean;
}

export default function AttendanceSummaryCard({
  stats, badge, isLoading,
}: AttendanceSummaryCardProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="h-[144px] w-[144px] flex-shrink-0 rounded-full bg-gray-200" />
          <div className="w-full space-y-3">
            <div className="h-5 w-24 rounded bg-gray-200" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cfg = HEALTH_CONFIG[badge];

  return (
    <div className={`rounded-2xl border shadow-sm p-6 transition-colors ${cfg.cardBorder} ${cfg.cardBg}`}>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        {/* Ring */}
        <div className="flex-shrink-0">
          <RingChart percentage={stats.percentage} color={cfg.ringColor} />
        </div>

        {/* Right side */}
        <div className="flex-1 w-full">
          {/* Badge */}
          <div className="mb-4 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cfg.badgeBg} ${cfg.badgeText}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.ringColor }} />
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400">attendance health</span>
          </div>

          {/* 5-stat grid */}
          <div className="grid grid-cols-5 gap-2">
            <StatTile label="Total"   value={stats.total}   bg="bg-gray-50"      text="text-gray-700" />
            <StatTile label="Present" value={stats.present} bg="bg-emerald-50"   text="text-emerald-700" />
            <StatTile label="Absent"  value={stats.absent}  bg="bg-rose-50"      text="text-rose-700" />
            <StatTile label="Late"    value={stats.late}    bg="bg-amber-50"     text="text-amber-700" />
            <StatTile label="Excused" value={stats.excused} bg="bg-blue-50"      text="text-blue-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
