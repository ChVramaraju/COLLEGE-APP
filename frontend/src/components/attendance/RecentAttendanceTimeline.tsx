// ============================================================
// components/attendance/RecentAttendanceTimeline.tsx
// ============================================================
// Vertical timeline of the 12 most recent attendance records.
// Each entry: status icon + subject + date + period badge.
// Ordered newest-first (pre-sorted by the hook).
// ============================================================

import type { JSX } from 'react';
import { CheckCircle2, XCircle, Clock, BookOpen, Shield, Calendar } from 'lucide-react';
import type { AttendanceRecord, AttendanceStatus } from '@/types/attendance';

const STATUS_CFG: Record<AttendanceStatus, {
  Icon:  typeof CheckCircle2;
  iconColor: string;
  dotColor:  string;
  label:     string;
  pillBg:    string;
  pillText:  string;
}> = {
  present: { Icon: CheckCircle2, iconColor: 'text-emerald-500', dotColor: 'bg-emerald-500', label: 'Present', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700' },
  absent:  { Icon: XCircle,      iconColor: 'text-rose-500',    dotColor: 'bg-rose-500',    label: 'Absent',  pillBg: 'bg-rose-50',    pillText: 'text-rose-700'   },
  late:    { Icon: Clock,        iconColor: 'text-amber-500',   dotColor: 'bg-amber-500',   label: 'Late',    pillBg: 'bg-amber-50',   pillText: 'text-amber-700'  },
  excused: { Icon: Shield,       iconColor: 'text-blue-500',    dotColor: 'bg-blue-500',    label: 'Excused', pillBg: 'bg-blue-50',    pillText: 'text-blue-700'   },
};

function formatRelativeDate(dateStr: string): string {
  const date  = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs   = today.getTime() - date.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface RecentAttendanceTimelineProps {
  records:   AttendanceRecord[];
  isLoading: boolean;
}

export default function RecentAttendanceTimeline({
  records, isLoading,
}: RecentAttendanceTimelineProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
          <Calendar className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Recent Attendance</h3>
          <p className="text-xs text-gray-400">Latest 12 records</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-200" />
              </div>
              <div className="h-5 w-14 rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <BookOpen className="h-8 w-8 text-gray-200" aria-hidden="true" />
          <p className="text-sm text-gray-400">No attendance records yet.</p>
        </div>
      ) : (
        <ol className="relative space-y-0">
          {records.map((r, idx) => {
            const cfg = STATUS_CFG[r.status];
            const { Icon } = cfg;
            const isLast = idx === records.length - 1;
            return (
              <li key={r.id} className="relative flex items-start gap-3 pb-4">
                {/* Vertical line */}
                {!isLast && (
                  <div
                    className="absolute left-[9px] top-5 w-px bg-gray-200"
                    style={{ bottom: 0 }}
                    aria-hidden="true"
                  />
                )}

                {/* Status icon */}
                <div className="relative z-10 flex-shrink-0 mt-0.5">
                  <Icon className={`h-5 w-5 ${cfg.iconColor}`} aria-hidden="true" />
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-0.5 min-w-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{r.subject}</p>
                    <p className="text-xs text-gray-400">
                      {formatRelativeDate(r.attendance_date)}
                      {' · '}Period {r.period_number}
                      {r.remarks && (
                        <span className="ml-1 italic text-gray-400">"{r.remarks}"</span>
                      )}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.pillBg} ${cfg.pillText}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} aria-hidden="true" />
                    {cfg.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
