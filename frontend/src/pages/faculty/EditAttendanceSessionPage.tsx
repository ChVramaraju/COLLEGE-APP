// ============================================================
// pages/faculty/EditAttendanceSessionPage.tsx
// ============================================================
// Loads all attendance records for a specific session (identified
// by sectionId + date + subject + period in URL query params),
// then lets the faculty patch individual records via PATCH /attendance/{id}.
//
// URL shape:
//   /faculty/attendance/edit?sectionId=3&date=2026-05-14&subject=Data+Structures&period=2
//
// EDIT STRATEGY:
//   → Records load into a local Map<recordId, {status, remarks}>
//   → Faculty changes status/remarks (optimistic local update)
//   → "Save Changes" sends one PATCH per dirty record sequentially
//   → On any failure: local state rolls back to original for that record
//   → On all success: "saved" state shown, dirty set cleared
//
// GUARD:
//   If any required query param is missing → show error, link back
// ============================================================

import {
  useState, useEffect, useCallback, useRef, type JSX, type KeyboardEvent,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle,
  Save, CheckCheck,
} from 'lucide-react';

import {
  getSessionRecords,
  patchAttendanceRecord,
  getSectionStudentsForAttendance,
} from '@/services/attendanceService';
import type { AttendanceRecord, AttendanceStatus, AttendanceStudentBrief } from '@/types/attendance';

const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

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

// ── Local mutable row shape ────────────────────────────────
interface EditRow {
  record:        AttendanceRecord;
  student:       AttendanceStudentBrief | null;
  status:        AttendanceStatus;
  remarks:       string;
  originalStatus:  AttendanceStatus;
  originalRemarks: string;
}

