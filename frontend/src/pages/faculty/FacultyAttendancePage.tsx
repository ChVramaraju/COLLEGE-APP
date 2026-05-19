// ============================================================
// pages/faculty/FacultyAttendancePage.tsx
// ============================================================
// Attendance dashboard for faculty — overview + quick actions.
//
// LAYOUT:
//   Header
//   Two action cards: Mark New / View History
//   Recent sessions table (last 5 from history)
//   Low-attendance alert banner per section
// ============================================================

import { useState, useEffect, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, PlusCircle, ClipboardList, AlertTriangle,
  CheckCircle2, XCircle, Clock, Loader2, ArrowRight, Users,
} from 'lucide-react';

import {
  getFacultyAttendanceHistory,
} from '@/services/attendanceService';
import type { AttendanceSessionSummary } from '@/types/attendance';

const CARD = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';

export default function FacultyAttendancePage(): JSX.Element {
  const navigate = useNavigate();

  const [history,   setHistory]   = useState<AttendanceSessionSummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFacultyAttendanceHistory()
      .then(data => { if (!cancelled) setHistory(data); })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const recent = history.slice(0, 5);

  // Derive total stats
  const totalSessions = history.length;
  const totalStudents = history.reduce((acc, s) => acc + s.total, 0);
  const avgPresent = totalStudents > 0
    ? Math.round(history.reduce((acc, s) => acc + s.present, 0) / totalStudents * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Mark and manage class attendance for your sections
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/faculty/attendance/mark')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Mark Attendance
        </button>
      </div>

      {/* ── Quick Action Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActionCard
          icon={<PlusCircle className="h-6 w-6 text-indigo-600" />}
          title="Mark New Attendance"
          description="Record today's class attendance for a section, subject, and period."
          cta="Start Marking"
          onClick={() => navigate('/faculty/attendance/mark')}
          accent="indigo"
        />
        <ActionCard
          icon={<ClipboardList className="h-6 w-6 text-emerald-600" />}
          title="View History & Edit"
          description="Review past sessions, correct mistakes, and export data."
          cta="Open History"
          onClick={() => navigate('/faculty/attendance/history')}
          accent="emerald"
        />
      </div>

      {/* ── Summary stats row ────────────────────────────────── */}
      {!loading && !loadError && history.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatPill label="Total Sessions" value={totalSessions} color="indigo" />
          <StatPill label="Students Marked" value={totalStudents} color="gray" />
          <StatPill label="Avg. Present %" value={`${avgPresent}%`} color="emerald" />
        </div>
      )}

      {/* ── Recent Sessions ──────────────────────────────────── */}
      <div className={CARD}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent Sessions</h2>
          {history.length > 5 && (
            <button
              onClick={() => navigate('/faculty/attendance/history')}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {loadError}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
            <CalendarCheck className="h-10 w-10 opacity-30" />
            <p className="text-sm">No sessions marked yet.</p>
            <button
              onClick={() => navigate('/faculty/attendance/mark')}
              className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              Mark your first session →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-left">Subject</th>
                  <th className="pb-2 text-left hidden sm:table-cell">Section</th>
                  <th className="pb-2 text-center hidden sm:table-cell">Period</th>
                  <th className="pb-2 text-center">Present</th>
                  <th className="pb-2 text-center">Absent</th>
                  <th className="pb-2 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((s, i) => (
                  <SessionRow key={i} session={s} onEdit={() =>
                    navigate(`/faculty/attendance/edit?sectionId=${s.section_id}&date=${s.attendance_date}&subject=${encodeURIComponent(s.subject)}&period=${s.period_number}`)
                  } />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────

function ActionCard({
  icon, title, description, cta, onClick, accent,
}: {
  icon:        JSX.Element;
  title:       string;
  description: string;
  cta:         string;
  onClick:     () => void;
  accent:      'indigo' | 'emerald';
}): JSX.Element {
  const accentCls = accent === 'indigo'
    ? 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100'
    : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100';
  const btnCls = accent === 'indigo'
    ? 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-400'
    : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400';

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border p-5 transition-colors ${accentCls}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${btnCls}`}
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatPill({
  label, value, color,
}: {
  label: string;
  value: string | number;
  color: 'indigo' | 'gray' | 'emerald';
}): JSX.Element {
  const cls = {
    indigo:  'bg-indigo-50 border-indigo-100 text-indigo-700',
    gray:    'bg-gray-50   border-gray-100   text-gray-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  }[color];
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

function SessionRow({
  session, onEdit,
}: {
  session: AttendanceSessionSummary;
  onEdit:  () => void;
}): JSX.Element {
  const pct = session.total > 0
    ? Math.round((session.present / session.total) * 100)
    : 0;

  return (
    <tr className="hover:bg-gray-50/60">
      <td className="py-2.5 text-xs text-gray-600">
        {new Date(session.attendance_date + 'T00:00:00').toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </td>
      <td className="py-2.5 text-xs font-medium text-gray-900 max-w-[120px] truncate">
        {session.subject}
      </td>
      <td className="py-2.5 text-xs text-gray-500 hidden sm:table-cell">
        {session.section_name}
      </td>
      <td className="py-2.5 text-center text-xs text-gray-500 hidden sm:table-cell">
        P{session.period_number}
      </td>
      <td className="py-2.5 text-center text-xs font-semibold text-emerald-700">
        {session.present}
        <span className="ml-0.5 text-xs font-normal text-gray-400">
          ({pct}%)
        </span>
      </td>
      <td className="py-2.5 text-center text-xs font-semibold text-rose-600">
        {session.absent}
      </td>
      <td className="py-2.5 text-right">
        <button
          onClick={onEdit}
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-300"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}
