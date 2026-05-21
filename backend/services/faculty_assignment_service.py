# =============================================================
# services/faculty_assignment_service.py — Faculty Assignment Logic
# =============================================================
# Manages faculty-section-subject teaching assignments.
# Used by attendance_service to verify faculty permissions.
# =============================================================

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from fastapi import HTTPException, status
from typing import Optional, List

from backend.models.faculty_assignment import FacultySectionAssignment
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.subject import Subject


def verify_faculty_assignment(
    db: Session,
    faculty_id: int,
    section_id: int,
    subject_name: str,
) -> bool:
    """
    Check whether a faculty member has an active assignment
    for the given section and subject.

    Parameters:
        faculty_id: The faculty's primary key (faculty.id, not user_id)
        section_id: The section's primary key
        subject_name: The subject name string (title-cased)

    Returns True if an assignment exists, False otherwise.
    """
    subject = (
        db.query(Subject)
        .filter(Subject.subject_name == subject_name, Subject.is_active == True)
        .first()
    )
    if not subject:
        return False

    assignment = (
        db.query(FacultySectionAssignment)
        .filter(
            and_(
                FacultySectionAssignment.faculty_id == faculty_id,
                FacultySectionAssignment.section_id == section_id,
                FacultySectionAssignment.subject_id == subject.id,
            )
        )
        .first()
    )
    return assignment is not None


def create_faculty_assignment(
    db: Session,
    faculty_id: int,
    section_id: int,
    subject_id: int,
) -> FacultySectionAssignment:
    """Create a new faculty-section-subject assignment."""
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty ID {faculty_id} not found.",
        )

    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found.",
        )

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject ID {subject_id} not found.",
        )

    existing = (
        db.query(FacultySectionAssignment)
        .filter(
            and_(
                FacultySectionAssignment.faculty_id == faculty_id,
                FacultySectionAssignment.section_id == section_id,
                FacultySectionAssignment.subject_id == subject_id,
            )
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This faculty-section-subject assignment already exists.",
        )

    assignment = FacultySectionAssignment(
        faculty_id=faculty_id,
        section_id=section_id,
        subject_id=subject_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def get_faculty_assignments(
    db: Session,
    faculty_id: int,
) -> List[FacultySectionAssignment]:
    """Get all assignments for a faculty member."""
    return (
        db.query(FacultySectionAssignment)
        .options(
            joinedload(FacultySectionAssignment.section),
            joinedload(FacultySectionAssignment.subject),
        )
        .filter(FacultySectionAssignment.faculty_id == faculty_id)
        .all()
    )


def get_section_assignments(
    db: Session,
    section_id: int,
) -> List[FacultySectionAssignment]:
    """Get all faculty assignments for a section."""
    return (
        db.query(FacultySectionAssignment)
        .options(
            joinedload(FacultySectionAssignment.faculty),
            joinedload(FacultySectionAssignment.subject),
        )
        .filter(FacultySectionAssignment.section_id == section_id)
        .all()
    )


def delete_faculty_assignment(
    db: Session,
    assignment_id: int,
) -> None:
    """Delete a faculty assignment by ID."""
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
