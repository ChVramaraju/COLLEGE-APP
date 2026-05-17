// ============================================================
// components/dashboard/stats/StatCard.tsx — Reusable Metric Card
// ============================================================
// The most reused component in any ERP dashboard.
//
// A StatCard displays ONE metric with:
//   - An icon in a colored badge
//   - A large number/value
//   - A label (what the number means)
//   - An optional subtitle (context)
//   - An optional trend/badge indicator
//
// WHY make this a generic component instead of hardcoding?
//   The student dashboard has 4+ stat cards.
//   The admin dashboard has 6+.
//   The faculty dashboard has 4+.
//   If all cards are hardcoded, changing the card style means
//   touching 14 files. With ONE StatCard component, it's 1 file.
//   This is the core principle of component design systems.
//
// USAGE:
//   <StatCard
//     label="Attendance"
//     value="84.5%"
//     subtitle="Overall"
//     Icon={CalendarCheck}
//     colorScheme="green"
//     badge={{ text: "Good", variant: "success" }}
//   />
// ============================================================

import type { LucideIcon } from 'lucide-react';
import type { JSX } from 'react';

// ---------------------------------------------------------------
// COLOR SCHEMES — maps a name to tailwind classes
// ---------------------------------------------------------------
const colorSchemes = {
  indigo: { icon: 'text-indigo-600', bg: 'bg-indigo-50' },
  green:  { icon: 'text-emerald-600', bg: 'bg-emerald-50' },
  amber:  { icon: 'text-amber-600',   bg: 'bg-amber-50'   },
  red:    { icon: 'text-rose-600',     bg: 'bg-rose-50'    },
  blue:   { icon: 'text-blue-600',     bg: 'bg-blue-50'    },
  purple: { icon: 'text-purple-600',   bg: 'bg-purple-50'  },
} as const;

type ColorScheme = keyof typeof colorSchemes;

// ---------------------------------------------------------------
// BADGE VARIANTS — small inline status indicators
// ---------------------------------------------------------------
const badgeVariants = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100   text-amber-700',
  danger:  'bg-rose-100    text-rose-700',
  info:    'bg-blue-100    text-blue-700',
  neutral: 'bg-gray-100    text-gray-600',
} as const;

type BadgeVariant = keyof typeof badgeVariants;

interface StatCardProps {
  label:       string;
  value:       string | number;
  subtitle?:   string;
  Icon:        LucideIcon;
  colorScheme?: ColorScheme;
  badge?:      { text: string; variant: BadgeVariant };
  onClick?:    () => void;
}

export default function StatCard({
  label,
  value,
  subtitle,
  Icon,
  colorScheme = 'indigo',
  badge,
  onClick,
}: StatCardProps): JSX.Element {
  const scheme = colorSchemes[colorScheme];

  return (
    <div
      className={`
        rounded-xl border border-gray-200 bg-white p-5 shadow-sm
        ${onClick ? 'cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all' : ''}
      `}
      onClick={onClick}
    >
      {/* Icon + badge row */}
      <div className="mb-3 flex items-center justify-between">
        <div className={`inline-flex rounded-lg p-2.5 ${scheme.bg}`}>
          <Icon className={`h-5 w-5 ${scheme.icon}`} />
        </div>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeVariants[badge.variant]}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Value */}
      <p className="text-2xl font-bold text-gray-900 leading-none">
        {value}
      </p>

      {/* Label */}
      <p className="mt-1 text-sm font-medium text-gray-700">{label}</p>

      {/* Subtitle */}
      {subtitle && (
        <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}
