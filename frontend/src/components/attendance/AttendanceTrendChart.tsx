// ============================================================
// components/attendance/AttendanceTrendChart.tsx
// ============================================================
// Weekly attendance area chart using recharts.
// Shows % attendance over the last 12 ISO weeks.
// AreaChart chosen over LineChart for better visual fill — the
// filled area makes the overall trend immediately readable.
// ============================================================

import type { JSX } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { TrendingUp, BookOpen } from 'lucide-react';
import type { WeeklyTrendPoint } from '@/types/attendance';

function CustomTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: Array<{ name: string; value: number; payload: WeeklyTrendPoint }>;
  label?:   string;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg text-xs min-w-[120px]">
      <p className="mb-1.5 font-semibold text-gray-800">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-emerald-600">Attended</span>
          <span className="font-semibold tabular-nums text-emerald-700">{d?.present ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-rose-600">Absent</span>
          <span className="font-semibold tabular-nums text-rose-700">{d?.absent ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-1">
          <span className="text-indigo-600 font-medium">%</span>
          <span className="font-bold tabular-nums text-indigo-700">{d?.percentage ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}

interface AttendanceTrendChartProps {
  data:      WeeklyTrendPoint[];
  isLoading: boolean;
}

export default function AttendanceTrendChart({
  data, isLoading,
}: AttendanceTrendChartProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
          <TrendingUp className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Weekly Trend</h3>
          <p className="text-xs text-gray-400">Attendance % per week (last 12 weeks)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[200px] animate-pulse rounded-xl bg-gray-100" />
      ) : data.length < 2 ? (
        <div className="flex h-[200px] flex-col items-center justify-center text-center">
          <BookOpen className="mb-2 h-8 w-8 text-gray-200" aria-hidden="true" />
          <p className="text-sm text-gray-500">Not enough data yet</p>
          <p className="text-xs text-gray-400">Trend needs at least 2 weeks of records</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ReferenceLine
              y={75}
              stroke="#f59e0b"
              strokeDasharray="5 3"
              label={{ value: '75%', position: 'insideBottomRight', fontSize: 9, fill: '#d97706' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="percentage"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#attendGrad)"
              dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
              name="Attendance %"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
