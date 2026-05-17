// ============================================================
// types/dashboard.ts — Dashboard API Response Contracts
// ============================================================
// Each interface here mirrors an exact backend Pydantic schema.
// Filed name-for-name, type-for-type.
// If backend changes a field, TypeScript surfaces every broken
// consumer automatically.
//
// RULE: Every field is optional (?) ONLY if the backend schema
// marks it Optional[...]. Never guess — match the schema.
// ============================================================

// ---------------------------------------------------------------
// SHARED ENUMS (string literals matching Python enum values)
// ---------------------------------------------------------------
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type NotificationType =
  | 'announcement'
  | 'test_result'
  | 'low_attendance'
  | 'notes_uploaded'
  | 'placement_update'
  | 'general';
export type ApplicationStatus =
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'selected'
  | 'rejected'
  | 'withdrawn';
export type ResultStatus = 'pass' | 'fail' | 'withheld' | 'pending';

// ---------------------------------------------------------------
// STUDENT PROFILE — GET /students/me
// ---------------------------------------------------------------
export interface SectionSummary {
  id: number;
  name: string;
  department: string;
  semester: number;
  academic_year: string;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  roll_number: string;
  department: string;
  semester: number;
  admission_year: number;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  is_active: boolean | null;
  section: SectionSummary | null;
}

// ---------------------------------------------------------------
// ATTENDANCE — GET /attendance/me/analytics
// ---------------------------------------------------------------
export interface SubjectBreakdown {
  subject: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  percentage: number;
  is_below_threshold: boolean;
}

export interface AttendanceAnalytics {
  student_id: number;
  roll_number: string;
  full_name: string;
  overall_total: number;
  overall_present: number;
  overall_percentage: number;
  is_low_attendance: boolean;
  subject_breakdown: SubjectBreakdown[];
}

// ---------------------------------------------------------------
// NOTIFICATIONS — GET /notifications/?limit=5
// ---------------------------------------------------------------
export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: NotificationType;
  is_broadcast: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
  sender_name: string | null;
}

export interface NotificationList {
  total: number;
  unread_count: number;
  notifications: NotificationItem[];
}

// ---------------------------------------------------------------
// TESTS — GET /tests/available
// ---------------------------------------------------------------
export interface AvailableTest {
  id: number;
  title: string;
  subject: string;
  total_marks: number;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  question_count: number;
  already_attempted: boolean;
}

// ---------------------------------------------------------------
// NOTES — GET /notes/section/{section_id}
// ---------------------------------------------------------------
export interface NoteItem {
  id: number;
  faculty_id: number;
  section_id: number;
  subject: string;
  title: string;
  description: string | null;
  original_file_name: string;
  file_size: number;
  mime_type: string;
  is_active: boolean;
  uploaded_at: string | null;
}

// ---------------------------------------------------------------
// RESULTS / TRANSCRIPT — GET /results/transcript/me
// ---------------------------------------------------------------
export interface SubjectResultInTranscript {
  subject_code: string;
  subject_name: string;
  credits: number;
  exam_type: string;
  total_marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  grade_points: number;
}

export interface SemesterTranscript {
  semester: number;
  academic_year: string;
  sgpa: number | null;
  cgpa: number | null;
  total_credits: number;
  credits_earned: number;
  result_status: ResultStatus | null;
  subjects: SubjectResultInTranscript[];
}

export interface Transcript {
  student_id: number;
  roll_number: string;
  full_name: string;
  department: string;
  current_cgpa: number | null;
  semesters: SemesterTranscript[];
}

// ---------------------------------------------------------------
// PLACEMENT — GET /placement/postings/ + /applications/me
// ---------------------------------------------------------------
export interface JobPosting {
  id: number;
  company_name: string;
  role_title: string;
  description: string | null;
  location: string | null;
  package_lpa: number | null;
  min_cgpa: number;
  min_attendance_pct: number;
  is_active: boolean;
  is_open: boolean;
  application_deadline: string | null;
  created_at: string | null;
  total_applications: number | null;
  is_eligible: boolean | null;
}

export interface PlacementApplication {
  id: number;
  student_id: number;
  job_posting_id: number;
  status: ApplicationStatus;
  remarks: string | null;
  applied_at: string | null;
  company_name: string | null;
  role_title: string | null;
  package_lpa: number | null;
}

// ---------------------------------------------------------------
// AGGREGATED DASHBOARD DATA
// ---------------------------------------------------------------
// This is the shape that useDashboard() returns.
// It's NOT a backend type — it's a frontend aggregate.
// The hook assembles this from 8 different API responses.
export interface DashboardData {
  profile:       StudentProfile;
  attendance:    AttendanceAnalytics;
  notifications: NotificationList;
  tests:         AvailableTest[];
  notes:         NoteItem[];
  transcript:    Transcript;
  postings:      JobPosting[];
  applications:  PlacementApplication[];
}

// Partial: each section may have loaded or failed independently
export type DashboardSectionStatus = 'loading' | 'success' | 'error';

export interface DashboardState {
  data: Partial<DashboardData>;
  status: Record<keyof DashboardData, DashboardSectionStatus>;
  errors: Partial<Record<keyof DashboardData, string>>;
  isAnyLoading: boolean;
  isAllLoaded: boolean;
  refetch: () => void;
}
