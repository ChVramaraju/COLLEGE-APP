// ============================================================
// types/placement.ts — Placement Module Type Contracts
// ============================================================
// Every interface mirrors the corresponding backend Pydantic
// schema in backend/schemas/placement.py exactly.
// ============================================================

// ── Enums ────────────────────────────────────────────────────
export type ApplicationStatus =
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'selected'
  | 'rejected'
  | 'withdrawn';

// ── Job Posting ───────────────────────────────────────────────
export interface JobPosting {
  id:                   number;
  company_name:         string;
  role_title:           string;
  description:          string | null;
  location:             string | null;
  package_lpa:          number | null;
  allowed_departments:  string | null;  // "cse,ece,it"  null = all
  min_cgpa:             number;
  min_attendance_pct:   number;
  is_active:            boolean;
  is_open:              boolean;
  application_deadline: string | null;  // ISO datetime string
  created_at:           string | null;
  total_applications:   number | null;
  is_eligible:          boolean | null; // null for non-student viewers
}

export interface JobPostingCreate {
  company_name:         string;
  role_title:           string;
  description:          string;
  location:             string;
  package_lpa:          number | null;
  allowed_departments:  string | null;
  min_cgpa:             number;
  min_attendance_pct:   number;
  application_deadline: string | null;
}

// ── Application ───────────────────────────────────────────────
export interface PlacementApplication {
  id:             number;
  student_id:     number;
  job_posting_id: number;
  status:         ApplicationStatus;
  remarks:        string | null;
  applied_at:     string | null;
  updated_at:     string | null;
  // Denormalised join fields
  company_name:   string | null;
  role_title:     string | null;
  package_lpa:    number | null;
  roll_number:    string | null;
  student_name:   string | null;
}

export interface ApplicationStatusUpdate {
  status:  ApplicationStatus;
  remarks: string | null;
}

// ── Analytics ─────────────────────────────────────────────────
export interface PlacementFunnelStats {
  total_applied: number;
  under_review:  number;
  shortlisted:   number;
  selected:      number;
  rejected:      number;
  withdrawn:     number;
}

export interface DepartmentPlacementStats {
  department:          string;
  total_students:      number;
  placed_count:        number;
  placement_rate:      number;
  avg_package_lpa:     number | null;
  highest_package_lpa: number | null;
}

export interface CompanyStats {
  company_name:       string;
  total_openings:     number;
  total_applications: number;
  students_placed:    number;
}

export interface PlacementAnalytics {
  total_job_postings:      number;
  active_postings:         number;
  total_applications:      number;
  total_placed_students:   number;
  overall_placement_rate:  number;
  avg_package_lpa:         number | null;
  highest_package_lpa:     number | null;
  funnel:                  PlacementFunnelStats;
  by_department:           DepartmentPlacementStats[];
  top_companies:           CompanyStats[];
}

// ── Frontend filter + derived types ───────────────────────────
export interface PlacementFilters {
  search:           string;
  eligibleOnly:     boolean;
  minPackage:       number | '';
  maxPackage:       number | '';
  department:       string;   // "" = all
}

export const EMPTY_PLACEMENT_FILTERS: PlacementFilters = {
  search: '', eligibleOnly: false, minPackage: '', maxPackage: '', department: '',
};

// Student summary stats derived from applications
export interface StudentPlacementStats {
  total:       number;
  applied:     number;
  shortlisted: number;
  selected:    number;
  rejected:    number;
  withdrawn:   number;
}

// Departments enum values (must match backend enums.py)
export const DEPARTMENTS = [
  { value: 'cse',   label: 'CSE'   },
  { value: 'ece',   label: 'ECE'   },
  { value: 'mech',  label: 'Mech'  },
  { value: 'civil', label: 'Civil' },
  { value: 'eee',   label: 'EEE'   },
  { value: 'it',    label: 'IT'    },
  { value: 'aids',  label: 'AI&DS' },
] as const;
