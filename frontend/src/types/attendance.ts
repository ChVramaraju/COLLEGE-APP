// ============================================================
// types/attendance.ts — Attendance Module Type Contracts
// ============================================================
// Three categories of types:
//
//  1. API TYPES — mirrors exact backend Pydantic schema fields
//  2. FILTER TYPES — user-controlled filter state shapes
//  3. COMPUTED TYPES — chart-ready data, transformed in the hook
//     These DO NOT come from the backend. The hook builds them
//     from raw API data. Keeping them here documents their shape.
// ============================================================

// ---------------------------------------------------------------
// CATEGORY 1: API TYPES (mirror backend schemas exactly)
// ---------------------------------------------------------------

// AttendanceStatus values from backend enums.py
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// Mirrors: schemas/attendance.py → AttendanceResponse
export interface AttendanceRecord {
  id: number;
  student_id: number;
  faculty_id: number | null;
  section_id: number;
  subject: string;
  attendance_date: string;       // ISO date string: "2025-01-15"
  period_number: number;
  status: AttendanceStatus;
  remarks: string | null;
}

// Mirrors: schemas/attendance.py → SubjectBreakdown
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

// Mirrors: schemas/attendance.py → StudentAttendanceAnalytics
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
// CATEGORY 2: FILTER TYPES
// ---------------------------------------------------------------
export interface AttendanceFilters {
  subject: string;                           // '' = all subjects
  status:  AttendanceStatus | '';            // '' = all statuses
  fromDate: string;                          // '' = no lower bound
  toDate:   string;                          // '' = no upper bound
}

export const DEFAULT_FILTERS: AttendanceFilters = {
  subject:  '',
  status:   '',
  fromDate: '',
  toDate:   '',
};

// ---------------------------------------------------------------
// CATEGORY 3: COMPUTED / CHART TYPES
// These shapes are built by the hook from raw API data.
// Recharts consumes these — NOT the raw API types directly.
// ---------------------------------------------------------------

// One point in the monthly attendance trend line chart
// Built by: grouping AttendanceRecord[] by calendar month
export interface MonthlyTrendPoint {
  month:      string;   // "Jan '25", "Feb '25" — X axis label
  present:    number;   // count of present+late records in that month
  absent:     number;   // count of absent records
  total:      number;   // total records in that month
  percentage: number;   // (present / total) * 100, rounded to 1dp
}

// One bar in the subject comparison bar chart
// Built by: mapping analytics.subject_breakdown[]
export interface SubjectComparisonPoint {
  subject:    string;   // shortened for X axis (≤12 chars)
  percentage: number;   // attendance %
  present:    number;
  total:      number;
  isBelowThreshold: boolean;
}

// Quick insight stats — computed from analytics
export interface AttendanceInsights {
  bestSubject:  { name: string; percentage: number } | null;
  worstSubject: { name: string; percentage: number } | null;
  subjectsAtRisk:      number;   // count below threshold
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  trendDelta: number;            // % change over last 2 months
}


// ---------------------------------------------------------------
// CATEGORY 4: FACULTY-SIDE TYPES
// Mirror backend schemas/attendance.py faculty additions.
// ---------------------------------------------------------------

// Mirrors: AttendanceStudentBrief — student row in mark-attendance form
export interface AttendanceStudentBrief {
  id:          number;
  roll_number: string;
  full_name:   string;
  semester:    number;
}

// Mirrors: AttendanceSessionSummary — one grouped session in history
export interface AttendanceSessionSummary {
  section_id:      number;
  section_name:    string;
  subject:         string;
  attendance_date: string;   // ISO date "YYYY-MM-DD"
  period_number:   number;
  total:           number;
  present:         number;
  absent:          number;
  late:            number;
}

// Per-student entry sent in BulkMarkPayload.entries
export interface MarkAttendanceEntry {
  student_id: number;
  status:     AttendanceStatus;
  remarks:    string;
}

