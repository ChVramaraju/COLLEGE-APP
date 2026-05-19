# =============================================================
# services/faculty_assignment_service.py — Assignment Business Logic
# =============================================================
# This service is the GATEWAY for all faculty-section ownership.
#
# KEY FUNCTIONS:
#   create_assignment()       — Admin creates a new assignment
#   list_assignments()        — Admin lists all / filtered assignments
#   delete_assignment()       — Admin removes an assignment
#   get_faculty_assignments() — Faculty fetches their own assignments
#                               (for section+subject dropdowns)
#   verify_faculty_assignment() — Permission check used by
#                               attendance, notes, test services
#   get_faculty_sections()    — Returns unique sections (for tests/notes)
#
# SUBJECT NORMALIZATION:
#   Subject strings are stored in Title Case.
#   The normalize_subject() helper ensures consistency across:
#     → Assignment creation
#     → Attendance marking (already has a Pydantic validator)
#     → The permission check (compares normalized strings)
# =============================================================

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
from typing import Optional

from backend.models.faculty_assignment import FacultySectionAssignment
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.user import User
from backend.schemas.faculty_assignment import (
    FacultyAssignmentCreate,
    FacultyAssignmentResponse,
    AssignedSectionBrief,
)


# ---------------------------------------------------------------
# INTERNAL: Normalize subject string
# ---------------------------------------------------------------
def _normalize_subject(s: str) -> str:
    return s.strip().title()


# ---------------------------------------------------------------
# INTERNAL: Build FacultyAssignmentResponse from ORM objects
# ---------------------------------------------------------------
def _build_response(
    assignment: FacultySectionAssignment,
    faculty: Faculty,
    section: Section,
) -> FacultyAssignmentResponse:
    return FacultyAssignmentResponse(
        id=assignment.id,
        faculty_id=assignment.faculty_id,
        section_id=assignment.section_id,
        subject=assignment.subject,
        semester=assignment.semester,
        assigned_by_admin_id=assignment.assigned_by_admin_id,
        created_at=assignment.created_at,
        section_name=section.name,
        section_department=section.department.value,
        section_academic_year=section.academic_year,
        faculty_name=faculty.user.full_name if faculty.user else f"Faculty #{faculty.id}",
        faculty_employee_id=faculty.employee_id,
    )


