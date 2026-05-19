// ============================================================
// services/facultyAssignmentService.ts — Assignment API Layer
// ============================================================
// Four functions covering the complete assignment lifecycle:
//
//   createFacultyAssignment()    — admin creates
//   listFacultyAssignments()     — admin lists (with optional filters)
//   deleteFacultyAssignment()    — admin removes
//   getMyFacultyAssignments()    — faculty views own assignments
//
// getMyFacultyAssignments() is the CRITICAL function.
// It powers the section+subject dropdown in attendance, notes, tests.
// The returned AssignedSectionBrief.display_label is rendered directly
// as <option> text: "A • Sem 3 • CSE • Data Structures"
// ============================================================

import apiClient from '@/api/client';
import type {
  FacultyAssignment,
  FacultyAssignmentCreate,
  AssignedSectionBrief,
} from '@/types/facultyAssignment';


// ---------------------------------------------------------------
// POST /admin/faculty-assignments
// Admin assigns a faculty to teach a subject in a section.
// ---------------------------------------------------------------
export async function createFacultyAssignment(
  data: FacultyAssignmentCreate,
): Promise<FacultyAssignment> {
  const res = await apiClient.post<FacultyAssignment>(
    '/admin/faculty-assignments',
    data,
  );
  return res.data;
}


// ---------------------------------------------------------------
// GET /admin/faculty-assignments?faculty_id=&section_id=
// Admin views all assignments with optional filters.
// ---------------------------------------------------------------
export async function listFacultyAssignments(params?: {
  faculty_id?: number;
  section_id?: number;
}): Promise<FacultyAssignment[]> {
  const res = await apiClient.get<FacultyAssignment[]>(
    '/admin/faculty-assignments',
    { params },
  );
  return res.data;
}


// ---------------------------------------------------------------
// DELETE /admin/faculty-assignments/{id}
// Admin removes an assignment.
// ---------------------------------------------------------------
export async function deleteFacultyAssignment(
  assignmentId: number,
): Promise<void> {
  await apiClient.delete(`/admin/faculty-assignments/${assignmentId}`);
}


// ---------------------------------------------------------------
// GET /faculty/me/assignments
// Faculty fetches their own section+subject dropdown list.
// This replaces getFacultySections() for the attendance flow.
// ---------------------------------------------------------------
export async function getMyFacultyAssignments(): Promise<AssignedSectionBrief[]> {
  const res = await apiClient.get<AssignedSectionBrief[]>(
    '/faculty/me/assignments',
  );
  return res.data;
}


// ---------------------------------------------------------------
// GET /faculty/?limit=200
// Minimal faculty list for the admin assignment create form.
// Returns just id (faculty profile id) + employee_id + department.
// ---------------------------------------------------------------
export interface FacultyBrief {
  id:          number;   // faculty.id — used in FacultyAssignmentCreate.faculty_id
  employee_id: string;
  department:  string;
}

export async function listFacultyForAdmin(): Promise<FacultyBrief[]> {
  const res = await apiClient.get<FacultyBrief[]>('/faculty/', {
    params: { skip: 0, limit: 200 },
  });
  return res.data;
}
