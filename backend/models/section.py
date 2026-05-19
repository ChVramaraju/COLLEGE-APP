# =============================================================
# models/section.py — Academic Section Table
# =============================================================
# A SECTION is a class group within a department + semester.
#
# Real example:
#   CSE Department, Semester 3, Section A, Year 2024-25
#   → 60 students assigned to this section
#   → One faculty member is "incharge" (class teacher)
#
# WHY Section is a separate table and not just a column on Student?
#   → A section has its OWN attributes (year, max_strength, incharge)
#   → Many students share the same section — normalised design
#   → Attendance, timetables, tests all link to sections
#   → Without a section table: you'd store "CSE-3-A-2024" as a string
#     in every student row — un-queryable, un-maintainable
#
# UNIQUENESS CONSTRAINT:
#   (name, department, semester, academic_year) must be unique together.
#   You can have:
#     → "A" in CSE Sem 3 2024-25  ✅
#     → "A" in ECE Sem 3 2024-25  ✅  (different dept)
#     → "A" in CSE Sem 5 2024-25  ✅  (different semester)
#   But NOT:
#     → "A" in CSE Sem 3 2024-25 TWICE ❌
# =============================================================

from sqlalchemy import (
    Column, Integer, String, SmallInteger,
    ForeignKey, Enum as SAEnum, DateTime,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import Department


class Section(Base):
    __tablename__ = "sections"

    # -----------------------------------------------------------------
    # PRIMARY KEY
    # -----------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # SECTION NAME — "A", "B", "C", etc.
    # -----------------------------------------------------------------
    # Short string — typically one character. Max 5 for safety.
    name = Column(String(5), nullable=False)

    # -----------------------------------------------------------------
    # DEPARTMENT
    # -----------------------------------------------------------------
    department = Column(SAEnum(Department), nullable=False)

    # -----------------------------------------------------------------
    # SEMESTER — 1 through 8
    # -----------------------------------------------------------------
    # SmallInteger uses 2 bytes instead of 4 (Integer).
    # Values 1-8 never need more than 2 bytes.
    # This is micro-optimization — good habit in ERP systems with
    # millions of rows.
    semester = Column(SmallInteger, nullable=False)

    # -----------------------------------------------------------------
    # ACADEMIC YEAR — "2024-25", "2025-26"
    # -----------------------------------------------------------------
    # Stored as a string for simplicity and human readability.
    # Alternatively could be a Date range — but string is standard
    # in Indian college ERP systems.
    academic_year = Column(String(10), nullable=False)

    # -----------------------------------------------------------------
    # INCHARGE FACULTY — Class teacher for this section
    # -----------------------------------------------------------------
    # FK to faculty.id (NOT users.id).
    # We reference the FACULTY PROFILE, not the login account.
    # This is correct — sections belong to faculty roles, not accounts.
    #
    # ondelete="SET NULL" means:
    #   If the faculty is deleted → section still exists but has no incharge.
    #   This is safer than CASCADE (which would delete the entire section).
    #   A section without an incharge can be reassigned later.
    # -----------------------------------------------------------------
    incharge_faculty_id = Column(
        Integer,
        ForeignKey("faculty.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # -----------------------------------------------------------------
    # MAX STRENGTH — Maximum students allowed in this section
    # -----------------------------------------------------------------
    max_strength = Column(SmallInteger, default=60, nullable=False)

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # =================================================================
    # COMPOSITE UNIQUE CONSTRAINT
    # =================================================================
    # Prevents duplicate sections.
    # Must be defined in __table_args__ (not as column-level constraint)
    # because it spans MULTIPLE columns.
    # =================================================================
    __table_args__ = (
        UniqueConstraint(
            "name", "department", "semester", "academic_year",
            name="uq_section_identity"
        ),
    )

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================

    # Navigate from Section → their incharge Faculty (Many-to-One)
    # section_instance.incharge_faculty → returns Faculty object
    incharge_faculty = relationship("Faculty", back_populates="sections_in_charge")

    # Navigate from Section → all Students in this section (One-to-Many)
    students = relationship("Student", back_populates="section", lazy="dynamic")

    # Navigate from Section → all attendance records in this section (One-to-Many)
    attendance_records = relationship("Attendance", back_populates="section")

    # Navigate from Section → all notes uploaded for this section (One-to-Many)
    notes = relationship("Note", back_populates="section")

    # Navigate from Section → all tests assigned to this section (One-to-Many)
    tests_assigned = relationship("Test", back_populates="section")

    # Navigate from Section → all faculty teaching assignments (One-to-Many)
    # Each row represents one faculty teaching one subject in this section.
    faculty_assignments = relationship(
        "FacultySectionAssignment",
        back_populates="section",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return (
            f"<Section {self.name} | {self.department} | "
            f"Sem{self.semester} | {self.academic_year}>"
        )
