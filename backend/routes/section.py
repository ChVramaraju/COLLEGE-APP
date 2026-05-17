# =============================================================
# routes/section.py — Section API Endpoints
# =============================================================
# Section routes wire together section and student data.
# Key endpoints:
#   → Admin creates/manages sections
#   → Admin assigns faculty incharge
#   → Admin and faculty view section details + student roster
#
# ACCESS PATTERN:
#   Admin → full CRUD
#   Faculty → read-only (their section views)
#   Student → no direct section access (they see it in /students/me)
# =============================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_admin,
    get_current_user,
)
from backend.models.user import User, UserRole
from backend.schemas.section import (
    SectionCreate,
    SectionUpdate,
    SectionResponse,
    SectionDetailResponse,
    FacultyBriefForSection,
    StudentBriefForSection,
)
from backend.services.section_service import (
    create_section,
    get_section_by_id,
    assign_incharge_faculty,
    update_section,
    get_section_students,
    get_section_detail,
    list_sections,
)

router = APIRouter(
    prefix="/sections",
    tags=["Sections"],
)


# ---------------------------------------------------------------
# POST /sections/ — Create Section (Admin only)
# ---------------------------------------------------------------
@router.post(
    "/",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new academic section (Admin only)",
)
def create_section_route(
    data: SectionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return create_section(db, data)


# ---------------------------------------------------------------
# GET /sections/ — List Sections with Filters (Admin + Faculty)
# ---------------------------------------------------------------
# Query parameters let the client filter:
#   GET /sections/?department=cse&semester=3&academic_year=2024-25
#   GET /sections/?department=ece
#   GET /sections/
#
# Optional[str] with Query() = optional URL query parameter.
# FastAPI parses these automatically from the URL.
# ---------------------------------------------------------------
@router.get(
    "/",
    response_model=List[SectionResponse],
    summary="List sections with optional filters (Admin or Faculty)",
)
def list_sections_route(
    department: Optional[str] = Query(None, description="Filter by department code"),
    semester: Optional[int] = Query(None, ge=1, le=8, description="Filter by semester"),
    academic_year: Optional[str] = Query(None, description="Filter by year (e.g., 2024-25)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    return list_sections(db, department, semester, academic_year, skip, limit)


# ---------------------------------------------------------------
# GET /sections/{section_id} — Get Section (Admin + Faculty)
# ---------------------------------------------------------------
@router.get(
    "/{section_id}",
    response_model=SectionResponse,
    summary="Get section by ID (Admin or Faculty)",
)
def get_section_route(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    return get_section_by_id(db, section_id)


# ---------------------------------------------------------------
# GET /sections/{section_id}/full — Section with Roster
# ---------------------------------------------------------------
# Returns complete section context: incharge faculty + student list.
# Used by admin dashboard and faculty class view.
# ---------------------------------------------------------------
@router.get(
    "/{section_id}/full",
    response_model=SectionDetailResponse,
    summary="Get full section details with faculty and students (Admin or Faculty)",
)
def get_section_detail_route(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    result = get_section_detail(db, section_id)
    return _build_section_detail(result["section"], result["students"])


# ---------------------------------------------------------------
# PATCH /sections/{section_id} — Update Section (Admin only)
# ---------------------------------------------------------------
@router.patch(
    "/{section_id}",
    response_model=SectionResponse,
    summary="Update section metadata (Admin only)",
)
def update_section_route(
    section_id: int,
    data: SectionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return update_section(db, section_id, data)


# ---------------------------------------------------------------
# POST /sections/{section_id}/assign-faculty — Assign Incharge
# ---------------------------------------------------------------
# Dedicated endpoint for faculty assignment.
# Not a PATCH — this is a specific business action with its own
# validation rules (department alignment check).
# Using a named action endpoint makes the API intent explicit.
# ---------------------------------------------------------------
@router.post(
    "/{section_id}/assign-faculty",
    response_model=SectionResponse,
    summary="Assign a faculty as section incharge (Admin only)",
)
def assign_faculty_route(
    section_id: int,
    faculty_id: int = Query(..., description="ID of the faculty to assign as incharge"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return assign_incharge_faculty(db, section_id, faculty_id)


# ---------------------------------------------------------------
# GET /sections/{section_id}/students — Section Student Roster
# ---------------------------------------------------------------
@router.get(
    "/{section_id}/students",
    response_model=List[StudentBriefForSection],
    summary="Get all active students in a section (Admin or Faculty)",
)
def get_section_students_route(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    return get_section_students(db, section_id)


# =============================================================
# RESPONSE BUILDER HELPER
# =============================================================
def _build_section_detail(section, students) -> SectionDetailResponse:
    faculty_brief = None
    if section.incharge_faculty:
        fac = section.incharge_faculty
        faculty_brief = FacultyBriefForSection(
            id=fac.id,
            employee_id=fac.employee_id,
            full_name=fac.user.full_name if fac.user else None,
        )
    return SectionDetailResponse(
        id=section.id,
        name=section.name,
        department=section.department,
        semester=section.semester,
        academic_year=section.academic_year,
        max_strength=section.max_strength,
        incharge_faculty=faculty_brief,
        students=[StudentBriefForSection.model_validate(s) for s in students],
    )
