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
