# =============================================================
# models/faculty_assignment.py — Faculty Section Assignment Table
# =============================================================
# This is the ASSOCIATION TABLE linking faculty to the sections
# and subjects they teach.
#
# WHY a separate table and not columns on Faculty or Section?
#   → A faculty member can teach MULTIPLE subjects across MULTIPLE sections.
#   → A section can have MULTIPLE faculty teaching DIFFERENT subjects.
#   → This is a Many-to-Many relationship with extra data (timestamps).
#   → A join table with its own columns is the correct relational design.
#
# REAL EXAMPLE:
#   Prof. Sharma teaches:
#     → CSE Sem 3 Section A — Data Structures (CS301)
#     → CSE Sem 3 Section B — Data Structures (CS301)
#     → CSE Sem 5 Section A — Algorithms (CS501)
#   Each of these is a separate row in this table.
#
# THE UNIQUENESS CONSTRAINT:
#   UNIQUE(faculty_id, section_id, subject_id)
#   One faculty cannot be assigned to teach the same subject
#   in the same section more than once.
#
# FOREIGN KEY CASCADE RULES:
#   faculty_id → ondelete="CASCADE":
#     If a faculty member is deleted, their teaching assignments
#     are also removed. No orphaned assignments.
#   section_id → ondelete="CASCADE":
#     If a section is deleted, all its teaching assignments are removed.
#   subject_id → ondelete="CASCADE":
#     If a subject is removed from the catalog, its assignments go too.
#
# RELATIONSHIPS:
#   faculty_assignment.faculty → Faculty object (back_populates="section_assignments")
#   faculty_assignment.section → Section object (back_populates="faculty_assignments")
#   faculty_assignment.subject → Subject object
# =============================================================

from sqlalchemy import (
    Column, Integer, ForeignKey, DateTime,
    UniqueConstraint
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
    # FACULTY — Who is teaching
    # -----------------------------------------------------------------
    # ondelete="CASCADE": Deleting a faculty member removes all their
    # teaching assignments. Prevents orphaned rows.
    # -----------------------------------------------------------------
    faculty_id = Column(
        Integer,
        ForeignKey("faculty.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # SECTION — Which class group they are teaching
    # -----------------------------------------------------------------
    # ondelete="CASCADE": Deleting a section removes all its assignments.
    # -----------------------------------------------------------------
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # SUBJECT — Which subject they are teaching in that section
    # -----------------------------------------------------------------
    # ondelete="CASCADE": Removing a subject from the catalog removes
    # all associated teaching assignments.
    # -----------------------------------------------------------------
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # =================================================================
    # COMPOSITE UNIQUE CONSTRAINT
    # =================================================================
    # A faculty member can only be assigned to teach a given subject
    # in a given section once. Prevents duplicate assignments.
    # =================================================================
    __table_args__ = (
        UniqueConstraint(
            "faculty_id", "section_id", "subject_id",
            name="uq_faculty_section_subject"
        ),
    )

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================

    # Navigate from FacultySectionAssignment → Faculty (Many-to-One)
    # Matches: Faculty.section_assignments back_populates="faculty"
    faculty = relationship("Faculty", back_populates="section_assignments")

    # Navigate from FacultySectionAssignment → Section (Many-to-One)
    # Matches: Section.faculty_assignments back_populates="section"
    section = relationship("Section", back_populates="faculty_assignments")

    # Navigate from FacultySectionAssignment → Subject (Many-to-One)
    subject = relationship("Subject")

    def __repr__(self):
        return (
            f"<FacultySectionAssignment faculty={self.faculty_id} "
            f"section={self.section_id} subject={self.subject_id}>"
        )
