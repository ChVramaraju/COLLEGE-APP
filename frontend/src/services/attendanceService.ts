// ============================================================
// services/attendanceService.ts — Attendance API Layer
// ============================================================
// Layer 1: Raw API calls only.
//
// Two endpoints for the student attendance portal:
//
//  1. GET /attendance/me
//     → Returns ALL of the student's attendance records
//     → Large payload (hundreds of rows) — fetched once on mount
//     → The hook handles filtering client-side (instant UX)
//
//  2. GET /attendance/me/analytics
//     → Returns pre-computed summary + subject breakdown
//     → Much smaller — computed by the backend, not the frontend
//     → No need to re-fetch unless user explicitly refreshes
//
// WHY fetch ALL records and filter client-side?
//   A student has ~300-500 records per academic year.
//   That's ~40KB JSON — trivial for a browser.
//   Client-side filtering = INSTANT filter feedback (no spinner).
//   Server-side filtering = 200-500ms lag per filter change.
//   For small datasets, client-side wins on UX.
//   (Netflix uses this same pattern for browsing in-memory lists.)
// ============================================================

import apiClient from '@/api/client';
import type {
  AttendanceRecord,
  AttendanceAnalytics,
  AttendanceStudentBrief,
  AttendanceSessionSummary,
  BulkMarkPayload,
  BulkMarkResult,
  UpdateAttendancePayload,
  AdminAttendanceAnalytics,
} from '@/types/attendance';

// ---------------------------------------------------------------
// GET /attendance/me → AttendanceRecord[]
// ---------------------------------------------------------------
export async function getMyAttendanceRecords(): Promise<AttendanceRecord[]> {
  const res = await apiClient.get<AttendanceRecord[]>('/attendance/me');
  return res.data;
}

// ---------------------------------------------------------------
// GET /attendance/me/analytics → AttendanceAnalytics
// ---------------------------------------------------------------
export async function getMyAttendanceAnalytics(): Promise<AttendanceAnalytics> {
  const res = await apiClient.get<AttendanceAnalytics>('/attendance/me/analytics');
  return res.data;
}


// ============================================================
// FACULTY FUNCTIONS
// ============================================================

// ---------------------------------------------------------------
// GET /attendance/section/{id}/students → AttendanceStudentBrief[]
// Returns the active student roster for attendance marking.
// ---------------------------------------------------------------
export async function getSectionStudentsForAttendance(
  sectionId: number,
): Promise<AttendanceStudentBrief[]> {
  const res = await apiClient.get<AttendanceStudentBrief[]>(
    `/attendance/section/${sectionId}/students`,
  );
  return res.data;
}

// ---------------------------------------------------------------
// POST /attendance/mark → BulkMarkResult
// Marks attendance for an entire class session in one call.
// ---------------------------------------------------------------
export async function markAttendanceBulk(
  payload: BulkMarkPayload,
): Promise<BulkMarkResult> {
  const res = await apiClient.post<BulkMarkResult>('/attendance/mark', payload);
  return res.data;
}

// ---------------------------------------------------------------
// GET /attendance/history → AttendanceSessionSummary[]
// Faculty's own session history, grouped by session metadata.
// ---------------------------------------------------------------
export async function getFacultyAttendanceHistory(): Promise<AttendanceSessionSummary[]> {
  const res = await apiClient.get<AttendanceSessionSummary[]>('/attendance/history');
  return res.data;
}

// ---------------------------------------------------------------
// GET /attendance/section/{id}/date/{date} → AttendanceRecord[]
// Fetch all records for a specific session (to support edit flow).
// Optional subject + period filters narrow to one session.
// ---------------------------------------------------------------
export async function getSessionRecords(
  sectionId:      number,
  date:           string,
  subject?:       string,
  periodNumber?:  number,
): Promise<AttendanceRecord[]> {
  const params: Record<string, string | number> = {};
  if (subject)      params.subject       = subject;
  if (periodNumber) params.period_number = periodNumber;
  const res = await apiClient.get<AttendanceRecord[]>(
    `/attendance/section/${sectionId}/date/${date}`,
    { params },
  );
  return res.data;
}

// ---------------------------------------------------------------
// PATCH /attendance/{id} → AttendanceRecord
// Correct a single student's attendance status.
// ---------------------------------------------------------------
export async function patchAttendanceRecord(
  recordId: number,
  data:     UpdateAttendancePayload,
): Promise<AttendanceRecord> {
  const res = await apiClient.patch<AttendanceRecord>(`/attendance/${recordId}`, data);
  return res.data;
}


// ============================================================
// ADMIN FUNCTIONS
// ============================================================

// ---------------------------------------------------------------
// GET /attendance/admin/analytics → AdminAttendanceAnalytics
// Institution-wide overview: dept breakdown, faculty activity.
// ---------------------------------------------------------------
export async function getAdminAttendanceAnalytics(): Promise<AdminAttendanceAnalytics> {
  const res = await apiClient.get<AdminAttendanceAnalytics>('/attendance/admin/analytics');
  return res.data;
}
