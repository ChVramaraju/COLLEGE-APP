// ============================================================
// pages/faculty/MarkAttendancePage.tsx
// ============================================================
// Two-step mark-attendance flow driven by useMarkAttendance().
//
// STEP 1 — Session Setup (step === 'session')
//   Section selector, subject input, date picker, period selector
//   → "Load Students" fetches the roster and advances to step 2
//
// STEP 2 — Bulk Marking (step === 'marking' | 'submitting')
//   Sticky header: session info + submit button + counts
//   Student list: roll number | name | P / A / L / E buttons | remarks
//   "Mark All Present" shortcut at the top
//   Keyboard: Tab through rows, 1/2/3/4 keys for P/A/L/E
//
// STEP 3 — Success (step === 'success')
//   Summary card with counts, then "Mark Another" / "View History"
//
// STEP 4 — Error (step === 'error')
//   Inline error with retry or back-to-session
// ============================================================

import React, { useCallback, type JSX, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Loader2,
  Users, CheckCheck, RotateCcw, ClipboardList,
} from 'lucide-react';

import { useMarkAttendance } from '@/hooks/useMarkAttendance';
import type { AttendanceStatus, StudentMarkRow } from '@/types/attendance';

const CARD     = 'rounded-2xl border border-gray-200 bg-white shadow-sm';
const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'P', absent: 'A', late: 'L', excused: 'E',
};
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-500 text-white ring-emerald-400',
  absent:  'bg-rose-500    text-white ring-rose-400',
  late:    'bg-amber-500   text-white ring-amber-400',
  excused: 'bg-blue-500    text-white ring-blue-400',
};
const STATUS_INACTIVE: Record<AttendanceStatus, string> = {
  present: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
  absent:  'border-rose-200    text-rose-600    hover:bg-rose-50',
  late:    'border-amber-200   text-amber-600   hover:bg-amber-50',
  excused: 'border-blue-200    text-blue-600    hover:bg-blue-50',
};

// Period 1-8
const PERIOD_OPTIONS = Array.from({ length: 8 }, (_, i) => i + 1);

export default function MarkAttendancePage(): JSX.Element {
  const navigate = useNavigate();
  const engine   = useMarkAttendance();
  const {
    assignments, assignmentsLoading,
    step, sessionForm, sessionErrors, setSessionField,
    studentsLoading, loadStudents,
    rows, setStatus, setRemarks, markAllPresent,
    result, submitError, submit,
    presentCount, absentCount, lateCount,
    backToSession, reset,
  } = engine;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">

      {/* ── Back nav ─────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/faculty/attendance"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Attendance
        </Link>
        <span className="text-gray-300" aria-hidden="true">/</span>
        <span className="text-sm font-semibold text-gray-900">Mark Attendance</span>
      </div>

      {/* ── STEP 1: Session setup ─────────────────────── */}
      {(step === 'session') && (
        <SessionSetupPanel
          assignments={assignments}
          assignmentsLoading={assignmentsLoading}
          form={sessionForm}
          errors={sessionErrors}
          isLoading={studentsLoading}
          onFieldChange={setSessionField}
          onSubmit={() => void loadStudents()}
        />
      )}

      {/* ── STEP 2 / SUBMITTING: Marking panel ───────── */}
      {(step === 'marking' || step === 'submitting') && (
        <MarkingPanel
          rows={rows}
          sessionForm={sessionForm}
          isSubmitting={step === 'submitting'}
          presentCount={presentCount}
          absentCount={absentCount}
          lateCount={lateCount}
          onSetStatus={setStatus}
          onSetRemarks={setRemarks}
          onMarkAllPresent={markAllPresent}
          onBack={backToSession}
          onSubmit={() => void submit()}
        />
      )}

      {/* ── STEP 3: Success ───────────────────────────── */}
      {step === 'success' && result && (
        <SuccessPanel
          result={result}
          onMarkAnother={reset}
          onViewHistory={() => navigate('/faculty/attendance/history')}
        />
      )}

      {/* ── STEP 4: Error ─────────────────────────────── */}
      {step === 'error' && (
        <ErrorPanel
          error={submitError ?? 'Submission failed.'}
          onRetry={() => void submit()}
          onBack={backToSession}
        />
      )}
    </div>
  );
}


