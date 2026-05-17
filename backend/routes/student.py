# =============================================================
# routes/student.py — Student API Endpoints
# =============================================================
# ROUTE LAYER PHILOSOPHY:
#   These functions are intentionally THIN.
#   Every function follows the same 3-step pattern:
#     1. Dependencies injected automatically (db, current_user)
#     2. Call one service function
#     3. Return with response_model
#
# WHY SO THIN?
#   Business rules change. DB schemas change.
#   When they do, you fix the SERVICE — not every route.
#   If logic lives in routes, you fix 10 places instead of 1.
#
# ROUTE ORDERING WARNING:
#   FastAPI matches routes TOP TO BOTTOM in order of declaration.
#   GET /students/me → must be declared BEFORE GET /students/{id}
#   Otherwise "me" is treated as a student_id value → wrong match.
#   This is one of the most common FastAPI beginner bugs.
# =============================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_admin,
    get_current_faculty,
    get_current_student,
    get_current_user,
)
from backend.models.user import User
from backend.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentDetailResponse,
    SectionSummary,
)
from backend.services.student_service import (
    create_student,
    get_student_by_id,
    get_student_by_roll_number,
    get_student_by_user_id,
    update_student,
    deactivate_student,
    get_students_by_section,
    list_all_students,
)

router = APIRouter(
    prefix="/students",
    tags=["Students"],
    # tags= groups all these routes under "Students" in Swagger UI
    # prefix= means every route below is automatically /students/...
)


# ---------------------------------------------------------------
# POST /students/ — Create Student (Admin only)
# ---------------------------------------------------------------
# Why admin only?
# → Only authorized staff can enroll students into the system.
# → Students cannot self-register — their accounts are provisioned.
# → This is standard institutional security.
#
# response_model=StudentResponse:
# → FastAPI will ONLY return fields defined in StudentResponse.
# → Even if the ORM object has hashed_password, it will NOT appear.
# → This is automatic security serialization — schema as a filter.
# ---------------------------------------------------------------
@router.post(
    "/",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new student (Admin only)",
)
def create_student_route(
    data: StudentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),   # _ = "I need the check, not the value"
):
    return create_student(db, data)


# ---------------------------------------------------------------
# GET /students/me — Student Views Own Profile (Student only)
# ---------------------------------------------------------------
# MUST be declared BEFORE /students/{student_id}
# FastAPI routing is sequential — "me" would match {student_id} otherwise.
#
# How this works:
#   1. get_current_student verifies JWT + checks role == "student"
#   2. Returns the User object from the JWT's user_id
#   3. We use user.id to load the student profile
#   4. Student never needs to know their own DB student_id
# ---------------------------------------------------------------
@router.get(
    "/me",
    response_model=StudentDetailResponse,
    summary="Student views their own profile",
)
def get_my_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    student = get_student_by_user_id(db, current_user.id)
    return _build_student_detail(student)


# ---------------------------------------------------------------
# GET /students/ — List All Students (Admin only)
# ---------------------------------------------------------------
@router.get(
    "/",
    response_model=List[StudentResponse],
    summary="List all students, paginated (Admin only)",
)
def list_students_route(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return list_all_students(db, skip=skip, limit=limit)


# ---------------------------------------------------------------
# GET /students/{student_id} — Get by ID (Admin or Faculty)
# ---------------------------------------------------------------
# Why admin AND faculty?
# → Faculty needs to look up specific students in their section.
# → Admin needs full access for management.
#
# get_current_user (not get_current_admin) then role check:
# → Allows both roles with one endpoint.
# → We don't expose a "faculty or admin" dependency — instead
#   we use get_current_user and add an inline role check.
# ---------------------------------------------------------------
@router.get(
    "/{student_id}",
    response_model=StudentDetailResponse,
    summary="Get student by ID (Admin or Faculty)",
)
def get_student_by_id_route(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from backend.models.user import UserRole

    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    student = get_student_by_id(db, student_id)
    return _build_student_detail(student)


# ---------------------------------------------------------------
# GET /students/roll/{roll_number} — Get by Roll Number
# ---------------------------------------------------------------
@router.get(
    "/roll/{roll_number}",
    response_model=StudentDetailResponse,
    summary="Get student by roll number (Admin or Faculty)",
)
def get_student_by_roll_route(
    roll_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from backend.models.user import UserRole

    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    student = get_student_by_roll_number(db, roll_number)
    return _build_student_detail(student)


# ---------------------------------------------------------------
# PATCH /students/{student_id} — Update Student (Admin only)
# ---------------------------------------------------------------
# PATCH = partial update (only provided fields are changed).
# Not PUT (full replacement) — safer for partial edits.
# ---------------------------------------------------------------
@router.patch(
    "/{student_id}",
    response_model=StudentResponse,
    summary="Update student profile (Admin only)",
)
def update_student_route(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return update_student(db, student_id, data)


# ---------------------------------------------------------------
# DELETE /students/{student_id} — Deactivate (Admin only)
# ---------------------------------------------------------------
# "Delete" in ERP = soft deactivation, not hard delete.
# Returns 200 with a message, not 204 (no content).
# ---------------------------------------------------------------
@router.delete(
    "/{student_id}",
    summary="Deactivate a student account (Admin only)",
)
def deactivate_student_route(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return deactivate_student(db, student_id)


# ---------------------------------------------------------------
# GET /students/section/{section_id} — Students in a Section
# ---------------------------------------------------------------
@router.get(
    "/section/{section_id}",
    response_model=List[StudentResponse],
    summary="List all students in a section (Admin or Faculty)",
)
def get_section_students_route(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from backend.models.user import UserRole

    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Faculty access required."
        )
    return get_students_by_section(db, section_id)


# =============================================================
# RESPONSE BUILDER HELPER
# =============================================================
# Builds StudentDetailResponse by traversing ORM relationships.
# Pydantic from_attributes=True reads flat attributes — it does NOT
# automatically traverse: student.user.full_name into full_name.
# We do that mapping explicitly here.
# =============================================================
def _build_student_detail(student) -> StudentDetailResponse:
    return StudentDetailResponse(
        id=student.id,
        user_id=student.user_id,
        roll_number=student.roll_number,
        department=student.department,
        semester=student.semester,
        admission_year=student.admission_year,
        phone=student.phone,
        address=student.address,
        guardian_name=student.guardian_name,
        guardian_phone=student.guardian_phone,
        date_of_birth=student.date_of_birth,
        full_name=student.user.full_name if student.user else None,
        email=student.user.email if student.user else None,
        is_active=student.user.is_active if student.user else None,
        section=SectionSummary.model_validate(student.section)
                if student.section else None,
    )
