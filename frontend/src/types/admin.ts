// ============================================================
// types/admin.ts — Super Admin Dashboard Type Contracts
// ============================================================
// Mirrors backend/schemas/admin.py exactly.
// ============================================================

// ── Shared role type ─────────────────────────────────────────
export type UserRole = 'student' | 'faculty' | 'admin';

// ── Dashboard snapshot (GET /admin/dashboard) ─────────────────
export interface UserSummary {
  total_users:    number;
  active_users:   number;
  inactive_users: number;
  by_role:        Record<string, number>;
}
export interface StudentSummary {
  total_students:  number;
  active_students: number;
  by_department:   Record<string, number>;
  by_semester:     Record<string, number>;
}
export interface FacultySummary {
  total_faculty:  number;
  active_faculty: number;
  by_department:  Record<string, number>;
}
export interface AttendanceSummary {
  total_records:               number;
  institution_avg_percentage:  number;
  below_75_count:              number;
}
export interface TestSummary {
  total_tests:          number;
  published_tests:      number;
  total_attempts:       number;
  avg_score_percentage: number;
}
export interface ResultSummary {
  total_results:     number;
  published_results: number;
  overall_pass_rate: number;
  avg_percentage:    number;
}
export interface NotificationSummary {
  total_sent:   number;
  unread_count: number;
}
export interface AdminDashboardData {
  users:         UserSummary;
  students:      StudentSummary;
  faculty:       FacultySummary;
  sections:      { total: number; active: number };
  attendance:    AttendanceSummary;
  tests:         TestSummary;
  results:       ResultSummary;
  notifications: NotificationSummary;
  generated_at:  string;
}

// ── Analytics (GET /admin/analytics) ─────────────────────────
export interface DepartmentPerformance {
  department:       string;
  student_count:    number;
  avg_cgpa:         number | null;
  avg_attendance_pct: number | null;
  pass_rate:        number | null;
}
export interface SectionPerformance {
  section_id:        number;
  section_name:      string;
  student_count:     number;
  avg_attendance_pct: number | null;
  avg_cgpa:          number | null;
}
export interface TopPerformer {
  student_id:     number;
  roll_number:    string;
  full_name:      string;
  department:     string;
  cgpa:           number | null;
  attendance_pct: number | null;
}
export interface InstitutionAnalytics {
  department_performance: DepartmentPerformance[];
  section_performance:    SectionPerformance[];
  top_performers:         TopPerformer[];
  low_attendance_students: Array<{ student_id: number; roll_number: string; attendance_pct: number }>;
  gpa_distribution:       Record<string, number>;
}

// ── System health (GET /admin/system-health) ──────────────────
export interface SystemHealth {
  ws_connections:           number;
  total_users:              number;
  active_students:          number;
  active_faculty:           number;
  total_notifications_sent: number;
  total_files_uploaded:     number;
  total_attendance_records: number;
  total_test_attempts:      number;
  total_sections:           number;
  generated_at:             string;
}

// ── Trends (GET /admin/analytics/trends) ─────────────────────
export interface TrendsMonthPoint {
  month:                    string;
  notifications_count:      number;
  test_attempts_count:      number;
  attendance_records_count: number;
}
export interface TrendsData {
  monthly_data:              TrendsMonthPoint[];
  dept_student_distribution: Array<{ dept: string; count: number }>;
  gpa_distribution:          Record<string, number>;
}

// ── Activity feed (GET /admin/activity) ───────────────────────
export interface ActivityItem {
  id:                number;
  title:             string;
  message:           string;
  notification_type: string;
  created_at:        string | null;
}

// ── User management (GET /admin/users) ───────────────────────
export interface AdminUser {
  id:          number;
  username:    string;
  full_name:   string | null;
  email:       string | null;
  role:        UserRole;
  is_active:   boolean;
  created_at:  string | null;
  // Profile fields (present for student/faculty, null for admin/absent)
  section_id?:  number | null;
  semester?:    number | null;
  department?:  string | null;
  designation?: string | null;
}
export interface UserStatusUpdate {
  is_active: boolean;
}

// ── Sections (GET /sections/) ─────────────────────────────────
export interface SectionItem {
  id:                  number;
  name:                string;
  department:          string;
  semester:            number;
  academic_year:       string;
  incharge_faculty_id: number | null;
  max_strength:        number;
}
export interface SectionCreateRequest {
  name:                string;
  department:          string;
  semester:            number;
  academic_year:       string;
  incharge_faculty_id: number | null;
  max_strength:        number;
}

// ── Announcement ──────────────────────────────────────────────
export type AnnouncementAudience = 'all' | 'student' | 'faculty';
export interface AnnouncementRequest {
  title:             string;
  message:           string;
  audience:          AnnouncementAudience;
  notification_type: string;
}
export interface AnnouncementResponse {
  recipients_count: number;
  message:          string;
}

// ── Aggregate hook return types ───────────────────────────────
export type LoadState = 'idle' | 'loading' | 'success' | 'error';

export interface AdminDashboardState {
  dashboard:  AdminDashboardData | null;
  analytics:  InstitutionAnalytics | null;
  trends:     TrendsData | null;
  activity:   ActivityItem[];
  isLoading:  boolean;
  error:      string | null;
  refetch:    () => void;
}

export interface SystemHealthState {
  health:      SystemHealth | null;
  isLoading:   boolean;
  lastUpdated: Date | null;
  error:       string | null;
}

// ── User CRUD payloads ────────────────────────────────────────
export interface CreateUserPayload {
  full_name:      string;
  username:       string;
  email?:         string;
  password:       string;
  role:           UserRole;
  // student
  department?:    string;
  semester?:      number;
  section_id?:    number | null;
  admission_year?: number;
  // faculty
  designation?:   string;
}

export interface UpdateUserPayload {
  full_name?:   string;
  email?:       string;
  // student profile
  section_id?:  number | null;   // null = unassign; absent = no change
  semester?:    number;
  // faculty profile
  department?:  string;
  designation?: string;
}

export interface ResetPasswordPayload {
  new_password: string;
}

export interface DeleteUserResponse {
  user_id: number;
  message: string;
}

// ── Departments / designations for dropdowns ──────────────────
export interface DeptOption {
  value: string;
  label: string;
}
export interface DepartmentsData {
  departments:  DeptOption[];
  designations: DeptOption[];
}

// ── User management hook state ────────────────────────────────
export interface UserManagementState {
  users:         AdminUser[];
  isLoading:     boolean;
  error:         string | null;
  total:         number;
  page:          number;
  search:        string;
  roleFilter:    UserRole | 'all';
  statusFilter:  'all' | 'active' | 'inactive';
  setPage:       (p: number) => void;
  setSearch:     (s: string) => void;
  setRoleFilter: (r: UserRole | 'all') => void;
  setStatusFilter: (s: 'all' | 'active' | 'inactive') => void;
  toggleStatus:  (id: number, current: boolean) => void;
  createUser:    (payload: CreateUserPayload) => Promise<AdminUser>;
  updateUser:    (id: number, payload: UpdateUserPayload) => Promise<AdminUser>;
  resetPassword: (id: number, newPassword: string) => Promise<void>;
  deleteUser:    (id: number) => Promise<void>;
  refetch:       () => void;
}