// ============================================================
// STEP 1 — Session Setup
// ============================================================
function SessionSetupPanel({
  assignments, assignmentsLoading, form, errors, isLoading,
  onFieldChange, onSubmit,
}: {
  assignments:       import('@/types/facultyAssignment').AssignedSectionBrief[];
  assignmentsLoading: boolean;
  form:            import('@/types/attendance').SessionFormValues;
  errors:          import('@/hooks/useMarkAttendance').SessionFormErrors;
  isLoading:       boolean;
  onFieldChange:   <K extends keyof import('@/types/attendance').SessionFormValues>(
    field: K, value: import('@/types/attendance').SessionFormValues[K],
  ) => void;
  onSubmit:        () => void;
}): JSX.Element {
  const today = new Date().toISOString().slice(0, 10);

  function handleAssignmentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const assignmentId = e.target.value;
    if (assignmentId === '') {
      onFieldChange('section_id', '');
      onFieldChange('subject', '');
      return;
    }
    const found = assignments.find(a => a.assignment_id === Number(assignmentId));
    if (found) {
      onFieldChange('section_id', found.section_id);
      onFieldChange('subject', found.subject);
    }
  }

  const selectedAssignmentId = assignments.find(
    a => a.section_id === form.section_id && a.subject === form.subject,
  )?.assignment_id ?? '';

  return (
    <div className={`${CARD} p-6 max-w-xl mx-auto`}>
      <h2 className="mb-6 text-base font-semibold text-gray-900">Session Details</h2>

      <div className="space-y-5">
        {/* Assignment — sets both section_id + subject */}
        <Field label="Section • Subject" required error={errors.section_id ?? errors.subject}>
          <select
            value={selectedAssignmentId}
            disabled={assignmentsLoading || isLoading}
            onChange={handleAssignmentChange}
            className={INPUT}
          >
            <option value="">
              {assignmentsLoading ? 'Loading assignments…' : '— Select section • subject —'}
            </option>
            {assignments.map(a => (
              <option key={a.assignment_id} value={a.assignment_id}>
                {a.display_label}
              </option>
            ))}
          </select>
          {assignments.length === 0 && !assignmentsLoading && (
            <p className="mt-1.5 text-xs text-amber-600">
              No assignments found. Ask admin to assign you to a section and subject.
            </p>
          )}
        </Field>

        {/* Date */}
        <Field label="Date" required error={errors.attendance_date}>
          <input
            type="date"
            value={form.attendance_date}
            max={today}
            disabled={isLoading}
            onChange={e => onFieldChange('attendance_date', e.target.value)}
            className={INPUT}
          />
        </Field>

        {/* Period */}
        <Field label="Period" required error={errors.period_number}>
          <select
            value={form.period_number}
            disabled={isLoading}
            onChange={e => onFieldChange('period_number', e.target.value === '' ? '' : Number(e.target.value))}
            className={INPUT}
          >
            <option value="">— Select period —</option>
            {PERIOD_OPTIONS.map(p => (
              <option key={p} value={p}>Period {p}</option>
            ))}
          </select>
        </Field>

        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Loading Students…</>
          ) : (
            <><Users className="h-4 w-4" /> Load Students</>
          )}
        </button>
      </div>
    </div>
  );
}


