# =============================================================
# routes/faculty_assignment.py — Faculty Assignment API Endpoints
# =============================================================
# ROUTE MAP:
#   POST   /admin/faculty-assignments             [admin]   create
#   GET    /admin/faculty-assignments             [admin]   list (with filters)
#   DELETE /admin/faculty-assignments/{id}        [admin]   remove
#   GET    /faculty/me/assignments                [faculty] own assignments
#
# The /admin/ prefix routes are thin wrappers over the service.
# The /faculty/ prefix route lives here (not in faculty.py) to
# keep all assignment logic in one file.
#
# ORDERING NOTE:
#   /faculty/me/assignments MUST be registered BEFORE any /{id}
#   pattern in the faculty router. Since this router has no /{id}
#   routes, there is no ordering conflict here. The main.py include
#   order is: faculty_router BEFORE faculty_assignment_router, so
#   /faculty/me (existing) is resolved first, then /faculty/me/assignments.
# =============================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.connection import get_db
from backend.auth.dependencies import get_current_admin, get_current_faculty
from backend.models.user import User
from backend.schemas.faculty_assignment import (
    FacultyAssignmentCreate,
    FacultyAssignmentResponse,
    AssignedSectionBrief,
)
from backend.services.faculty_assignment_service import (
    create_assignment,
    list_assignments,
    delete_assignment,
    get_faculty_assignments,
)

router = APIRouter(tags=["Faculty Assignments"])


# ---------------------------------------------------------------
# POST /admin/faculty-assignments — Assign faculty to section+subject
# ---------------------------------------------------------------
@router.post(
    "/admin/faculty-assignments",
    response_model=FacultyAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin assigns a faculty member to teach a subject in a section",
)
def create_assignment_route(
    data: FacultyAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return create_assignment(db, data, current_user.id)


# ---------------------------------------------------------------
# GET /admin/faculty-assignments — List all assignments (admin only)
# ---------------------------------------------------------------
@router.get(
    "/admin/faculty-assignments",
    response_model=List[FacultyAssignmentResponse],
    summary="List all faculty-section assignments with optional filters (Admin only)",
)
def list_assignments_route(
    faculty_id: Optional[int] = Query(None, description="Filter by faculty ID"),
    section_id: Optional[int] = Query(None, description="Filter by section ID"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return list_assignments(db, faculty_id=faculty_id, section_id=section_id)


# ---------------------------------------------------------------
# DELETE /admin/faculty-assignments/{assignment_id} — Remove
# ---------------------------------------------------------------
@router.delete(
    "/admin/faculty-assignments/{assignment_id}",
    summary="Remove a faculty-section assignment (Admin only)",
)
def delete_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return delete_assignment(db, assignment_id)


# ---------------------------------------------------------------
# GET /faculty/me/assignments — Faculty's own section+subject list
# ---------------------------------------------------------------
# This is the source for EVERY section/subject dropdown in faculty UI:
#   - Attendance: "A • Sem 3 • CSE • Data Structures"
#   - Notes upload section selector
#   - Test creation section selector
#
# Returning full display_label avoids client-side string building.
# ---------------------------------------------------------------
@router.get(
    "/faculty/me/assignments",
    response_model=List[AssignedSectionBrief],
    summary="Faculty views all their authorised section+subject assignments",
)
def get_my_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    return get_faculty_assignments(db, current_user.id)
