// ============================================================
// types/facultyAssignment.ts — Faculty Assignment Type Contracts
// ============================================================
// Mirrors backend/schemas/faculty_assignment.py exactly.
//
// THREE shapes:
//   FacultyAssignmentCreate  — admin POST body
//   FacultyAssignment        — full response (admin list/create)
//   AssignedSectionBrief     — compact dropdown shape (faculty use)
// ============================================================


// ---------------------------------------------------------------
// CREATE — Admin POST /admin/faculty-assignments
// ---------------------------------------------------------------
export interface FacultyAssignmentCreate {
  faculty_id: number;
  section_id: number;
  subject:    string;
  semester:   number;
}


// ---------------------------------------------------------------
// FULL RESPONSE — from GET /admin/faculty-assignments and POST
// ---------------------------------------------------------------
export interface FacultyAssignment {
  id:                   number;
  faculty_id:           number;
  section_id:           number;
  subject:              string;
  semester:             number;
  assigned_by_admin_id: number | null;
  created_at:           string;    // ISO datetime

  // Flattened from Section
  section_name:         string;    // "A"
  section_department:   string;    // "cse"
  section_academic_year: string;   // "2024-25"

  // Flattened from Faculty → User
  faculty_name:         string;
  faculty_employee_id:  string;
}


// ---------------------------------------------------------------
// ASSIGNED SECTION BRIEF — for faculty dropdowns
// Returned by GET /faculty/me/assignments
// ---------------------------------------------------------------
export interface AssignedSectionBrief {
  assignment_id: number;
  section_id:    number;
  section_name:  string;    // "A"
  department:    string;    // "cse"
  semester:      number;    // 3
  academic_year: string;    // "2024-25"
  subject:       string;    // "Data Structures"
  display_label: string;    // "A • Sem 3 • CSE • Data Structures"
}