export default function EditAttendanceSessionPage(): JSX.Element {
  const [params]   = useSearchParams();
  const sectionId    = params.get('sectionId');
  const date         = params.get('date');
  const subject      = params.get('subject');
  const periodStr    = params.get('period');
  const periodNumber = periodStr ? Number(periodStr) : null;

  const isValid = sectionId && date && subject && periodNumber;

  const [rows,        setRows]        = useState<EditRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [savedCount,  setSavedCount]  = useState(0);
  const [totalDirty,  setTotalDirty]  = useState(0);
  const [allSaved,    setAllSaved]    = useState(false);

  // Track dirty record IDs (changed since load/last save)
  const dirtyRef = useRef<Set<number>>(new Set());

  // ── Load records + student map ─────────────────────────
  useEffect(() => {
    if (!isValid) { setLoading(false); return; }
    let cancelled = false;

    Promise.all([
      getSessionRecords(Number(sectionId), date!, subject!, periodNumber!),
      getSectionStudentsForAttendance(Number(sectionId)),
    ])
      .then(([records, students]) => {
        if (cancelled) return;
        const studentMap = new Map(students.map(s => [s.id, s]));
        const initialRows: EditRow[] = records.map(r => ({
          record:          r,
          student:         studentMap.get(r.student_id) ?? null,
          status:          r.status,
          remarks:         r.remarks ?? '',
          originalStatus:  r.status,
          originalRemarks: r.remarks ?? '',
        }));
        setRows(initialRows);
        dirtyRef.current.clear();
      })
      .catch(e => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load session.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isValid, sectionId, date, subject, periodNumber]);

  // ── Per-row edits ──────────────────────────────────────
  const setStatus = useCallback((recordId: number, status: AttendanceStatus) => {
    setRows(prev => prev.map(r => {
      if (r.record.id !== recordId) return r;
      const isDirty = status !== r.originalStatus || r.remarks !== r.originalRemarks;
      isDirty ? dirtyRef.current.add(recordId) : dirtyRef.current.delete(recordId);
      return { ...r, status };
    }));
    setAllSaved(false);
  }, []);

  const setRemarks = useCallback((recordId: number, remarks: string) => {
    setRows(prev => prev.map(r => {
      if (r.record.id !== recordId) return r;
      const isDirty = r.status !== r.originalStatus || remarks !== r.originalRemarks;
      isDirty ? dirtyRef.current.add(recordId) : dirtyRef.current.delete(recordId);
      return { ...r, remarks };
    }));
    setAllSaved(false);
  }, []);

  const markAllPresent = useCallback(() => {
    setRows(prev => prev.map(r => {
      const isDirty = 'present' !== r.originalStatus || r.remarks !== r.originalRemarks;
      isDirty ? dirtyRef.current.add(r.record.id) : dirtyRef.current.delete(r.record.id);
      return { ...r, status: 'present' };
    }));
    setAllSaved(false);
  }, []);

  // ── Save changes — only dirty rows ─────────────────────
  const save = useCallback(async () => {
    const dirtyRows = rows.filter(r => dirtyRef.current.has(r.record.id));
    if (dirtyRows.length === 0) return;

    setSaving(true);
    setSaveError(null);
    setSavedCount(0);
    setTotalDirty(dirtyRows.length);

    const failedIds: number[] = [];
    let saved = 0;

    for (const row of dirtyRows) {
      try {
        const updated = await patchAttendanceRecord(row.record.id, {
          status:  row.status,
          remarks: row.remarks || null,
        });
        // Update original snapshot on success → no longer dirty
        setRows(prev => prev.map(r =>
          r.record.id === updated.id
            ? { ...r, originalStatus: updated.status, originalRemarks: updated.remarks ?? '' }
            : r,
        ));
        dirtyRef.current.delete(row.record.id);
        saved++;
        setSavedCount(saved);
      } catch {
        failedIds.push(row.record.id);
        // Rollback this row to its original values
        setRows(prev => prev.map(r =>
          r.record.id === row.record.id
            ? { ...r, status: r.originalStatus, remarks: r.originalRemarks }
            : r,
        ));
        dirtyRef.current.delete(row.record.id);
      }
    }

    if (failedIds.length > 0) {
      setSaveError(`${failedIds.length} record(s) failed to save and were rolled back. Try again.`);
    } else {
      setAllSaved(true);
    }
    setSaving(false);
  }, [rows]);

  const dirtyCount = dirtyRef.current.size;
  const presentCount = rows.filter(r => r.status === 'present').length;
  const absentCount  = rows.filter(r => r.status === 'absent').length;
  const lateCount    = rows.filter(r => r.status === 'late').length;

  const historyUrl = '/faculty/attendance/history';

  // ── Guard: missing params ──────────────────────────────
  if (!isValid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h2 className="mb-1 text-lg font-bold text-gray-900">Invalid Session Link</h2>
        <p className="mb-5 text-sm text-gray-500">
          This URL is missing required session parameters.
        </p>
        <Link
          to={historyUrl}
          className="text-sm font-medium text-indigo-600 hover:underline focus:outline-none"
        >
          ← Back to History
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(date! + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">

      {/* ── Breadcrumb ─────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to={historyUrl}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" /> History
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">Edit Session</span>
      </div>

      {/* ── Session info header ────────────────────────── */}
      <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
        <h1 className="text-base font-bold text-indigo-900">{subject} · Period {periodNumber}</h1>
        <p className="mt-0.5 text-xs text-indigo-600">{formattedDate}</p>
      </div>

      {/* ── Loading ────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading session records…</p>
        </div>
      )}

      {/* ── Load error ─────────────────────────────────── */}
      {!loading && loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {loadError}
        </div>
      )}

      {/* ── Records ready ──────────────────────────────── */}
      {!loading && !loadError && (
        <div className="space-y-4">

          {/* Sticky toolbar */}
          <div className="sticky top-0 z-10 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CountBadge label="P" count={presentCount} color="emerald" />
                <CountBadge label="A" count={absentCount}  color="rose" />
                <CountBadge label="L" count={lateCount}    color="amber" />
                {dirtyCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {dirtyCount} unsaved
                  </span>
                )}
                {allSaved && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={markAllPresent}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 focus:outline-none disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> All Present
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving || dirtyCount === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving {savedCount}/{totalDirty}…</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Save Changes{dirtyCount > 0 ? ` (${dirtyCount})` : ''}</>
                  )}
                </button>
              </div>
            </div>

            {/* Save error */}
            {saveError && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {saveError}
              </div>
            )}
          </div>

          {/* Student list */}
          <div className={CARD}>
            {rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No records found for this session.
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <EditStudentRow
                    key={row.record.id}
                    row={row}
                    index={idx}
                    isDirty={dirtyRef.current.has(row.record.id)}
                    isDisabled={saving}
                    onSetStatus={setStatus}
                    onSetRemarks={setRemarks}
                  />
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  );
}


// ============================================================
// Edit row component
// ============================================================
function EditStudentRow({
  row, index, isDirty, isDisabled, onSetStatus, onSetRemarks,
}: {
  row:          EditRow;
  index:        number;
  isDirty:      boolean;
  isDisabled:   boolean;
  onSetStatus:  (recordId: number, status: AttendanceStatus) => void;
  onSetRemarks: (recordId: number, remarks: string) => void;
}): JSX.Element {
  const { record, student, status, remarks } = row;

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLLIElement>) => {
    const map: Record<string, AttendanceStatus> = {
      '1': 'present', '2': 'absent', '3': 'late', '4': 'excused',
    };
    if (map[e.key] && !isDisabled) {
      onSetStatus(record.id, map[e.key]);
    }
  }, [record.id, isDisabled, onSetStatus]);

  return (
    <li
      className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors focus-within:bg-gray-50/50 ${isDirty ? 'bg-amber-50/40' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Index */}
      <span className="w-6 flex-shrink-0 text-center text-xs text-gray-400 tabular-nums">
        {index + 1}
      </span>

      {/* Student identity */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {student?.full_name ?? `Student #${record.student_id}`}
          {isDirty && (
            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              edited
            </span>
          )}
        </p>
        <p className="text-xs text-gray-400">{student?.roll_number ?? `ID: ${record.student_id}`}</p>
      </div>

      {/* Status buttons */}
      <div className="flex items-center gap-1.5" role="group" aria-label={`Attendance status for student ${record.student_id}`}>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => !isDisabled && onSetStatus(record.id, s)}
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

      {/* Remarks */}
      <input
        type="text"
        value={remarks}
        disabled={isDisabled}
        maxLength={100}
        placeholder="Remarks…"
        aria-label={`Remarks for student ${record.student_id}`}
        onChange={e => onSetRemarks(record.id, e.target.value)}
        className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 sm:w-36"
      />
    </li>
  );
}


// ── Shared helper ─────────────────────────────────────────────
function CountBadge({
  label, count, color,
}: {
  label: string;
  count: number;
  color: 'emerald' | 'rose' | 'amber';
}): JSX.Element {
  const cls = { emerald: 'bg-emerald-100 text-emerald-800', rose: 'bg-rose-100 text-rose-800', amber: 'bg-amber-100 text-amber-800' }[color];
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${cls}`}>
      {label}: {count}
    </span>
  );
}
