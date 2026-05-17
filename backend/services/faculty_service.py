# =============================================================
# services/faculty_service.py — Faculty Business Logic
# =============================================================
# Same service-layer architecture as student_service.py.
# All faculty-related business rules live here — zero logic in routes.
#
# KEY DIFFERENCE from student service:
#   → Faculty login username = employee_id (not roll_number)
#   → Faculty has designation + specialization (career fields)
#   → Faculty is linked to SECTIONS (they manage sections)
#   → Faculty can VIEW their assigned sections and the students in them
# =============================================================

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from backend.models.user import User, UserRole
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.schemas.faculty import FacultyCreate, FacultyUpdate
from backend.auth.hashing import hash_password


# ---------------------------------------------------------------
# CREATE FACULTY — Transactional Two-Row Creation
# ---------------------------------------------------------------
def create_faculty(db: Session, data: FacultyCreate) -> Faculty:
    """
    Creates both a users row AND a faculty row atomically.

    Same transaction pattern as create_student():
    1. Validate uniqueness (employee_id, username)
    2. INSERT into users → flush → get user.id
    3. INSERT into faculty → uses user.id
    4. COMMIT → both permanent
    5. ROLLBACK on any failure

    WHY employee_id CHECK AND username CHECK separately?
    → employee_id is the HR identifier (unique in faculty table)
    → username (= employee_id) is the login identifier (unique in users table)
    → They're stored in different tables — must be checked separately.
    → A junior engineer might check only one and miss the other.
    """

    # --- VALIDATION: Duplicate employee_id ---
    existing_emp = db.query(Faculty).filter(
        Faculty.employee_id == data.employee_id
    ).first()
    if existing_emp:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee ID '{data.employee_id}' is already registered."
        )

    # --- VALIDATION: Username uniqueness ---
    existing_user = db.query(User).filter(
        User.username == data.employee_id
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{data.employee_id}' is already taken."
        )

    try:
        # --- STEP 1: Create login account ---
        new_user = User(
            username=data.employee_id,         # faculty login = employee ID
            full_name=data.full_name,
            email=data.email,
            hashed_password=hash_password(data.password),
            role=UserRole.faculty,
            is_active=True,
        )
        db.add(new_user)
        db.flush()   # Sends INSERT → gives us new_user.id

        # --- STEP 2: Create faculty profile ---
        new_faculty = Faculty(
            user_id=new_user.id,
            employee_id=data.employee_id,
            department=data.department,
            designation=data.designation,
            specialization=data.specialization,
            phone=data.phone,
            joining_date=data.joining_date,
        )
        db.add(new_faculty)
        db.commit()
        db.refresh(new_faculty)

        return new_faculty

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Faculty creation failed: {str(e)}"
        )


# ---------------------------------------------------------------
# GET FACULTY BY ID
# ---------------------------------------------------------------
def get_faculty_by_id(db: Session, faculty_id: int) -> Faculty:
    """
    Fetch faculty profile with user account and assigned sections loaded.

    joinedload(Faculty.sections_in_charge):
    → Fetches all sections this faculty manages in the same query.
    → Without joinedload: accessing faculty.sections_in_charge outside
      an active session causes DetachedInstanceError.
    """
    faculty = (
        db.query(Faculty)
        .options(
            joinedload(Faculty.user),
            joinedload(Faculty.sections_in_charge),
        )
        .filter(Faculty.id == faculty_id)
        .first()
    )
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {faculty_id} not found."
        )
    return faculty


# ---------------------------------------------------------------
# GET FACULTY BY USER ID — Used by auth dependencies
# ---------------------------------------------------------------
def get_faculty_by_user_id(db: Session, user_id: int) -> Faculty:
    """
    Fetches faculty profile using the user_id from the JWT token.

    Used by: the /faculty/me endpoint (faculty views own profile).
    The JWT contains user_id — we use that to find the faculty profile.

    Flow:
      JWT decoded → user_id extracted → faculty profile loaded
    """
    faculty = (
        db.query(Faculty)
        .options(joinedload(Faculty.user), joinedload(Faculty.sections_in_charge))
        .filter(Faculty.user_id == user_id)
        .first()
    )
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found for this account."
        )
    return faculty


# ---------------------------------------------------------------
# UPDATE FACULTY — Partial PATCH Update
# ---------------------------------------------------------------
def update_faculty(db: Session, faculty_id: int, data: FacultyUpdate) -> Faculty:
    """
    Updates only the explicitly provided fields.

    User-table fields (full_name, email) → updated on users row.
    Faculty-table fields (designation, etc.) → updated on faculty row.

    Same split-update pattern as update_student().
    This works because we eagerly load faculty.user via joinedload.
    """
    faculty = get_faculty_by_id(db, faculty_id)

    update_data = data.model_dump(exclude_unset=True)

    user_fields = {"full_name", "email"}
    faculty_fields = {"designation", "specialization", "phone", "joining_date"}

    for field, value in update_data.items():
        if field in user_fields:
            setattr(faculty.user, field, value)
        elif field in faculty_fields:
            setattr(faculty, field, value)

    db.commit()
    db.refresh(faculty)
    return faculty


# ---------------------------------------------------------------
# GET ASSIGNED SECTIONS — Faculty's managed sections
# ---------------------------------------------------------------
def get_assigned_sections(db: Session, faculty_id: int) -> list[Section]:
    """
    Returns all sections where this faculty is the incharge.

    Used by faculty dashboard — shows their class responsibilities.

    WHY query directly instead of faculty.sections_in_charge?
    → Direct query is explicit — easier to add filters later
      (e.g., only current academic year sections).
    → Avoids relying on relationship lazy-loading behavior.
    """
    # Verify faculty exists
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty ID {faculty_id} not found."
        )

    sections = (
        db.query(Section)
        .filter(Section.incharge_faculty_id == faculty_id)
        .order_by(Section.semester, Section.name)
        .all()
    )
    return sections


# ---------------------------------------------------------------
# LIST ALL FACULTY — Admin use
# ---------------------------------------------------------------
def list_all_faculty(db: Session, skip: int = 0, limit: int = 50) -> list[Faculty]:
    """
    Paginated list of all faculty members.
    Admin uses this to browse/search faculty.
    """
    return (
        db.query(Faculty)
        .options(joinedload(Faculty.user))
        .offset(skip)
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------
# DEACTIVATE FACULTY — Soft Delete
# ---------------------------------------------------------------
def deactivate_faculty(db: Session, faculty_id: int) -> dict:
    """
    Soft-deactivates a faculty member.
    Their sections remain assigned — admin reassigns manually.

    WHY not cascade-deactivate their sections?
    → Sections can exist without an active incharge (incharge_faculty_id can be NULL).
    → Removing sections when a faculty leaves would erase the academic structure.
    → Admin should consciously decide what happens to sections.
    """
    faculty = get_faculty_by_id(db, faculty_id)

    if not faculty.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faculty '{faculty.employee_id}' is already deactivated."
        )

    faculty.user.is_active = False
    db.commit()

    return {
        "message": f"Faculty '{faculty.employee_id}' has been deactivated.",
        "faculty_id": faculty_id
    }
