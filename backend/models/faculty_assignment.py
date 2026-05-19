# =============================================================
# models/faculty_assignment.py — Faculty-Section Assignment Table
# =============================================================
# This is the SINGLE SOURCE OF TRUTH for which faculty teaches
# which subject in which section.
#
# WHY a dedicated join table instead of a column on Section?
#   → One section has MANY subjects taught by MANY faculty members.
#     e.g. CSE Section A, Sem 3:
#       → Dr. Smith teaches "Data Structures"
#       → Dr. Patel  teaches "Database Systems"
#       → Dr. Rao    teaches "Operating Systems"
#   → A single incharge_faculty_id column cannot represent this.
#   → The old "section.incharge_faculty_id" only captures the
#     CLASS INCHARGE role (administrative). Teaching assignments
#     require a proper many-to-many with a subject attribute.
#
# UNIQUE CONSTRAINT:
#   (faculty_id, section_id, subject) must be unique.
#   One faculty cannot be double-assigned for the same subject
#   in the same section. But they CAN teach two subjects in
#   the same section (two separate rows).
#
# SECURITY IMPLICATION:
#   Every faculty action (attendance, notes, tests) must first
#   verify the faculty has a row in this table matching the
#   (faculty_id, section_id, subject) being acted upon.
#   The verify_faculty_assignment() service function is the
#   single authorization gateway for all these checks.
# =============================================================

from sqlalchemy import (
    Column, Integer, String, SmallInteger,
    ForeignKey, DateTime, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base


class FacultySectionAssignment(Base):
    __tablename__ = "faculty_section_assignments"

    # -----------------------------------------------------------------
    # PRIMARY KEY
    # -----------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # FACULTY FK — who is teaching
    # -----------------------------------------------------------------
    # CASCADE: if the faculty is deleted, remove all their assignments.
    # This is correct — a deleted faculty member cannot teach anything.
    # -----------------------------------------------------------------
    faculty_id = Column(
        Integer,
        ForeignKey("faculty.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # SECTION FK — which section they teach in
    # -----------------------------------------------------------------
    # CASCADE: if the section is dissolved, remove assignments.
    # -----------------------------------------------------------------
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # SUBJECT — what they teach in this section
    # -----------------------------------------------------------------
    # Stored in Title Case (normalized in the service layer before insert).
    # Must match the subject strings used in Attendance records for the
    # permission check to work correctly.
    # -----------------------------------------------------------------
    subject = Column(String(100), nullable=False)

    # -----------------------------------------------------------------
    # SEMESTER — redundant (denormalized from Section) but useful
    # -----------------------------------------------------------------
    # Stored here to avoid a JOIN when just checking "what semester
    # does this assignment belong to?" in list queries.
    # Kept in sync with section.semester by the create service.
    # -----------------------------------------------------------------
    semester = Column(SmallInteger, nullable=False)

    # -----------------------------------------------------------------
    # AUDIT — which admin created this assignment
    # -----------------------------------------------------------------
    # SET NULL on delete: if the admin account is removed, keep the
    # assignment record intact (the assignment is still valid).
    # -----------------------------------------------------------------
    assigned_by_admin_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # -----------------------------------------------------------------
    # TIMESTAMP
    # -----------------------------------------------------------------
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # -----------------------------------------------------------------
    # COMPOSITE UNIQUE + INDEXES
    # -----------------------------------------------------------------
    __table_args__ = (
        UniqueConstraint(
            "faculty_id", "section_id", "subject",
            name="uq_faculty_section_subject",
        ),
        Index("ix_fsa_faculty_section", "faculty_id", "section_id"),
    )

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================

    # Navigate: assignment → its Faculty
    faculty = relationship("Faculty", back_populates="section_assignments")

    # Navigate: assignment → its Section
    section = relationship("Section", back_populates="faculty_assignments")

    # Navigate: assignment → the admin who created it (read-only audit)
    assigned_by = relationship(
        "User",
        foreign_keys=[assigned_by_admin_id],
    )

    def __repr__(self):
        return (
            f"<FacultySectionAssignment "
            f"faculty={self.faculty_id} "
            f"section={self.section_id} "
            f"subject={self.subject!r}>"
        )
