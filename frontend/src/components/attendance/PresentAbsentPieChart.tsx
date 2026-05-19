// ============================================================
// components/attendance/PresentAbsentPieChart.tsx
// ============================================================
// Donut pie chart: Present / Absent / Late / Excused breakdown.
// Shows absolute count AND % in the centre on hover.
// ============================================================

import { useState, type JSX } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { AttendancePiePoint } from '@/types/attendance';

function CustomTooltip({ active, payload }: {
  active?:  boolean;
  payload?: Array<{ name: string; value: number; payload: AttendancePiePoint }>;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.payload.color }} />
        <span className="font-semibold text-gray-800">{d.name}</span>
        <span className="font-bold tabular-nums text-gray-700 ml-1">{d.value}</span>
      </div>
    </div>
  );
}

interface PresentAbsentPieChartProps {
  data:      AttendancePiePoint[];
  total:     number;
  isLoading: boolean;
}

export default function PresentAbsentPieChart({
  data, total, isLoading,
}: PresentAbsentPieChartProps): JSX.Element {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeSlice = activeIndex !== null ? data[activeIndex] : null;
  const centerValue = activeSlice
    ? `${Math.round((activeSlice.value / total) * 100)}%`
    : total > 0 ? `${total}` : '0';
  const centerLabel = activeSlice ? activeSlice.name : 'Total';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
          <BarChart3 className="h-4 w-4 text-purple-600" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Attendance Breakdown</h3>
          <p className="text-xs text-gray-400">Hover a slice for details</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[180px] items-center justify-center animate-pulse">
          <div className="h-[140px] w-[140px] rounded-full bg-gray-200" />
        </div>
      ) : total === 0 ? (
        <div className="flex h-[180px] flex-col items-center justify-center text-center text-gray-400">
          <BarChart3 className="mb-2 h-8 w-8 opacity-25" aria-hidden="true" />
          <p className="text-sm">No records yet</p>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-4">
          {/* Donut chart */}
          <div className="relative w-full" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  stroke="none"
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === idx ? 1 : 0.5}
                      style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Centre label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-xl font-extrabold tabular-nums text-gray-900">{centerValue}</p>
              <p className="text-xs font-medium text-gray-400">{centerLabel}</p>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-gray-600">{d.name}</span>
                <span className="ml-auto font-semibold tabular-nums text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