// ============================================================
// STEP 2 — Marking panel
// ============================================================
function MarkingPanel({
  rows, sessionForm, isSubmitting,
  presentCount, absentCount, lateCount,
  onSetStatus, onSetRemarks, onMarkAllPresent,
  onBack, onSubmit,
}: {
  rows:            StudentMarkRow[];
  sessionForm:     import('@/types/attendance').SessionFormValues;
  isSubmitting:    boolean;
  presentCount:    number;
  absentCount:     number;
  lateCount:       number;
  onSetStatus:     (id: number, status: AttendanceStatus) => void;
  onSetRemarks:    (id: number, remarks: string) => void;
  onMarkAllPresent: () => void;
  onBack:          () => void;
  onSubmit:        () => void;
}): JSX.Element {
  const section = String(sessionForm.section_id);
  const date    = sessionForm.attendance_date
    ? new Date(sessionForm.attendance_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              {sessionForm.subject} · Period {sessionForm.period_number}
            </p>
            <p className="text-xs text-indigo-600">{date}</p>
          </div>
          <div className="flex items-center gap-3">
            <CountBadge label="P" count={presentCount} color="emerald" />
            <CountBadge label="A" count={absentCount}  color="rose" />
            <CountBadge label="L" count={lateCount}    color="amber" />
            <button
              onClick={onSubmit}
              disabled={isSubmitting || rows.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Submit ({rows.length})</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onMarkAllPresent}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark All Present
        </button>
      </div>

      {/* Student list */}
      <div className={CARD}>
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No active students in this section.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {rows.map((row, idx) => (
              <StudentRow
                key={row.student.id}
                row={row}
                index={idx}
                isDisabled={isSubmitting}
                onSetStatus={onSetStatus}
                onSetRemarks={onSetRemarks}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


// ============================================================
// Individual student row
// ============================================================
function StudentRow({
  row, index, isDisabled, onSetStatus, onSetRemarks,
}: {
  row:          StudentMarkRow;
  index:        number;
  isDisabled:   boolean;
  onSetStatus:  (id: number, s: AttendanceStatus) => void;
  onSetRemarks: (id: number, r: string) => void;
}): JSX.Element {
  const { student, status, remarks } = row;

  // Keyboard shortcut: 1=Present 2=Absent 3=Late 4=Excused
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, AttendanceStatus> = {
      '1': 'present', '2': 'absent', '3': 'late', '4': 'excused',
    };
    if (map[e.key] && !isDisabled) {
      onSetStatus(student.id, map[e.key]);
    }
  }, [student.id, isDisabled, onSetStatus]);

  return (
    <li
      className="flex flex-wrap items-center gap-3 px-4 py-3 focus-within:bg-gray-50/50"
      onKeyDown={handleKeyDown}
    >
      {/* Sequence number */}
      <span className="w-6 flex-shrink-0 text-center text-xs text-gray-400 tabular-nums">
        {index + 1}
      </span>

      {/* Student identity */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{student.full_name}</p>
        <p className="text-xs text-gray-400">{student.roll_number}</p>
      </div>

      {/* Status buttons */}
      <div className="flex items-center gap-1.5" role="group" aria-label={`Attendance for ${student.full_name}`}>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => !isDisabled && onSetStatus(student.id, s)}
            disabled={isDisabled}
            aria-label={s}
            aria-pressed={status === s}
            className={`h-7 w-7 rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${
              status === s
                ? `${STATUS_COLORS[s]} ring-2`
                : `border ${STATUS_INACTIVE[s]} bg-white`
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Optional remarks */}
      <input
        type="text"
        value={remarks}
        disabled={isDisabled}
        maxLength={100}
        placeholder="Remarks…"
        aria-label={`Remarks for ${student.full_name}`}
        onChange={e => onSetRemarks(student.id, e.target.value)}
        className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 sm:w-36"
      />
    </li>
  );
}


// ============================================================
// STEP 3 — Success summary
// ============================================================
function SuccessPanel({
  result, onMarkAnother, onViewHistory,
}: {
  result:        import('@/types/attendance').BulkMarkResult;
  onMarkAnother: () => void;
  onViewHistory: () => void;
}): JSX.Element {
  const date = new Date(result.attendance_date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-md">
      <div className={`${CARD} p-8 text-center`}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden="true" />
        </div>
        <h2 className="mb-1 text-lg font-bold text-gray-900">Attendance Submitted!</h2>
        <p className="mb-6 text-sm text-gray-500">{result.subject} · {date} · Period {result.period_number}</p>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 py-3">
            <p className="text-xl font-bold text-emerald-700">{result.present_count}</p>
            <p className="text-xs text-emerald-600">Present</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 py-3">
            <p className="text-xl font-bold text-rose-700">{result.absent_count}</p>
            <p className="text-xs text-rose-600">Absent</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 py-3">
            <p className="text-xl font-bold text-gray-700">{result.records_created}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onMarkAnother}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <RotateCcw className="h-4 w-4" /> Mark Another Session
          </button>
          <button
            onClick={onViewHistory}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <ClipboardList className="h-4 w-4" /> View History
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// STEP 4 — Error panel
// ============================================================
function ErrorPanel({
  error, onRetry, onBack,
}: {
  error:   string;
  onRetry: () => void;
  onBack:  () => void;
}): JSX.Element {
  return (
    <div className="mx-auto max-w-md">
      <div className={`${CARD} p-8 text-center`}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
          <AlertTriangle className="h-7 w-7 text-rose-600" aria-hidden="true" />
        </div>
        <h2 className="mb-1 text-lg font-bold text-gray-900">Submission Failed</h2>
        <p className="mb-6 text-sm text-rose-600">{error}</p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Session Setup
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// SHARED HELPERS
// ============================================================

const INPUT =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 ' +
  'placeholder-gray-400 transition-colors focus:border-indigo-400 focus:bg-white ' +
  'focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60';

function Field({
  label, required = false, error, children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  children:  React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function CountBadge({
  label, count, color,
}: {
  label: string;
  count: number;
  color: 'emerald' | 'rose' | 'amber';
}): JSX.Element {
  const cls = {
    emerald: 'bg-emerald-100 text-emerald-800',
    rose:    'bg-rose-100    text-rose-800',
    amber:   'bg-amber-100   text-amber-800',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${cls}`}>
      {label}: {count}
    </span>
  );
}