// Mirrors: AttendanceBulkMarkRequest — POST /attendance/mark body
export interface BulkMarkPayload {
  section_id:      number;
  subject:         string;
  attendance_date: string;   // ISO date
  period_number:   number;
  entries: Array<{
    student_id: number;
    status:     AttendanceStatus;
    remarks?:   string;
  }>;
}

// Mirrors: AttendanceBulkMarkResponse — response from POST /attendance/mark
export interface BulkMarkResult {
  message:         string;
  section_id:      number;
  subject:         string;
  attendance_date: string;
  period_number:   number;
  records_created: number;
  present_count:   number;
  absent_count:    number;
}

// Mirrors: UpdateAttendanceEntry — PATCH /attendance/{id} body
export interface UpdateAttendancePayload {
  status:  AttendanceStatus;
  remarks: string | null;
}

// Local state shape for the mark-attendance student row
export interface StudentMarkRow {
  student:  AttendanceStudentBrief;
  status:   AttendanceStatus;
  remarks:  string;
}

// Session form values used in the "setup" step of mark attendance
export interface SessionFormValues {
  section_id:      number | '';
  subject:         string;
  attendance_date: string;   // "YYYY-MM-DD"
  period_number:   number | '';
}

export const DEFAULT_SESSION_FORM: SessionFormValues = {
  section_id:      '',
  subject:         '',
  attendance_date: new Date().toISOString().slice(0, 10),
  period_number:   '',
};


// ---------------------------------------------------------------
// CATEGORY 5: STUDENT DASHBOARD — Derived / computed types
// ---------------------------------------------------------------

// Health badge derived from overall attendance %
// > 90 = excellent | > 75 = safe | > 65 = warning | ≤ 65 = critical
export type HealthBadge = 'excellent' | 'safe' | 'warning' | 'critical';

// Computed from raw records (not analytics) — includes per-status counts
export interface OverallStats {
  total:         number;
  present:       number;   // pure present (excludes late)
  absent:        number;
  late:          number;
  excused:       number;
  presentAndLate: number;  // present + late (used for % calc)
  percentage:    number;   // (present + late) / total × 100
}

// One data point in the weekly attendance area chart
export interface WeeklyTrendPoint {
  week:       string;   // display label e.g. "Apr W3"
  present:    number;   // present + late (counts as attended)
  absent:     number;
  late:       number;
  total:      number;
  percentage: number;
  sortKey:    string;   // "YYYY-WW" for stable ordering
}

// Aggregated data for one day cell in the monthly calendar
export interface CalendarDayData {
  date:         string;                     // "YYYY-MM-DD"
  dominant:     AttendanceStatus | 'none';  // drive cell colour
  records:      AttendanceRecord[];
  presentCount: number;
  absentCount:  number;
  lateCount:    number;
}

// One segment in the P/A/L/E pie chart
export interface AttendancePiePoint {
  name:  string;
  value: number;
  color: string;
}


// ---------------------------------------------------------------
// CATEGORY 6: ADMIN ANALYTICS TYPES
// Mirrors backend schemas/attendance.py admin additions.
// ---------------------------------------------------------------

// Mirrors: DepartmentAttendanceSummary
export interface DepartmentAttendanceSummary {
  department:           string;   // uppercase e.g. "CSE"
  total_sections:       number;
  total_students:       number;
  total_sessions:       number;
  avg_percentage:       number;
  low_attendance_count: number;
}

// Mirrors: FacultyActivityItem
export interface FacultyActivityItem {
  faculty_id:        number;
  faculty_name:      string;
  total_sessions:    number;
  last_marked_date:  string | null;   // ISO date "YYYY-MM-DD"
}

// Mirrors: AdminAttendanceAnalytics
export interface AdminAttendanceAnalytics {
  total_sessions:          number;
  total_records:           number;
  overall_avg_percentage:  number;
  low_attendance_total:    number;
  department_summaries:    DepartmentAttendanceSummary[];
  faculty_activity:        FacultyActivityItem[];
  generated_at:            string;   // ISO datetime
}
