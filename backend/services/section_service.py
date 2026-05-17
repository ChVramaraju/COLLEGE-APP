# =============================================================
# services/section_service.py — Section Business Logic
# =============================================================
# Sections are the academic "rooms" that link faculty to students.
# They have no user accounts — pure academic data entities.
#
# KEY OPERATIONS:
#   → Admin creates sections (define the academic structure)
#   → Admin assigns faculty as incharge of a section
#   → Faculty views their section's student roster
#   → Admin lists/filters sections by dept/semester/year
#
# UNIQUE CONSTRAINT AWARENESS:
#   The DB enforces UNIQUE(name, department, semester, academic_year).
#   The service validates this BEFORE the DB write to give
#   a clear 409 error instead of a cryptic DB IntegrityError.
# =============================================================

from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import Optional

from backend.models.section import Section
from backend.models.faculty import Faculty
from backend.models.student import Student
from backend.models.user import User
from backend.schemas.section import SectionCreate, SectionUpdate


# ---------------------------------------------------------------
# CREATE SECTION
# ---------------------------------------------------------------
def create_section(db: Session, data: SectionCreate) -> Section:
    """
    Creates a new academic section.

    COMPOSITE UNIQUENESS CHECK:
    The same section name+dept+semester+year cannot exist twice.
    We check this in the service (not just rely on DB constraint)
    because a DB IntegrityError gives a cryptic 500 error, while
    our check gives a clear 409 Conflict with a human-readable message.

    This is "defensive database programming" — validate before writing,
    don't rely on DB errors as your only safety net.
    """

    # Check composite uniqueness
    existing = db.query(Section).filter(
        Section.name == data.name,
        Section.department == data.department,
        Section.semester == data.semester,
        Section.academic_year == data.academic_year,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Section '{data.name}' already exists for "
                f"{data.department.value} Sem {data.semester} "
                f"({data.academic_year})."
            )
        )

    # Validate incharge faculty exists (if provided)
    if data.incharge_faculty_id:
        faculty = db.query(Faculty).filter(
            Faculty.id == data.incharge_faculty_id
        ).first()
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Faculty ID {data.incharge_faculty_id} not found."
            )
        # Department alignment check
        if faculty.department != data.department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Faculty belongs to '{faculty.department.value}' department, "
                    f"but section is in '{data.department.value}'. "
                    f"Assign faculty from the same department."
                )
            )

    try:
        new_section = Section(
            name=data.name,
            department=data.department,
            semester=data.semester,
            academic_year=data.academic_year,
            incharge_faculty_id=data.incharge_faculty_id,
            max_strength=data.max_strength,
        )
        db.add(new_section)
        db.commit()
        db.refresh(new_section)
        return new_section

    except IntegrityError:
        # Fallback: DB-level constraint violation (race condition edge case)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Section already exists (database constraint violation)."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Section creation failed: {str(e)}"
        )


# ---------------------------------------------------------------
# GET SECTION BY ID
# ---------------------------------------------------------------
def get_section_by_id(db: Session, section_id: int) -> Section:
    """
    Fetches a section with incharge faculty loaded.
    Used internally by other service functions.
    """
    section = (
        db.query(Section)
        .options(joinedload(Section.incharge_faculty))
        .filter(Section.id == section_id)
        .first()
    )
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )
    return section


# ---------------------------------------------------------------
# ASSIGN INCHARGE FACULTY
# ---------------------------------------------------------------
def assign_incharge_faculty(
    db: Session, section_id: int, faculty_id: int
) -> Section:
    """
    Assigns (or reassigns) a faculty member as section incharge.

    BUSINESS RULE: Faculty must belong to the same department.
    A Computer Science section cannot have a Mechanical faculty incharge.
    This is a real ERP business rule — enforce it in the service.

    REASSIGNMENT: If a section already has an incharge, calling this
    simply updates to the new faculty. No extra steps needed.
    The old incharge loses the assignment silently.
    """
    section = get_section_by_id(db, section_id)

    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty ID {faculty_id} not found."
        )

    if faculty.department != section.department:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Department mismatch. Faculty is from '{faculty.department.value}', "
                f"section is in '{section.department.value}'."
            )
        )

    section.incharge_faculty_id = faculty_id
    db.commit()
    db.refresh(section)
    return section


# ---------------------------------------------------------------
# UPDATE SECTION METADATA
# ---------------------------------------------------------------
def update_section(db: Session, section_id: int, data: SectionUpdate) -> Section:
    """
    Updates max_strength or incharge_faculty_id.
    Identity fields (name, dept, semester, year) are immutable.
    """
    section = get_section_by_id(db, section_id)
    update_data = data.model_dump(exclude_unset=True)

    if "incharge_faculty_id" in update_data:
        new_faculty_id = update_data["incharge_faculty_id"]
        if new_faculty_id is not None:
            faculty = db.query(Faculty).filter(Faculty.id == new_faculty_id).first()
            if not faculty:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Faculty ID {new_faculty_id} not found."
                )

    for field, value in update_data.items():
        setattr(section, field, value)

    db.commit()
    db.refresh(section)
    return section


# ---------------------------------------------------------------
# GET SECTION STUDENTS — Class roster
# ---------------------------------------------------------------
def get_section_students(db: Session, section_id: int) -> list[Student]:
    """
    Returns all ACTIVE students enrolled in this section.

    WHY filter is_active = True?
    → Deactivated students shouldn't appear on active class rosters.
    → Faculty should only see currently enrolled, active students.

    ORDER BY roll_number → consistent ordering for attendance sheets,
    exam seating arrangements, etc. Predictable order matters in ERP.
    """
    # Verify section exists
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    students = (
        db.query(Student)
        .join(User, Student.user_id == User.id)
        .options(joinedload(Student.user))
        .filter(
            Student.section_id == section_id,
            User.is_active == True,
        )
        .order_by(Student.roll_number)
        .all()
    )
    return students


# ---------------------------------------------------------------
# GET SECTION DETAIL — With faculty + student roster
# ---------------------------------------------------------------
def get_section_detail(db: Session, section_id: int) -> dict:
    """
    Returns complete section data: metadata + incharge + students.
    Used by admin and faculty for the full section view.

    Returns a dict instead of a model because we're composing
    data from multiple sources that don't map to a single model.
    The route will use SectionDetailResponse schema to serialize this.
    """
    section = (
        db.query(Section)
        .options(
            joinedload(Section.incharge_faculty).joinedload(Faculty.user),
        )
        .filter(Section.id == section_id)
        .first()
    )
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    students = get_section_students(db, section_id)
    return {"section": section, "students": students}


# ---------------------------------------------------------------
# LIST SECTIONS — Filtered by dept/semester/year
# ---------------------------------------------------------------
def list_sections(
    db: Session,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    academic_year: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Section]:
    """
    Dynamic filtered list with pagination.

    WHY dynamic filtering (not separate endpoints)?
    → One endpoint handles: all sections, by dept, by semester, by year
    → Cleaner API surface — fewer endpoints to maintain
    → Frontend builds queries dynamically: ?department=cse&semester=3

    This is the "query object pattern" — build query conditionally.
    """
    query = db.query(Section).options(
        joinedload(Section.incharge_faculty).joinedload(Faculty.user)
    )

    if department:
        query = query.filter(Section.department == department)
    if semester:
        query = query.filter(Section.semester == semester)
    if academic_year:
        query = query.filter(Section.academic_year == academic_year)

    return (
        query
        .order_by(Section.department, Section.semester, Section.name)
        .offset(skip)
        .limit(limit)
        .all()
    )
