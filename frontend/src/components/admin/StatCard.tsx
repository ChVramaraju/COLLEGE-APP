// ============================================================
// components/admin/StatCard.tsx — Animated Metric Card
// ============================================================

import type { ComponentType, JSX } from 'react';
import type { LucideIcon } from 'lucide-react';

type CardColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue' | 'cyan' | 'slate';

const colorMap: Record<CardColor, { bg: string; icon: string; text: string; border: string }> = {
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  text: 'text-indigo-700',  border: 'border-indigo-100'  },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700', border: 'border-emerald-100' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   text: 'text-amber-700',   border: 'border-amber-100'   },
  rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600',    text: 'text-rose-700',    border: 'border-rose-100'    },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  text: 'text-purple-700',  border: 'border-purple-100'  },
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    text: 'text-blue-700',    border: 'border-blue-100'    },
  cyan:    { bg: 'bg-cyan-50',    icon: 'text-cyan-600',    text: 'text-cyan-700',    border: 'border-cyan-100'    },
  slate:   { bg: 'bg-slate-50',   icon: 'text-slate-600',   text: 'text-slate-700',   border: 'border-slate-100'   },
};

interface StatCardProps {
  title:    string;
  value:    string | number;
  sub?:     string;
  Icon:     LucideIcon | ComponentType<{ className?: string }>;
  color?:   CardColor;
  loading?: boolean;
}

export function StatCard({ title, value, sub, Icon, color = 'indigo', loading = false }: StatCardProps): JSX.Element {
  const c = colorMap[color];
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
        <div className="mb-2 h-8 w-20 animate-pulse rounded bg-gray-100" />
        <div className="mb-1 h-4 w-28 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border ${c.border} bg-white p-5 shadow-sm transition-shadow hover:shadow-md`}>
      <div className={`mb-4 inline-flex rounded-xl p-2.5 ${c.bg}`}>
        <Icon className={`h-5 w-5 ${c.icon}`} aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className={`mt-0.5 text-sm font-semibold ${c.text}`}>{title}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default StatCard;
