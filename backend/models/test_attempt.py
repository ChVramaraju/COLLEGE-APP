# =============================================================
# models/test_attempt.py — Student's Exam Session
# =============================================================
# One row = one student's attempt at one test.
#
# THE UNIQUE CONSTRAINT:
#   UNIQUE(test_id, student_id)
#   → Guarantees at the DATABASE LEVEL that a student can only
#     have ONE attempt per test. No amount of service-layer bugs
#     can create two rows for the same student+test pair.
#
# TWO PHASES of a TestAttempt:
#   Phase 1 — IN PROGRESS (is_submitted=False):
#     → created when student calls start_attempt
#     → score is NULL
#     → submitted_at is NULL
#     → Student is actively answering questions
#
#   Phase 2 — SUBMITTED (is_submitted=True):
#     → created when student calls submit_test
#     → score is calculated and stored
#     → submitted_at is recorded
#     → permanent, immutable
#
# total_marks SNAPSHOT:
#   We store the test's total_marks at attempt creation time.
#   Why? If a faculty somehow modifies test marks later (hypothetically),
#   the student's percentage still reflects what the test was worth
#   WHEN they took it. Historical accuracy matters in education.
# =============================================================

from sqlalchemy import (
    Column, Integer, Float, Boolean,
    DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id         = Column(Integer, primary_key=True, index=True)
    test_id    = Column(Integer, ForeignKey("tests.id",    ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)

    started_at   = Column(DateTime(timezone=True), server_default=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Snapshot of test's total_marks at attempt time
    total_marks = Column(Integer, nullable=False)

    # Calculated during grading — NULL until submitted
    score      = Column(Integer, nullable=True)
    percentage = Column(Float,   nullable=True)

    is_submitted = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("test_id", "student_id", name="uq_one_attempt_per_student"),
    )

    # Relationships
    test    = relationship("Test",    back_populates="attempts")
    student = relationship("Student", back_populates="test_attempts")
    answers = relationship("TestAnswer", back_populates="attempt", cascade="all, delete-orphan")

    def __repr__(self):
        return (
            f"<TestAttempt id={self.id} test={self.test_id} "
            f"student={self.student_id} submitted={self.is_submitted}>"
        )
