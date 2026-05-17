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
import type { AttendanceRecord, AttendanceAnalytics } from '@/types/attendance';

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
