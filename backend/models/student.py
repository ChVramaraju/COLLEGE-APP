# =============================================================
# models/student.py — Student Profile Table
# =============================================================
# ARCHITECTURE RECAP:
#   users table    → authentication (login credentials)
#   students table → academic + personal profile
#
# A student has:
#   1. A users row    → username = roll_number, role = "student"
#   2. A students row → all academic + personal details
#
# FOREIGN KEY RELATIONSHIPS:
#   students.user_id    → users.id       (who can log in as this student)
#   students.section_id → sections.id    (which class group they belong to)
#
# WHY roll_number appears in BOTH tables:
#   users.username    = roll_number  → used for LOGIN lookup
#   students.roll_number             → official academic identifier
#   They are the same value but serve different purposes.
#   Denormalization is acceptable here for performance — login
#   queries ONLY hit users table, never students table.
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Date, SmallInteger,
    ForeignKey, Enum as SAEnum, DateTime
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import Department


class Student(Base):
    __tablename__ = "students"

    # -----------------------------------------------------------------
    # PRIMARY KEY
    # -----------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # FOREIGN KEY → users.id  (One-to-One)
    # -----------------------------------------------------------------
    # unique=True enforces One-to-One at the database level.
    # One user account = one student profile. No exceptions.
    #
    # ondelete="CASCADE":
    #   If admin deletes the user account → student profile is also deleted.
    #   No orphaned profile rows with no login account.
    # -----------------------------------------------------------------
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # ROLL NUMBER — Official academic identifier
    # -----------------------------------------------------------------
    # Format examples: "21CSE001", "22ECE045", "23IT012"
    # Structure: [admission_year_last2][dept_code][serial_3digits]
    # unique + index = fast lookup by roll number
    # -----------------------------------------------------------------
    roll_number = Column(String(20), unique=True, nullable=False, index=True)

    # -----------------------------------------------------------------
    # DEPARTMENT
    # -----------------------------------------------------------------
    department = Column(SAEnum(Department), nullable=False)

    # -----------------------------------------------------------------
    # CURRENT SEMESTER — Updated each semester by admin
    # -----------------------------------------------------------------
    semester = Column(SmallInteger, nullable=False)

    # -----------------------------------------------------------------
    # SECTION — Which class group the student belongs to
    # -----------------------------------------------------------------
    # FK to sections.id — NOT to section name string.
    # This is the CORRECT approach: store the ID, join when needed.
    # Storing "CSE-A-Sem3" as a string would break queries and cause
    # data inconsistency.
    #
    # ondelete="SET NULL":
    #   If a section is deleted → student still exists, section_id becomes NULL.
    #   Student isn't lost just because admin restructured sections.
    # -----------------------------------------------------------------
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # -----------------------------------------------------------------
    # ACADEMIC DETAILS
    # -----------------------------------------------------------------
    admission_year = Column(SmallInteger, nullable=False)

    # -----------------------------------------------------------------
    # PERSONAL DETAILS
    # -----------------------------------------------------------------
    date_of_birth = Column(Date, nullable=True)
    phone = Column(String(15), nullable=True)
    address = Column(String(300), nullable=True)

    # -----------------------------------------------------------------
    # GUARDIAN DETAILS — Critical for college systems
    # -----------------------------------------------------------------
    guardian_name = Column(String(100), nullable=True)
    guardian_phone = Column(String(15), nullable=True)

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================

    # Navigate from Student → their User account (One-to-One)
    # student_instance.user → returns User object
    # Access: student.user.email, student.user.is_active, etc.
    user = relationship("User", back_populates="student_profile")

    # Navigate from Student → their Section (Many-to-One)
    # student_instance.section → returns Section object
    # Access: student.section.name, student.section.incharge_faculty
    section = relationship("Section", back_populates="students")

    # Navigate from Student → all their attendance records (One-to-Many)
    attendance_records = relationship("Attendance", back_populates="student")

    # Navigate from Student → all their test attempts (One-to-Many)
    test_attempts = relationship("TestAttempt", back_populates="student")

    # Navigate from Student → all their subject results (One-to-Many)
    results = relationship("Result", back_populates="student")

    # Navigate from Student → all their semester GPA records (One-to-Many)
    semester_results = relationship("SemesterResult", back_populates="student")

    def __repr__(self):
        return (
            f"<Student id={self.id} roll={self.roll_number} "
            f"dept={self.department} sem={self.semester}>"
        )
