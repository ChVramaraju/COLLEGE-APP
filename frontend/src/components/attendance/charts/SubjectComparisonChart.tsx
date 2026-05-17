// ============================================================
// components/attendance/charts/SubjectComparisonChart.tsx
// ============================================================
// Horizontal bar chart: all subjects ranked by attendance %.
//
// CHART CHOICE — WHY HORIZONTAL BAR CHART?
//   Vertical bars work well for TIME series (few categories).
//   Horizontal bars work better for NAMED CATEGORIES (subjects)
//   because:
//   → Subject names are long (15+ chars) — they don't fit on
//     a vertical X axis without rotation hacks.
//   → Horizontal bars let the eye scan labels on the Y axis
//     naturally from top to bottom.
//
// COLOR CODING per bar:
//   ≥ 75% → indigo (safe)
//   < 75% → rose (at risk)
//
// This is done via a custom Cell per bar — Recharts supports
// per-bar coloring via the Cell component.
//
// DATA SHAPE EXPECTED:
//   [{ subject: "Math", percentage: 82, present: 33, total: 40 }, ...]
// ============================================================

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { BarChart3, BookOpen } from 'lucide-react';
import type { SubjectComparisonPoint } from '@/types/attendance';
import type { JSX } from 'react';

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: SubjectComparisonPoint }>;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-semibold text-gray-800">{d.subject}</p>
      <p className="text-gray-600">{d.present} / {d.total} classes</p>
      <p className={`mt-1 font-bold ${d.isBelowThreshold ? 'text-rose-600' : 'text-indigo-600'}`}>
        {d.percentage}%
      </p>
      {d.isBelowThreshold && (
        <p className="text-rose-500 mt-0.5">⚠ Below 75% threshold</p>
      )}
    </div>
  );
}

interface SubjectComparisonChartProps {
  data:      SubjectComparisonPoint[];
  isLoading: boolean;
}

export default function SubjectComparisonChart({ data, isLoading }: SubjectComparisonChartProps): JSX.Element {
  // Dynamic height: 50px per subject + 40px padding
  const chartHeight = Math.max(200, data.length * 50 + 40);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
          <BarChart3 className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Subject Comparison</h3>
          <p className="text-xs text-gray-400">Attendance % per subject, sorted by performance</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[220px] animate-pulse rounded-lg bg-gray-100" />
      ) : data.length === 0 ? (
        <div className="flex h-[220px] flex-col items-center justify-center text-center">
          <BookOpen className="mb-2 h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-500">No subject data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, bottom: 0, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="subject"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            {/* 75% threshold line */}
            <ReferenceLine
              x={75}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: '75%', position: 'top', fontSize: 10, fill: '#f59e0b' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isBelowThreshold ? '#fda4af' : '#818cf8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-400" />
            Safe (≥75%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-300" />
            At Risk (&lt;75%)
          </span>
        </div>
      )}
    </div>
  );
}
