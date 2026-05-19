// ============================================================
// components/placement/PlacementAnalyticsCards.tsx
// ============================================================
// Admin analytics summary row + funnel breakdown.
// ============================================================

import type { JSX } from 'react';
import {
  Briefcase, Users, TrendingUp, Award, IndianRupee,
  CheckCircle2, Clock, XCircle, Star,
} from 'lucide-react';
import type { PlacementAnalytics } from '@/types/placement';

function StatCard({
  icon: Icon, iconBg, iconColor, label, value, sub,
}: {
  icon: typeof Briefcase; iconBg: string; iconColor: string;
  label: string; value: string | number; sub?: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function FunnelBar({
  label, count, total, color, iconColor, icon: Icon,
}: {
  label: string; count: number; total: number; color: string;
  iconColor: string; icon: typeof CheckCircle2;
}): JSX.Element {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`flex items-center gap-1 font-medium ${iconColor}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </span>
        <span className="font-bold tabular-nums text-gray-800">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface Props { analytics: PlacementAnalytics; isLoading: boolean }

export default function PlacementAnalyticsCards({ analytics, isLoading }: Props): JSX.Element {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
    );
  }

  const f = analytics.funnel;
  const totalInFunnel = f.total_applied + f.under_review + f.shortlisted + f.selected + f.rejected + f.withdrawn;

  return (
    <div className="space-y-6">
      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Briefcase}    iconBg="bg-indigo-50"  iconColor="text-indigo-600"  label="Total Jobs"      value={analytics.total_job_postings} />
        <StatCard icon={TrendingUp}   iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Active Postings"  value={analytics.active_postings} />
        <StatCard icon={Users}        iconBg="bg-blue-50"    iconColor="text-blue-600"    label="Applications"     value={analytics.total_applications} />
        <StatCard icon={Award}        iconBg="bg-purple-50"  iconColor="text-purple-600"  label="Students Placed"  value={analytics.total_placed_students} />
        <StatCard icon={CheckCircle2} iconBg="bg-rose-50"    iconColor="text-rose-600"    label="Placement Rate"   value={`${analytics.overall_placement_rate}%`} />
        <StatCard
          icon={IndianRupee} iconBg="bg-amber-50" iconColor="text-amber-600"
          label="Avg Package"
          value={analytics.avg_package_lpa != null ? `₹${analytics.avg_package_lpa} LPA` : '—'}
          sub={analytics.highest_package_lpa != null ? `Max: ₹${analytics.highest_package_lpa} LPA` : undefined}
        />
      </div>

      {/* Funnel + Top companies */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Application funnel */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Application Funnel</h3>
          <div className="space-y-3">
            <FunnelBar label="Applied"     count={f.total_applied} total={totalInFunnel} color="bg-blue-500"    iconColor="text-blue-600"    icon={Users}        />
            <FunnelBar label="In Review"   count={f.under_review}  total={totalInFunnel} color="bg-amber-400"   iconColor="text-amber-600"   icon={Clock}        />
            <FunnelBar label="Shortlisted" count={f.shortlisted}   total={totalInFunnel} color="bg-purple-500"  iconColor="text-purple-600"  icon={Star}         />
            <FunnelBar label="Selected"    count={f.selected}      total={totalInFunnel} color="bg-emerald-500" iconColor="text-emerald-700" icon={CheckCircle2} />
            <FunnelBar label="Rejected"    count={f.rejected}      total={totalInFunnel} color="bg-rose-400"    iconColor="text-rose-600"    icon={XCircle}      />
          </div>
        </div>

        {/* Top companies */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Top Companies</h3>
          {analytics.top_companies.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics.top_companies.slice(0, 5).map(c => (
                <div key={c.company_name} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{c.company_name}</p>
                    <p className="text-xs text-gray-400">{c.total_applications} applied · {c.total_openings} openings</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {c.students_placed} placed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
