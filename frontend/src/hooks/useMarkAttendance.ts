// ============================================================
// hooks/useMarkAttendance.ts — Mark Attendance State Machine
// ============================================================
//
// TWO-STEP FLOW:
//   Step 1 "session"  → Faculty sets: section, subject, date, period
//                        Then clicks "Load Students"
//   Step 2 "marking"  → Faculty sets P/A/L/E for each student
//                        "Mark All Present" shortcut available
//                        Submits bulk payload to POST /attendance/mark
//   Step 3 "success"  → Result summary shown, auto-reset after 5 s
//
// STATE ISOLATION:
//   sessionForm   — controlled form state for step 1
//   rows          — per-student mark entries (step 2)
//   submitPhase   — 'idle' | 'submitting' | 'success' | 'error'
//
// RETRY SAFETY:
//   The backend rejects duplicate sessions with 409.
//   If the first submit succeeded but the browser lost the success
//   state, submitting again just gets a 409 → shown as an error
//   ("Attendance already marked for this session").
//   No data is lost or corrupted.
//
// OPTIMISTIC UPDATES:
//   None needed here — all data is local until Submit is pressed.
//   The "optimistic" behaviour is the instant P/A/L button feedback.
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import type {
  SessionFormValues,
  StudentMarkRow,
  BulkMarkResult,
  AttendanceStatus,
} from '@/types/attendance';
import { DEFAULT_SESSION_FORM } from '@/types/attendance';
import {
  getSectionStudentsForAttendance,
  markAttendanceBulk,
} from '@/services/attendanceService';
import { getMyFacultyAssignments } from '@/services/facultyAssignmentService';
import type { AssignedSectionBrief } from '@/types/facultyAssignment';


// ============================================================
// PUBLIC TYPES
// ============================================================

export type MarkStep = 'session' | 'marking' | 'submitting' | 'success' | 'error';

export interface SessionFormErrors {
  section_id?:      string;
  subject?:         string;
  attendance_date?: string;
  period_number?:   string;
}

export interface UseMarkAttendanceReturn {
  // ── Assignment list (section + subject, for the dropdown) ─
  assignments:       AssignedSectionBrief[];
  assignmentsLoading: boolean;

  // ── Step 1: Session form ─────────────────────────────────
  step:         MarkStep;
  sessionForm:  SessionFormValues;
  sessionErrors: SessionFormErrors;
  setSessionField: <K extends keyof SessionFormValues>(
    field: K, value: SessionFormValues[K],
  ) => void;

  // ── Step 1 → 2 transition ────────────────────────────────
  studentsLoading: boolean;
  loadStudents:    () => Promise<void>;

  // ── Step 2: Marking ──────────────────────────────────────
  rows:            StudentMarkRow[];
  setStatus:       (studentId: number, status: AttendanceStatus) => void;
  setRemarks:      (studentId: number, remarks: string)          => void;
  markAllPresent:  () => void;

  // ── Submit ───────────────────────────────────────────────
  result:     BulkMarkResult | null;
  submitError: string | null;
  submit:     () => Promise<void>;

  // ── Derived ──────────────────────────────────────────────
  presentCount: number;
  absentCount:  number;
  lateCount:    number;

  // ── Navigation ───────────────────────────────────────────
  backToSession: () => void;
  reset:         () => void;
}


// ============================================================
// VALIDATION
// ============================================================

function validateSessionForm(form: SessionFormValues): SessionFormErrors {
  const errors: SessionFormErrors = {};
  if (form.section_id === '') errors.section_id = 'Please select a section.';
  if (!form.subject.trim())   errors.subject    = 'Subject is required.';
  if (!form.attendance_date)  errors.attendance_date = 'Date is required.';
  else {
    const today = new Date().toISOString().slice(0, 10);
    if (form.attendance_date > today) errors.attendance_date = 'Date cannot be in the future.';
  }
  if (form.period_number === '') errors.period_number = 'Please select a period.';
  return errors;
}


// ============================================================
// HOOK
// ============================================================

