# =============================================================
# models/faculty.py — Faculty Profile Table
# =============================================================
# SEPARATION OF CONCERNS:
#   users table    → authentication (password, login, role)
#   faculty table  → profile (who they are, what they teach)
#
# A faculty member has:
#   1. A users row   → for logging in
#   2. A faculty row → for professional profile
#
# They are connected via user_id (FK to users.id).
#
# WHY separate tables and not columns on users?
#   → Faculty has 8+ profile fields. Students have different fields.
#   → Adding all fields to users would create a messy table
#     with 20+ nullable columns (NULL for students, NULL for admins).
#   → Separate tables = clean, purpose-specific schema.
#   → Called "Profile Pattern" — common in production ERP systems.
#
# TABLE CREATION ORDER MATTERS:
#   users must exist BEFORE faculty (FK: faculty.user_id → users.id)
#   faculty must exist BEFORE sections (FK: sections.incharge_faculty_id → faculty.id)
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Date,
    ForeignKey, Enum as SAEnum, DateTime
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import Department, Designation


class Faculty(Base):
    __tablename__ = "faculty"

    # -----------------------------------------------------------------
    # PRIMARY KEY
    # -----------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # FOREIGN KEY → users.id
    # -----------------------------------------------------------------
    # This is the LINK between the login system and the profile.
    # One faculty account → exactly one faculty profile.
    #
    # unique=True enforces One-to-One at the DB level.
    # Without unique=True it would be One-to-Many (one user, many profiles) — wrong.
    #
    # ondelete="CASCADE" means:
    #   If the user account is deleted → the faculty profile is also deleted.
    #   Prevents orphaned profile rows with no associated user.
    # -----------------------------------------------------------------
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # EMPLOYEE ID — The faculty's institutional identifier
    # -----------------------------------------------------------------
    # Different from user.username which is used for login.
    # employee_id is the official HR record ID (e.g., "FAC2024001").
    # unique=True — no two faculty can share the same employee ID.
    # -----------------------------------------------------------------
    employee_id = Column(String(20), unique=True, nullable=False, index=True)

    # -----------------------------------------------------------------
    # DEPARTMENT — Which academic department they belong to
    # -----------------------------------------------------------------
    # Uses the Department enum from enums.py.
    # PostgreSQL enforces this at DB level — "invalid_dept" would be rejected.
    # -----------------------------------------------------------------
    department = Column(SAEnum(Department), nullable=False)

    # -----------------------------------------------------------------
    # DESIGNATION — Job title / seniority level
    # -----------------------------------------------------------------
    designation = Column(SAEnum(Designation), nullable=False)

    # -----------------------------------------------------------------
    # SPECIALIZATION — Research or teaching focus area
    # -----------------------------------------------------------------
    # Examples: "Machine Learning", "VLSI Design", "Thermodynamics"
    # Nullable — not all faculty may have a listed specialization.
    # -----------------------------------------------------------------
    specialization = Column(String(100), nullable=True)

    # -----------------------------------------------------------------
    # CONTACT
    # -----------------------------------------------------------------
    phone = Column(String(15), nullable=True)

    # -----------------------------------------------------------------
    # JOINING DATE — When they joined the institution
    # -----------------------------------------------------------------
    # Date (not DateTime) — we only need the calendar date.
    joining_date = Column(Date, nullable=True)

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================
    # Relationships are Python-level only — no extra DB columns.
    # They let you navigate between objects: faculty.user, faculty.sections_in_charge
    #
    # String references ("User", "Section") prevent circular imports.
    # SQLAlchemy resolves them after ALL models are loaded.
    # =================================================================

    # Navigate from Faculty → their User account (One-to-One)
    # faculty_instance.user → returns the User object
    user = relationship("User", back_populates="faculty_profile")

    # Navigate from Faculty → Sections they are incharge of (One-to-Many)
    # faculty_instance.sections_in_charge → returns list of Section objects
    sections_in_charge = relationship("Section", back_populates="incharge_faculty")

    # Navigate from Faculty -> all attendance records they marked (One-to-Many)
    marked_attendance = relationship("Attendance", back_populates="faculty")

    # Navigate from Faculty -> all notes they uploaded (One-to-Many)
    uploaded_notes = relationship("Note", back_populates="faculty")

    # Navigate from Faculty -> all tests they created (One-to-Many)
    created_tests = relationship("Test", back_populates="faculty")

    # Navigate from Faculty -> all results they entered (One-to-Many)
    entered_results = relationship("Result", back_populates="faculty")

    def __repr__(self):
        return f"<Faculty id={self.id} emp={self.employee_id} dept={self.department}>"
