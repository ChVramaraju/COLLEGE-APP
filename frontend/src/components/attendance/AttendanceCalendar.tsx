// ============================================================
// components/attendance/AttendanceCalendar.tsx
// ============================================================
// Monthly calendar grid showing attendance status per day.
// Week starts on Monday (ISO standard).
//
// COLOUR LOGIC per day cell:
//   green  (present)  — all records that day: no absences
//   amber  (late)     — late records, no absences
//   red    (absent)   — any absence that day
//   gray   (no class) — no attendance records that day
//
// NAVIGATION:
//   Prev / Next month arrows.
//   Defaults to current month, can go back to any past month.
// ============================================================

import { useMemo, type JSX } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarDayData, AttendanceStatus } from '@/types/attendance';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_COLORS: Record<AttendanceStatus | 'none', {
  cell: string; dot: string; text: string;
}> = {
  present: { cell: 'bg-emerald-100 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-900' },
  late:    { cell: 'bg-amber-100   border-amber-200',   dot: 'bg-amber-500',   text: 'text-amber-900'  },
  absent:  { cell: 'bg-rose-100    border-rose-200',    dot: 'bg-rose-500',    text: 'text-rose-900'   },
  excused: { cell: 'bg-blue-100    border-blue-200',    dot: 'bg-blue-500',    text: 'text-blue-900'   },
  none:    { cell: 'bg-gray-50     border-gray-100',    dot: 'bg-gray-300',    text: 'text-gray-400'   },
};

// Returns ISO-Monday-based day index: Mon=0 … Sun=6
function isoWeekdayIndex(date: Date): number {
  const d = date.getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Tooltip: brief summary for a day cell
function DayTooltip({ day }: { day: CalendarDayData }): JSX.Element {
  const periodList = day.records
    .map(r => `P${r.period_number} ${r.subject}: ${r.status}`)
    .slice(0, 4)
    .join('\n');
  return (
    <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-xl text-xs min-w-[140px] whitespace-pre-wrap pointer-events-none">
      <p className="mb-1 font-semibold text-gray-800">{day.date}</p>
      <p className="text-gray-600">{periodList}</p>
      {day.records.length > 4 && (
        <p className="mt-0.5 text-gray-400">+{day.records.length - 4} more</p>
      )}
    </div>
  );
}

interface CalendarCellProps {
  dayNum:    number;
  dayData:   CalendarDayData | undefined;
  isToday:   boolean;
}

function CalendarCell({ dayNum, dayData, isToday }: CalendarCellProps): JSX.Element {
  const dominant = dayData?.dominant ?? 'none';
  const cfg      = DAY_COLORS[dominant];
  const hasData  = !!dayData && dayData.records.length > 0;

  return (
    <div className="group relative">
      <div
        className={`relative flex flex-col items-center justify-start rounded-xl border px-1 py-1.5 transition-all ${cfg.cell} ${
          isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
        } ${hasData ? 'cursor-default' : ''}`}
        style={{ minHeight: '2.4rem' }}
      >
        <span className={`text-xs font-semibold tabular-nums leading-none ${isToday ? 'text-indigo-700' : cfg.text}`}>
          {dayNum}
        </span>
        {hasData && (
          <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
        )}
      </div>

      {/* Tooltip on hover */}
      {hasData && (
        <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <DayTooltip day={dayData!} />
        </div>
      )}
    </div>
  );
}

interface AttendanceCalendarProps {
  calendarMonth:    string;              // "YYYY-MM"
  calendarData:     Map<string, CalendarDayData>;
  onMonthChange:    (m: string) => void;
  isLoading:        boolean;
}

export default function AttendanceCalendar({
  calendarMonth, calendarData, onMonthChange, isLoading,
}: AttendanceCalendarProps): JSX.Element {
  const [yearStr, monthStr] = calendarMonth.split('-');
  const year  = Number(yearStr);
  const month = Number(monthStr) - 1;  // 0-indexed

  const monthLabel = useMemo(
    () => new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    [year, month],
  );

  const totalDays = daysInMonth(year, month);
  const firstDayIdx = isoWeekdayIndex(new Date(year, month, 1)); // 0=Mon
  const todayStr = new Date().toISOString().slice(0, 10);

  // Build grid: leading nulls + day numbers
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayIdx }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete final row
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const today = new Date();
    const maxYM = today.toISOString().slice(0, 7);
    const d = new Date(year, month + 1, 1);
    const ym = d.toISOString().slice(0, 7);
    if (ym <= maxYM) onMonthChange(ym);
  };

  const isNextDisabled = calendarMonth >= new Date().toISOString().slice(0, 7);

  // Stats for this month
  const presentDays = useMemo(() => {
    let p = 0, a = 0, l = 0;
    for (const d of calendarData.values()) {
      if (d.dominant === 'present') p++;
      else if (d.dominant === 'absent') a++;
      else if (d.dominant === 'late') l++;
    }
    return { p, a, l };
  }, [calendarData]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header + navigation */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Monthly Calendar</h3>
          <p className="text-xs text-gray-400">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            disabled={isNextDisabled}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Month mini-stats */}
      <div className="mb-3 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-gray-600">{presentDays.p} days present</span></span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"    /><span className="text-gray-600">{presentDays.a} absent</span></span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"   /><span className="text-gray-600">{presentDays.l} late</span></span>
      </div>

      {isLoading ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <>
          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (cell === null) {
                return <div key={`pad-${idx}`} className="rounded-xl" />;
              }
              const dateStr = `${yearStr}-${monthStr}-${String(cell).padStart(2, '0')}`;
              return (
                <CalendarCell
                  key={dateStr}
                  dayNum={cell}
                  dayData={calendarData.get(dateStr)}
                  isToday={dateStr === todayStr}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {(['present', 'absent', 'late', 'none'] as const).map(s => {
              const labels = { present: 'Present', absent: 'Absent', late: 'Late', none: 'No class' };
              return (
                <span key={s} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${DAY_COLORS[s].dot}`} aria-hidden="true" />
                  {labels[s]}
                </span>
              );
            })}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full ring-2 ring-indigo-400 ring-offset-[1px]" aria-hidden="true" />
              Today
            </span>
          </div>
        </>
      )}
    </div>
  );
}
