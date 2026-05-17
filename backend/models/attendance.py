# =============================================================
# models/attendance.py — Attendance Records Table
# =============================================================
# This table is the CORE of the attendance module.
# Every row = one student's attendance for one class period.
#
# VOLUME CONSIDERATION (why design matters here):
#   A college with 1,000 students × 6 periods/day × 200 days/year
#   = 1,200,000 attendance rows per year.
#   After 5 years = 6,000,000 rows.
#
#   Bad design = slow queries on 6M rows.
#   Good design (proper indexes) = fast queries on 6M rows.
#
# THREE FOREIGN KEYS:
#   student_id → students.id  (whose attendance)
#   faculty_id → faculty.id   (who marked — full audit trail)
#   section_id → sections.id  (which class group)
#
# WHY track faculty_id?
#   → Audit trail: "Who marked this attendance?"
#   → If disputed, admin can trace back to the faculty
#   → Critical for institutional accountability
#   → Without it: no accountability if attendance is faked
#
# THE COMPOSITE UNIQUE CONSTRAINT:
#   (student_id, attendance_date, subject, period_number)
#   This is the DATABASE-LEVEL guarantee that prevents double-marking.
#
#   EXAMPLE of what it prevents:
#   Faculty accidentally submits the same class attendance twice.
#   → First submission: 200 rows inserted → commit
#   → Second submission: DB raises IntegrityError → service catches → 409
#   → The second set of 200 rows is rejected ENTIRELY (transaction rolled back)
#   → Data stays clean
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Date, SmallInteger,
    ForeignKey, Enum as SAEnum, DateTime, Text,
    UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import AttendanceStatus


class Attendance(Base):
    __tablename__ = "attendance"

    # -----------------------------------------------------------------
    # PRIMARY KEY
    # -----------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # WHOSE ATTENDANCE — FK to students.id
    # -----------------------------------------------------------------
    # ondelete="CASCADE": If the student is deleted (hard delete),
    # their attendance records are also deleted.
    # In practice, we use soft delete (is_active=False), so CASCADE
    # rarely fires — but it's the correct integrity rule.
    # -----------------------------------------------------------------
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,     # Indexed: "get all attendance for student X" is frequent
    )

    # -----------------------------------------------------------------
    # WHO MARKED IT — FK to faculty.id (audit trail)
    # -----------------------------------------------------------------
    # ondelete="SET NULL": If faculty is deleted, attendance record
    # survives but loses the marker reference.
    # We don't lose historical attendance just because a faculty left.
    # -----------------------------------------------------------------
    faculty_id = Column(
        Integer,
        ForeignKey("faculty.id", ondelete="SET NULL"),
        nullable=True,  # nullable in case faculty account is deleted
        index=True,
    )

    # -----------------------------------------------------------------
    # WHICH SECTION — FK to sections.id
    # -----------------------------------------------------------------
    # Denormalized: student.section_id already exists, but storing
    # section_id here enables direct section-level queries without JOINs.
    # This is a deliberate trade-off: slight denormalization for
    # query performance on a high-volume table.
    # -----------------------------------------------------------------
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,     # Indexed: "get all attendance for section X on date Y" is frequent
    )

    # -----------------------------------------------------------------
    # SUBJECT — Which subject was being taught
    # -----------------------------------------------------------------
    # Stored as a plain string for flexibility.
    # Could be a FK to a "subjects" table — but that adds complexity.
    # For now, string is fine. Validate at schema level.
    # Examples: "Mathematics", "Data Structures", "Physics Lab"
    # -----------------------------------------------------------------
    subject = Column(String(100), nullable=False)

    # -----------------------------------------------------------------
    # DATE — Which calendar date
    # -----------------------------------------------------------------
    # Date (not DateTime) — we only care about the day, not the time.
    # Indexed: date-range queries like "attendance in March" are common.
    # -----------------------------------------------------------------
    attendance_date = Column(Date, nullable=False, index=True)

    # -----------------------------------------------------------------
    # PERIOD NUMBER — Which class period of the day (1-8)
    # -----------------------------------------------------------------
    # Colleges have 6-8 periods per day.
    # A subject may have 2 periods on the same day (lab sessions).
    # period_number distinguishes them.
    # -----------------------------------------------------------------
    period_number = Column(SmallInteger, nullable=False)

    # -----------------------------------------------------------------
    # STATUS — present / absent / late / excused
    # -----------------------------------------------------------------
    status = Column(SAEnum(AttendanceStatus), nullable=False)

    # -----------------------------------------------------------------
    # REMARKS — Optional free-text note
    # -----------------------------------------------------------------
    # "Medical leave", "College event", "Left early"
    # Text allows longer content than String for notes.
    # -----------------------------------------------------------------
    remarks = Column(Text, nullable=True)

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # =================================================================
    # COMPOSITE UNIQUE CONSTRAINT + TABLE INDEXES
    # =================================================================
    __table_args__ = (
        # THE MOST IMPORTANT CONSTRAINT IN THIS MODULE:
        # Same student CANNOT have two attendance records for the
        # same subject at the same period on the same date.
        UniqueConstraint(
            "student_id", "attendance_date", "subject", "period_number",
            name="uq_attendance_identity"
        ),

        # Composite index for the most common section-level query:
        # "Get all attendance for section X on date Y for subject Z"
        # This query runs every time faculty reviews the day's attendance.
        Index("ix_attendance_section_date_subject",
              "section_id", "attendance_date", "subject"),
    )

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================
    student  = relationship("Student",  back_populates="attendance_records")
    faculty  = relationship("Faculty",  back_populates="marked_attendance")
    section  = relationship("Section",  back_populates="attendance_records")

    def __repr__(self):
        return (
            f"<Attendance student={self.student_id} "
            f"date={self.attendance_date} subject={self.subject} "
            f"period={self.period_number} status={self.status}>"
        )
