// ============================================================
// types/index.ts — Central type re-export barrel
// ============================================================
// Import all types from one place:
//   import type { AuthUser, ApiError } from '@/types'
// instead of hunting through individual files.
// ============================================================

export type { UserRole, LoginRequest, TokenResponse, JwtPayload, AuthUser } from './auth';
export type { ApiError, PaginatedResponse } from './api';
export type {
  StudentProfile, SectionSummary,
  AttendanceAnalytics, SubjectBreakdown,
  NotificationList, NotificationItem, NotificationType,
  AvailableTest, NoteItem,
  Transcript, SemesterTranscript, SubjectResultInTranscript,
  JobPosting, PlacementApplication, ApplicationStatus,
  DashboardData, DashboardState, DashboardSectionStatus,
} from './dashboard';
