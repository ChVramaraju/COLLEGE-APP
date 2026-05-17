# =============================================================
# models/result.py — Individual Subject Result Entity
# =============================================================
# One row = one student's result for one subject in one exam type.
#
# THE UNIQUENESS CONSTRAINT:
#   UNIQUE(student_id, subject_id, exam_type, academic_year)
#
#   WHY academic_year in the constraint?
#   A student can take the SAME subject in different years:
#     → CS301 in 2024-25 (failed) → CS301 supplementary in 2025-26
#   These should be SEPARATE rows.
#   Without academic_year, the constraint would block the retake.
#
# TWO-PART MARKS SYSTEM:
#   internal_marks: Continuous assessment (class tests, assignments)
#   external_marks: End-semester examination (invigilated hall exam)
#   total_marks = internal + external (calculated field, stored for performance)
#   percentage = (total_marks / max_marks) × 100
#
# WHY store grade and grade_points in the row?
#   Denormalization for performance.
#   SGPA calculation reads these fields millions of times.
#   Re-computing grade from percentage every time is wasteful.
#   The grade is immutable once published — safe to denormalize.
#
# is_published:
#   False = Faculty has entered marks, student cannot see yet
#   True  = Admin/Faculty published — student sees their marks
#   This two-phase workflow prevents students seeing partial/wrong marks.
# =============================================================

from sqlalchemy import (
    Column, Integer, SmallInteger, Float, String, Text,
    Boolean, DateTime, ForeignKey, Enum as SAEnum,
    UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import ExamType


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # RELATIONSHIPS
    # -----------------------------------------------------------------
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True)

    # -----------------------------------------------------------------
    # EXAM CONTEXT
    # -----------------------------------------------------------------
    exam_type     = Column(SAEnum(ExamType), nullable=False)
    academic_year = Column(String(10), nullable=False)  # "2024-25"

    # -----------------------------------------------------------------
    # MARKS — stored as raw floats (allows partial marks: 23.5/30)
    # -----------------------------------------------------------------
    internal_marks = Column(Float, nullable=True)   # nullable: some exams are external-only
    external_marks = Column(Float, nullable=True)
    total_marks    = Column(Float, nullable=False)
    max_marks      = Column(SmallInteger, nullable=False)  # snapshot of max at entry time

    # -----------------------------------------------------------------
    # COMPUTED ACADEMIC FIELDS — denormalized for query performance
    # -----------------------------------------------------------------
    percentage   = Column(Float, nullable=False)
    grade        = Column(String(5), nullable=False)    # "O", "A+", "A", "B+", ...
    grade_points = Column(Float, nullable=False)        # 10.0, 9.0, 8.0, 7.0, ...

    # -----------------------------------------------------------------
    # STATE & AUDIT
    # -----------------------------------------------------------------
    is_published = Column(Boolean, default=False, nullable=False, index=True)
    remarks      = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # -----------------------------------------------------------------
    # CONSTRAINTS & INDEXES
    # -----------------------------------------------------------------
    __table_args__ = (
        UniqueConstraint(
            "student_id", "subject_id", "exam_type", "academic_year",
            name="uq_student_subject_exam_year"
        ),
        # Fast lookup: "all results for student X in semester 3"
        Index("ix_result_student_year", "student_id", "academic_year"),
    )

    # -----------------------------------------------------------------
    # RELATIONSHIPS
    # -----------------------------------------------------------------
    student = relationship("Student", back_populates="results")
    subject = relationship("Subject", back_populates="results")
    faculty = relationship("Faculty", back_populates="entered_results")

    def __repr__(self):
        return (
            f"<Result stu={self.student_id} subj={self.subject_id} "
            f"{self.exam_type} {self.academic_year} "
            f"{self.total_marks}/{self.max_marks} {self.grade}>"
        )
