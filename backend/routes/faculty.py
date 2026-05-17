# =============================================================
# routes/faculty.py — Faculty API Endpoints
# =============================================================
# Same thin-route architecture as student.py.
#
# IMPORTANT ORDERING RULE (same as student.py):
#   GET /faculty/me          ← MUST be before /{faculty_id}
#   GET /faculty/me/sections ← MUST be before /{faculty_id}
#   GET /faculty/            ← list (admin)
#   GET /faculty/{faculty_id} ← by ID (admin)
# =============================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_admin,
    get_current_faculty,
    get_current_user,
)
from backend.models.user import User
from backend.schemas.faculty import (
    FacultyCreate,
    FacultyUpdate,
    FacultyResponse,
    FacultyDetailResponse,
    SectionBriefForFaculty,
)
from backend.schemas.section import SectionResponse
from backend.services.faculty_service import (
    create_faculty,
    get_faculty_by_id,
    get_faculty_by_user_id,
    update_faculty,
    get_assigned_sections,
    list_all_faculty,
    deactivate_faculty,
)

router = APIRouter(
    prefix="/faculty",
    tags=["Faculty"],
)


# ---------------------------------------------------------------
# POST /faculty/ — Create Faculty (Admin only)
# ---------------------------------------------------------------
@router.post(
    "/",
    response_model=FacultyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new faculty member (Admin only)",
)
def create_faculty_route(
    data: FacultyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return create_faculty(db, data)


# ---------------------------------------------------------------
# GET /faculty/me — Faculty Views Own Profile (Faculty only)
# ---------------------------------------------------------------
# MUST be declared before GET /faculty/{faculty_id}
#
# Flow:
#   JWT → get_current_faculty → User object
#   → get_faculty_by_user_id(user.id) → Faculty object
#   → _build_faculty_detail → FacultyDetailResponse
# ---------------------------------------------------------------
@router.get(
    "/me",
    response_model=FacultyDetailResponse,
    summary="Faculty views their own profile",
)
def get_my_faculty_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    faculty = get_faculty_by_user_id(db, current_user.id)
    return _build_faculty_detail(faculty)


# ---------------------------------------------------------------
# GET /faculty/me/sections — Faculty's Assigned Sections
# ---------------------------------------------------------------
# MUST be declared before GET /faculty/{faculty_id}
#
# Faculty can only see their OWN sections — not other faculty's.
# The JWT identifies them → we look up their faculty_id → load sections.
#
# Why not let faculty pass any faculty_id?
# → That would let Faculty A spy on Faculty B's section assignments.
# → "me" endpoints enforce the ownership rule at the route level.
# ---------------------------------------------------------------
@router.get(
    "/me/sections",
    response_model=List[SectionResponse],
    summary="Faculty views their assigned sections",
)
def get_my_sections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    faculty = get_faculty_by_user_id(db, current_user.id)
    return get_assigned_sections(db, faculty.id)


# ---------------------------------------------------------------
# GET /faculty/ — List All Faculty (Admin only)
# ---------------------------------------------------------------
@router.get(
    "/",
    response_model=List[FacultyResponse],
    summary="List all faculty members, paginated (Admin only)",
)
def list_faculty_route(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return list_all_faculty(db, skip=skip, limit=limit)


# ---------------------------------------------------------------
# GET /faculty/{faculty_id} — Get Faculty by ID (Admin only)
# ---------------------------------------------------------------
@router.get(
    "/{faculty_id}",
    response_model=FacultyDetailResponse,
    summary="Get faculty profile by ID (Admin only)",
)
def get_faculty_by_id_route(
    faculty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    faculty = get_faculty_by_id(db, faculty_id)
    return _build_faculty_detail(faculty)


# ---------------------------------------------------------------
# PATCH /faculty/{faculty_id} — Update Faculty (Admin only)
# ---------------------------------------------------------------
@router.patch(
    "/{faculty_id}",
    response_model=FacultyResponse,
    summary="Update faculty profile (Admin only)",
)
def update_faculty_route(
    faculty_id: int,
    data: FacultyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return update_faculty(db, faculty_id, data)


# ---------------------------------------------------------------
# DELETE /faculty/{faculty_id} — Deactivate Faculty (Admin only)
# ---------------------------------------------------------------
@router.delete(
    "/{faculty_id}",
    summary="Deactivate a faculty account (Admin only)",
)
def deactivate_faculty_route(
    faculty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return deactivate_faculty(db, faculty_id)


# =============================================================
# RESPONSE BUILDER HELPER
# =============================================================
def _build_faculty_detail(faculty) -> FacultyDetailResponse:
    return FacultyDetailResponse(
        id=faculty.id,
        employee_id=faculty.employee_id,
        department=faculty.department,
        designation=faculty.designation,
        specialization=faculty.specialization,
        phone=faculty.phone,
        joining_date=faculty.joining_date,
        full_name=faculty.user.full_name if faculty.user else None,
        email=faculty.user.email if faculty.user else None,
        is_active=faculty.user.is_active if faculty.user else None,
        sections_in_charge=[
            SectionBriefForFaculty.model_validate(s)
            for s in faculty.sections_in_charge
        ],
    )
