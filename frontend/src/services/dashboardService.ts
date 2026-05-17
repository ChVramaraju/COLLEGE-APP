// ============================================================
// services/dashboardService.ts — Dashboard API Layer
// ============================================================
// Layer 1: Raw API calls, nothing else.
//
// ARCHITECTURE RULE:
//   Functions here ONLY do three things:
//     1. Call apiClient with the right path + params
//     2. Return typed response data
//     3. Let errors propagate (the hook handles them)
//
//   They do NOT: manage state, show UI, transform data,
//   or know about React at all.
//
// WHY SEPARATE FROM api/auth.ts?
//   auth.ts handles authentication flows.
//   dashboardService.ts handles data fetching.
//   Domain separation — when the attendance API changes,
//   you open dashboardService.ts, not a generic api/ file.
// ============================================================

import apiClient from '@/api/client';
import type {
  StudentProfile,
  AttendanceAnalytics,
  NotificationList,
  AvailableTest,
  NoteItem,
  Transcript,
  JobPosting,
  PlacementApplication,
} from '@/types/dashboard';

// ---------------------------------------------------------------
// STUDENT PROFILE
// GET /students/me → StudentDetailResponse
//
// Called first in useDashboard because the section.id it returns
// is needed as a path parameter for the notes endpoint.
// ---------------------------------------------------------------
export async function getStudentProfile(): Promise<StudentProfile> {
  const res = await apiClient.get<StudentProfile>('/students/me');
  return res.data;
}

// ---------------------------------------------------------------
// ATTENDANCE ANALYTICS
// GET /attendance/me/analytics → StudentAttendanceAnalytics
//
// Returns the student's overall attendance % + subject breakdown.
// This is the most critical dashboard metric for students.
// ---------------------------------------------------------------
export async function getAttendanceAnalytics(): Promise<AttendanceAnalytics> {
  const res = await apiClient.get<AttendanceAnalytics>('/attendance/me/analytics');
  return res.data;
}

// ---------------------------------------------------------------
// NOTIFICATIONS (latest 5 + unread count)
// GET /notifications/?limit=5&skip=0 → NotificationListResponse
//
// We fetch only 5 for the dashboard preview widget.
// The full notifications page will fetch all with pagination.
// ---------------------------------------------------------------
export async function getNotificationsPreview(): Promise<NotificationList> {
  const res = await apiClient.get<NotificationList>('/notifications/', {
    params: { limit: 5, skip: 0 },
  });
  return res.data;
}

// ---------------------------------------------------------------
// AVAILABLE TESTS
// GET /tests/available → AvailableTest[]
//
// Returns tests that are currently open for the student's section.
// already_attempted = true means they've done it (show result).
// ---------------------------------------------------------------
export async function getAvailableTests(): Promise<AvailableTest[]> {
  const res = await apiClient.get<AvailableTest[]>('/tests/available');
  return res.data;
}

// ---------------------------------------------------------------
// SECTION NOTES (latest 5)
// GET /notes/section/{sectionId}?limit=5 → NoteResponse[]
//
// Notes are section-specific. The backend enforces this:
// a student can ONLY see notes for their own section.
// section_id comes from getStudentProfile() result.
// ---------------------------------------------------------------
export async function getSectionNotes(sectionId: number): Promise<NoteItem[]> {
  const res = await apiClient.get<NoteItem[]>(`/notes/section/${sectionId}`, {
    params: { limit: 5, skip: 0 },
  });
  return res.data;
}

// ---------------------------------------------------------------
// ACADEMIC TRANSCRIPT
// GET /results/transcript/me → TranscriptResponse
//
// Returns full semester history with SGPA/CGPA.
// Dashboard shows only the latest semester + current_cgpa.
// ---------------------------------------------------------------
export async function getTranscript(): Promise<Transcript> {
  const res = await apiClient.get<Transcript>('/results/transcript/me');
  return res.data;
}

// ---------------------------------------------------------------
// ACTIVE JOB POSTINGS (latest 5)
// GET /placement/postings/?active_only=true&limit=5
//
// is_eligible is populated by the backend per-student.
// Dashboard shows only open/eligible postings.
// ---------------------------------------------------------------
export async function getActivePostings(): Promise<JobPosting[]> {
  const res = await apiClient.get<JobPosting[]>('/placement/postings/', {
    params: { active_only: true, limit: 5, skip: 0 },
  });
  return res.data;
}

// ---------------------------------------------------------------
// MY PLACEMENT APPLICATIONS
// GET /placement/applications/me → ApplicationResponse[]
//
// Student's own application history.
// Dashboard shows status summary (applied, shortlisted, selected).
// ---------------------------------------------------------------
export async function getMyApplications(): Promise<PlacementApplication[]> {
  const res = await apiClient.get<PlacementApplication[]>('/placement/applications/me');
  return res.data;
}
