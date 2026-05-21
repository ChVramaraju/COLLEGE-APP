# =============================================================
# routes/faculty_assignment.py — Faculty Assignment Endpoints
# =============================================================
# CRUD for faculty-section-subject teaching assignments.
# Admin-only operations.
# =============================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from backend.database.connection import get_db
from backend.auth.dependencies import get_current_admin
from backend.models.user import User
from backend.services.faculty_assignment_service import (
    create_faculty_assignment,
    get_faculty_assignments,
    get_section_assignments,
    delete_faculty_assignment,
)

router = APIRouter(
    prefix="/faculty-assignments",
    tags=["Faculty Assignments"],
)


# ---------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------
class FacultyAssignmentCreate(BaseModel):
    faculty_id: int
    section_id: int
    subject_id: int


class FacultyAssignmentResponse(BaseModel):
    id: int
    faculty_id: int
    section_id: int
    subject_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------
# POST /faculty-assignments — Create assignment
# ---------------------------------------------------------------
@router.post(
    "/",
    response_model=FacultyAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a faculty member to teach a subject in a section (Admin only)",
)
def create_assignment_route(
    data: FacultyAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return create_faculty_assignment(db, data.faculty_id, data.section_id, data.subject_id)


# ---------------------------------------------------------------
# GET /faculty-assignments/faculty/{faculty_id}
# ---------------------------------------------------------------
@router.get(
    "/faculty/{faculty_id}",
    response_model=List[FacultyAssignmentResponse],
    summary="Get all assignments for a faculty member (Admin only)",
)
def get_faculty_assignments_route(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return get_faculty_assignments(db, faculty_id)


# ---------------------------------------------------------------
# GET /faculty-assignments/section/{section_id}
# ---------------------------------------------------------------
@router.get(
    "/section/{section_id}",
    response_model=List[FacultyAssignmentResponse],
    summary="Get all faculty assignments for a section (Admin only)",
)
def get_section_assignments_route(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return get_section_assignments(db, section_id)


# ---------------------------------------------------------------
# DELETE /faculty-assignments/{assignment_id}
# ---------------------------------------------------------------
@router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a faculty assignment (Admin only)",
)
def delete_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    delete_faculty_assignment(db, assignment_id)