# ---------------------------------------------------------------
# CREATE ASSIGNMENT — Admin only
# ---------------------------------------------------------------
def create_assignment(
    db: Session,
    data: FacultyAssignmentCreate,
    admin_user_id: int,
) -> FacultyAssignmentResponse:
    """
    Assigns a faculty member to teach a specific subject in a section.

    VALIDATION:
    1. Faculty must exist
    2. Section must exist
    3. (faculty, section, subject) combination must be unique → 409 on duplicate

    NORMALIZATION:
    Subject is strip+title-cased to match the Attendance.subject
    normalization applied by the Pydantic AttendanceBulkMarkRequest validator.
    This guarantees verify_faculty_assignment() comparisons work correctly.
    """
    # --- Validate faculty ---
    faculty = (
        db.query(Faculty)
        .options(joinedload(Faculty.user))
        .filter(Faculty.id == data.faculty_id)
        .first()
    )
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty ID {data.faculty_id} not found.",
        )

    # --- Validate section ---
    section = db.query(Section).filter(Section.id == data.section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {data.section_id} not found.",
        )

    normalized_subject = _normalize_subject(data.subject)

    # --- Check for duplicate ---
    existing = db.query(FacultySectionAssignment).filter(
        FacultySectionAssignment.faculty_id == data.faculty_id,
        FacultySectionAssignment.section_id == data.section_id,
        FacultySectionAssignment.subject == normalized_subject,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Assignment already exists: Faculty {faculty.employee_id} "
                f"is already assigned to teach '{normalized_subject}' "
                f"in section {section.name}."
            ),
        )

    assignment = FacultySectionAssignment(
        faculty_id=data.faculty_id,
        section_id=data.section_id,
        subject=normalized_subject,
        semester=data.semester,
        assigned_by_admin_id=admin_user_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return _build_response(assignment, faculty, section)


# ---------------------------------------------------------------
# LIST ASSIGNMENTS — Admin view with optional filters
# ---------------------------------------------------------------
def list_assignments(
    db: Session,
    faculty_id: Optional[int] = None,
    section_id: Optional[int] = None,
) -> list[FacultyAssignmentResponse]:
    """
    Returns all assignments, eagerly loading faculty+user and section
    so the response can be flattened in one pass.

    Optional filters: faculty_id, section_id (can combine).
    """
    q = (
        db.query(FacultySectionAssignment)
        .options(
            joinedload(FacultySectionAssignment.faculty).joinedload(Faculty.user),
            joinedload(FacultySectionAssignment.section),
        )
    )
    if faculty_id is not None:
        q = q.filter(FacultySectionAssignment.faculty_id == faculty_id)
    if section_id is not None:
        q = q.filter(FacultySectionAssignment.section_id == section_id)

    assignments = (
        q.order_by(
            FacultySectionAssignment.section_id,
            FacultySectionAssignment.subject,
        )
        .all()
    )

    return [_build_response(a, a.faculty, a.section) for a in assignments]


# ---------------------------------------------------------------
# DELETE ASSIGNMENT — Admin only
# ---------------------------------------------------------------
def delete_assignment(db: Session, assignment_id: int) -> dict:
    """
    Removes a faculty-section-subject assignment.
    Does NOT delete any attendance/notes/test records — those are
    historical data and remain intact.
    """
    assignment = (
        db.query(FacultySectionAssignment)
        .filter(FacultySectionAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment ID {assignment_id} not found.",
        )

    db.delete(assignment)
    db.commit()
    return {
        "message": f"Assignment {assignment_id} removed successfully.",
        "id": assignment_id,
    }


# ---------------------------------------------------------------
# GET FACULTY ASSIGNMENTS — Faculty's own dropdown data
# ---------------------------------------------------------------
def get_faculty_assignments(
    db: Session,
    faculty_user_id: int,
) -> list[AssignedSectionBrief]:
    """
    Returns all (section, subject) pairs this faculty is authorised to teach.

    Used by every faculty module as the section+subject dropdown:
      - Mark Attendance: pre-fills both section_id and subject
      - Notes upload: section selector
      - Test creation: section selector

    display_label is pre-built for <select> option rendering:
      "A • Sem 3 • CSE • Data Structures"
    """
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found for this account.",
        )

    assignments = (
        db.query(FacultySectionAssignment)
        .options(joinedload(FacultySectionAssignment.section))
        .filter(FacultySectionAssignment.faculty_id == faculty.id)
        .order_by(
            FacultySectionAssignment.semester,
            FacultySectionAssignment.section_id,
            FacultySectionAssignment.subject,
        )
        .all()
    )

    result = []
    for a in assignments:
        s = a.section
        dept_upper = s.department.value.upper()
        label = f"{s.name} \u2022 Sem {s.semester} \u2022 {dept_upper} \u2022 {a.subject}"
        result.append(
            AssignedSectionBrief(
                assignment_id=a.id,
                section_id=a.section_id,
                section_name=s.name,
                department=s.department.value,
                semester=s.semester,
                academic_year=s.academic_year,
                subject=a.subject,
                display_label=label,
            )
        )
    return result


# ---------------------------------------------------------------
# GET FACULTY SECTIONS — Unique sections (for test/notes dropdowns)
# ---------------------------------------------------------------
def get_faculty_sections_from_assignments(
    db: Session,
    faculty_user_id: int,
) -> list[Section]:
    """
    Returns the unique set of sections this faculty teaches in.
    Used by GET /faculty/me/sections — which now reads from assignments
    instead of the old incharge_faculty_id column.

    WHY deduplicate?
    A faculty might teach Data Structures AND Operating Systems in
    Section A, Sem 3, CSE — two assignment rows but ONE section.
    For a section dropdown (without subject context) we deduplicate.
    """
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found for this account.",
        )

    # Get distinct section IDs from assignments
    section_id_rows = (
        db.query(FacultySectionAssignment.section_id)
        .filter(FacultySectionAssignment.faculty_id == faculty.id)
        .distinct()
        .all()
    )
    section_ids = [row.section_id for row in section_id_rows]

    if not section_ids:
        return []

    sections = (
        db.query(Section)
        .filter(Section.id.in_(section_ids))
        .order_by(Section.semester, Section.name)
        .all()
    )
    return sections


# ---------------------------------------------------------------
# VERIFY ASSIGNMENT — Permission check for all faculty actions
# ---------------------------------------------------------------
def verify_faculty_assignment(
    db: Session,
    faculty_id: int,
    section_id: int,
    subject: str,
) -> bool:
    """
    Returns True if this faculty has an active assignment for
    (section_id, subject). Subject comparison is case-insensitive
    because both sides normalize with .strip().title().

    Called by:
      - attendance_service.mark_attendance_bulk()
      - notes_service (future phase)
      - test_service (future phase)

    If this returns False → the caller raises HTTP 403.
    """
    normalized = _normalize_subject(subject)
    assignment = (
        db.query(FacultySectionAssignment)
        .filter(
            FacultySectionAssignment.faculty_id == faculty_id,
            FacultySectionAssignment.section_id == section_id,
            FacultySectionAssignment.subject == normalized,
        )
        .first()
    )
    return assignment is not None
