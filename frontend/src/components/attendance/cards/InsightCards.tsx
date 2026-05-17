// ============================================================
// components/attendance/cards/InsightCards.tsx
// ============================================================
// Four quick insight stat cards shown below the summary banner.
//
// WHY "insight cards" instead of just showing raw data?
//   Raw data: "Mathematics: 82%, Physics: 91%, Chemistry: 68%..."
//   Insight: "Your weakest subject is Chemistry — only 68%"
//
//   Humans process conclusions faster than raw lists.
//   Insight cards pre-compute the "so what?" for the student.
//   This is a core UX principle: "don't make me think."
//   (Same reason fitness apps show "You walked 112% of your goal"
//    instead of "You walked 8,943 steps out of 8,000".)
// ============================================================

import type { ComponentType } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle, Minus } from 'lucide-react';
import type { AttendanceInsights } from '@/types/attendance';
import type { JSX } from 'react';

interface InsightCardProps {
  label:    string;
  value:    string;
  sub?:     string;
  Icon:     ComponentType<{ className?: string }>;
  iconBg:   string;
  iconColor: string;
}

function InsightCard({ label, value, sub, Icon, iconBg, iconColor }: InsightCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: iconBg }}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

interface InsightCardsProps {
  insights:   AttendanceInsights;
  isLoading:  boolean;
}

export default function InsightCards({ insights, isLoading }: InsightCardsProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-pulse">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 h-8 w-8 rounded-lg bg-gray-200" />
            <div className="mb-1 h-5 w-20 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  const trendIcon =
    insights.trend === 'improving'  ? TrendingUp   :
    insights.trend === 'declining'  ? TrendingDown  :
    Minus;
  const trendColor =
    insights.trend === 'improving'  ? 'text-emerald-600' :
    insights.trend === 'declining'  ? 'text-rose-600'    :
    'text-gray-500';
  const trendBg =
    insights.trend === 'improving'  ? '#ecfdf5' :
    insights.trend === 'declining'  ? '#fff1f2' :
    '#f9fafb';
  const trendLabel =
    insights.trend === 'improving'  ? `+${insights.trendDelta}% this month` :
    insights.trend === 'declining'  ? `${insights.trendDelta}% this month`  :
    insights.trend === 'stable'     ? 'Stable' :
    'Not enough data';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <InsightCard
        label="Best Subject"
        value={insights.bestSubject?.name ?? '—'}
        sub={insights.bestSubject ? `${insights.bestSubject.percentage.toFixed(1)}%` : undefined}
        Icon={Award}
        iconBg="#ecfdf5"
        iconColor="text-emerald-600"
      />
      <InsightCard
        label="Needs Attention"
        value={insights.worstSubject?.name ?? '—'}
        sub={insights.worstSubject ? `${insights.worstSubject.percentage.toFixed(1)}%` : undefined}
        Icon={AlertTriangle}
        iconBg={insights.worstSubject && insights.worstSubject.percentage < 75 ? '#fff1f2' : '#fefce8'}
        iconColor={insights.worstSubject && insights.worstSubject.percentage < 75 ? 'text-rose-600' : 'text-amber-600'}
      />
      <InsightCard
        label="At Risk Subjects"
        value={String(insights.subjectsAtRisk)}
        sub={insights.subjectsAtRisk === 0 ? 'All safe' : 'below 75%'}
        Icon={AlertTriangle}
        iconBg={insights.subjectsAtRisk > 0 ? '#fff1f2' : '#ecfdf5'}
        iconColor={insights.subjectsAtRisk > 0 ? 'text-rose-600' : 'text-emerald-600'}
      />
      <InsightCard
        label="Trend"
        value={insights.trend === 'insufficient_data' ? '—' :
               insights.trend.charAt(0).toUpperCase() + insights.trend.slice(1)}
        sub={trendLabel}
        Icon={trendIcon}
        iconBg={trendBg}
        iconColor={trendColor}
      />
    </div>
  );
}