export function useMarkAttendance(): UseMarkAttendanceReturn {
  // ── Assignment list (section + subject combined) ─────────
  const [assignments,       setAssignments]       = useState<AssignedSectionBrief[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyFacultyAssignments()
      .then(data => { if (!cancelled) setAssignments(data); })
      .catch(() => { /* silent — user will see empty dropdown */ })
      .finally(() => { if (!cancelled) setAssignmentsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Session form ─────────────────────────────────────────
  const [step,          setStep]          = useState<MarkStep>('session');
  const [sessionForm,   setSessionForm]   = useState<SessionFormValues>(DEFAULT_SESSION_FORM);
  const [sessionErrors, setSessionErrors] = useState<SessionFormErrors>({});

  const setSessionField = useCallback(<K extends keyof SessionFormValues>(
    field: K,
    value: SessionFormValues[K],
  ) => {
    setSessionForm(prev => ({ ...prev, [field]: value }));
    setSessionErrors(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as keyof SessionFormErrors];
      return next;
    });
  }, []);

  // ── Student rows ─────────────────────────────────────────
  const [rows,            setRows]            = useState<StudentMarkRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Submit state ─────────────────────────────────────────
  const [result,      setResult]      = useState<BulkMarkResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load students → transition to marking step ───────────
  const loadStudents = useCallback(async () => {
    const errors = validateSessionForm(sessionForm);
    if (Object.keys(errors).length > 0) {
      setSessionErrors(errors);
      return;
    }
    setStudentsLoading(true);
    try {
      const students = await getSectionStudentsForAttendance(
        sessionForm.section_id as number,
      );
      const initialRows: StudentMarkRow[] = students.map(s => ({
        student: s,
        status:  'present',
        remarks: '',
      }));
      setRows(initialRows);
      setStep('marking');
    } catch (err) {
      setSessionErrors({
        subject: err instanceof Error ? err.message : 'Failed to load students.',
      });
    } finally {
      setStudentsLoading(false);
    }
  }, [sessionForm]);

  // ── Per-student updates ──────────────────────────────────
  const setStatus = useCallback((studentId: number, status: AttendanceStatus) => {
    setRows(prev => prev.map(r =>
      r.student.id === studentId ? { ...r, status } : r,
    ));
  }, []);

  const setRemarks = useCallback((studentId: number, remarks: string) => {
    setRows(prev => prev.map(r =>
      r.student.id === studentId ? { ...r, remarks } : r,
    ));
  }, []);

  const markAllPresent = useCallback(() => {
    setRows(prev => prev.map(r => ({ ...r, status: 'present' as AttendanceStatus })));
  }, []);

  // ── Submit ───────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (step !== 'marking' || rows.length === 0) return;
    setStep('submitting');
    setSubmitError(null);
    try {
      const res = await markAttendanceBulk({
        section_id:      sessionForm.section_id as number,
        subject:         sessionForm.subject.trim(),
        attendance_date: sessionForm.attendance_date,
        period_number:   sessionForm.period_number as number,
        entries: rows.map(r => ({
          student_id: r.student.id,
          status:     r.status,
          remarks:    r.remarks || undefined,
        })),
      });
      setResult(res);
      setStep('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setSubmitError(msg);
      setStep('error');
    }
  }, [step, rows, sessionForm]);

  // ── Derived counts ───────────────────────────────────────
  const presentCount = rows.filter(r => r.status === 'present').length;
  const absentCount  = rows.filter(r => r.status === 'absent').length;
  const lateCount    = rows.filter(r => r.status === 'late').length;

  // ── Navigation helpers ───────────────────────────────────
  const backToSession = useCallback(() => {
    setStep('session');
    setRows([]);
    setSubmitError(null);
  }, []);

  const reset = useCallback(() => {
    setStep('session');
    setSessionForm(DEFAULT_SESSION_FORM);
    setSessionErrors({});
    setRows([]);
    setResult(null);
    setSubmitError(null);
  }, []);

  return {
    assignments,
    assignmentsLoading,
    step,
    sessionForm,
    sessionErrors,
    setSessionField,
    studentsLoading,
    loadStudents,
    rows,
    setStatus,
    setRemarks,
    markAllPresent,
    result,
    submitError,
    submit,
    presentCount,
    absentCount,
    lateCount,
    backToSession,
    reset,
  };
}
