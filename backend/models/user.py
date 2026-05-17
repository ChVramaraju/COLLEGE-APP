# =============================================================
# models/user.py — Users Database Table
# =============================================================
# This SQLAlchemy model defines the "users" table in PostgreSQL.
#
# DESIGN DECISION — One unified users table:
#   Instead of separate student_users, faculty_users tables,
#   we use ONE users table with a "role" column.
#
#   WHY?
#   → Single login endpoint for all user types
#   → Easier JWT — just embed role in token
#   → Simpler auth middleware — check role from token
#   → Students/Faculty profiles are in SEPARATE tables
#     linked via foreign key (users.id → students.user_id)
#
# LOGIN IDENTIFIERS per role:
#   student → roll_number (stored as username)
#   faculty → employee_id (stored as username)
#   admin   → email or admin_id (stored as username)
# =============================================================

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from backend.database.connection import Base


class UserRole(str, enum.Enum):
    """
    Enum constrains the role column to only these exact values.
    Prevents accidental typos like "studennt" or "ADMIN".
    SQLAlchemy enforces this at the DB level too.
    """
    student = "student"
    faculty = "faculty"
    admin = "admin"


class User(Base):
    """
    Maps to the "users" table in PostgreSQL.
    Every student, faculty, and admin has a record here.
    Role-specific details live in separate profile tables.
    """
    __tablename__ = "users"

    # Primary key — auto-incrementing integer ID
    # Every table needs one. This is the "address" of a row.
    id = Column(Integer, primary_key=True, index=True)

    # username stores:
    #   student → roll number  (e.g., "21CSE001")
    #   faculty → employee ID  (e.g., "FAC2024001")
    #   admin   → admin ID     (e.g., "ADMIN001")
    # unique=True prevents duplicate registrations
    username = Column(String, unique=True, index=True, nullable=False)

    # Full name — displayed on dashboards
    full_name = Column(String, nullable=False)

    # Email — for notifications and password reset
    email = Column(String, unique=True, index=True, nullable=True)

    # Hashed password — NEVER store plain text
    # bcrypt hash is always ~60 chars, but use 255 for safety
    hashed_password = Column(String(255), nullable=False)

    # Role — determines which dashboard and permissions apply
    # Uses the UserRole enum: "student", "faculty", "admin"
    role = Column(Enum(UserRole), nullable=False)

    # is_active — soft disable accounts without deleting them
    # Deactivated users can't log in but their data is preserved
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps — always useful for auditing and debugging
    # server_default=func.now() means DB sets this automatically
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # =================================================================
    # ORM RELATIONSHIPS — Navigate from User to their profiles
    # =================================================================
    # uselist=False enforces One-to-One at the Python ORM level.
    # Without it, SQLAlchemy would return a list instead of a single object.
    #
    # String references prevent circular imports:
    #   user.py imports nothing from student.py or faculty.py
    #   SQLAlchemy resolves "Student" / "Faculty" strings at runtime
    #   after ALL models have been imported into memory.
    #
    # Usage examples:
    #   user_obj.student_profile.roll_number  → "21CSE001"
    #   user_obj.faculty_profile.employee_id  → "FAC2024001"
    #   (Returns None if the user is not that role)
    # =================================================================

    # For users with role="student" → their academic profile
    student_profile = relationship(
        "Student",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # For users with role="faculty" → their professional profile
    faculty_profile = relationship(
        "Faculty",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<User id={self.id} username={self.username} role={self.role}>"
