# =============================================================
# models/test.py — Online Test (Exam) Entity
# =============================================================
# A Test is the top-level assessment object.
# Think of it as the exam paper cover page:
#   → Name of the exam, which subject, which class, when it runs
#   → Does NOT contain questions (those are in questions table)
#   → Does NOT contain answers (those are in test_attempts/test_answers)
#
# LIFECYCLE STATES:
#   Draft (is_published=False):
#     → Faculty is preparing. Students cannot see it.
#     → Questions can be freely added/modified.
#
#   Published (is_published=True):
#     → Live exam. Students within start_time/end_time can attempt.
#     → Questions are IMMUTABLE. Changing questions after students
#       have started would make grading inconsistent.
#
#   Expired (now > end_time):
#     → No new attempts. Existing submissions still accessible.
#     → Analytics available.
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    SmallInteger, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)

    faculty_id  = Column(Integer, ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id  = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False, index=True)

    subject     = Column(String(100), nullable=False)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # -----------------------------------------------------------------
    # MARKS & TIMING
    # -----------------------------------------------------------------
    # total_marks: Calculated and locked when test is PUBLISHED.
    # Stored as a snapshot so result analytics don't need to re-sum
    # question marks every time.
    total_marks      = Column(Integer, nullable=True)
    duration_minutes = Column(SmallInteger, nullable=False)

    # UTC timestamps for when the test window opens and closes.
    # WHY UTC? Backend is timezone-agnostic.
    # The frontend converts UTC → local time for display.
    # All timing comparisons in services use datetime.now(timezone.utc).
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time   = Column(DateTime(timezone=True), nullable=False)

    is_published = Column(Boolean, default=False, nullable=False)
    is_active    = Column(Boolean, default=True,  nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_test_section_published", "section_id", "is_published"),
    )

    # Relationships
    faculty   = relationship("Faculty",  back_populates="created_tests")
    section   = relationship("Section",  back_populates="tests_assigned")
    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan", order_by="Question.order_number")
    attempts  = relationship("TestAttempt", back_populates="test")

    def __repr__(self):
        return f"<Test id={self.id} title='{self.title}' published={self.is_published}>"
