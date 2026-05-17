// ============================================================
// components/attendance/charts/MonthlyTrendChart.tsx
// ============================================================
// Line chart: attendance % over calendar months.
//
// CHART CHOICE — WHY LINE CHART?
//   A line chart is the right choice when:
//   → The X axis is TIME (months, weeks, days)
//   → The Y axis is a CONTINUOUS measurement (percentage)
//   → You want to show TRAJECTORY — are things getting better?
//
//   Bar charts are better for: comparing CATEGORIES at one point.
//   Line charts are better for: showing CHANGE over time.
//   This is why stock apps use lines, not bars.
//
// RECHARTS KEY CONCEPTS:
//   ResponsiveContainer → makes chart fill parent width automatically
//   LineChart data=[]   → the array of data points
//   XAxis dataKey       → which field in each object is the X label
//   Line dataKey        → which field is plotted on Y axis
//   Tooltip             → popup on hover (built-in, we customize)
//   ReferenceLine       → draws the 75% threshold line
//
// DATA SHAPE EXPECTED:
//   [{ month: "Jan '25", percentage: 85.2, present: 17, absent: 3 }, ...]
// ============================================================

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { TrendingUp, BookOpen } from 'lucide-react';
import type { MonthlyTrendPoint } from '@/types/attendance';
import type { JSX } from 'react';

// ---------------------------------------------------------------
// CUSTOM TOOLTIP
// Recharts renders its own tooltip by default (functional but ugly).
// Replacing it with a custom component gives full control over
// styling — matches the rest of the dashboard.
//
// The payload prop from Recharts contains:
//   payload[0].value → the percentage
//   payload[0].payload → the full data point object
// ---------------------------------------------------------------
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: MonthlyTrendPoint }>;
  label?: string;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1.5 font-semibold text-gray-800">{label}</p>
      <p className="text-emerald-600">Present: {d.present}</p>
      <p className="text-rose-600">Absent: {d.absent}</p>
      <p className="mt-1 font-bold text-indigo-600">{d.percentage}%</p>
    </div>
  );
}

interface MonthlyTrendChartProps {
  data:      MonthlyTrendPoint[];
  isLoading: boolean;
}

export default function MonthlyTrendChart({ data, isLoading }: MonthlyTrendChartProps): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
          <TrendingUp className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Monthly Attendance Trend</h3>
          <p className="text-xs text-gray-400">% attendance per month this academic year</p>
        </div>
      </div>

      {/* Chart or empty state */}
      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center animate-pulse">
          <div className="h-full w-full rounded-lg bg-gray-100" />
        </div>
      ) : data.length < 2 ? (
        <div className="flex h-[220px] flex-col items-center justify-center text-center">
          <BookOpen className="mb-2 h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-500">Not enough data</p>
          <p className="text-xs text-gray-400">Trend chart needs at least 2 months of records</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            {/* 75% threshold reference line */}
            <ReferenceLine
              y={75}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: '75%', position: 'right', fontSize: 10, fill: '#f59e0b' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value: string) => value === 'percentage' ? 'Attendance %' : value}
            />
            <Line
              type="monotone"
              dataKey="percentage"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#6366f1' }}
              name="percentage"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
