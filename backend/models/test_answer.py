# =============================================================
# models/test_answer.py — Individual Question Answer
# =============================================================
# One row = student's answer to ONE question in ONE attempt.
#
# LIFECYCLE:
#   On submit → rows are INSERTED (one per question in the test)
#   Grading   → is_correct and marks_awarded are SET
#   Result    → rows are READ with question data for result display
#
# selected_option is NULLABLE:
#   If student skips a question, selected_option = NULL.
#   is_correct = False, marks_awarded = 0 for skipped questions.
#   Storing them explicitly gives us accurate per-question analytics.
#
# UNIQUE CONSTRAINT:
#   UNIQUE(attempt_id, question_id)
#   → One answer row per question per attempt.
#   → Prevents double-counting if submission is retried.
# =============================================================

from sqlalchemy import (
    Column, Integer, Boolean, SmallInteger,
    ForeignKey, UniqueConstraint, Enum as SAEnum
)
from sqlalchemy.orm import relationship

from backend.database.connection import Base
from backend.models.enums import CorrectOption


class TestAnswer(Base):
    __tablename__ = "test_answers"

    id          = Column(Integer, primary_key=True, index=True)
    attempt_id  = Column(Integer, ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id",     ondelete="CASCADE"), nullable=False, index=True)

    # What the student chose (NULL = skipped)
    selected_option = Column(SAEnum(CorrectOption), nullable=True)

    # Set by grading engine
    is_correct    = Column(Boolean,      nullable=True)
    marks_awarded = Column(SmallInteger, nullable=True)

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_answer_per_question"),
    )

    # Relationships
    attempt  = relationship("TestAttempt", back_populates="answers")
    question = relationship("Question",    back_populates="answers")

    def __repr__(self):
        return (
            f"<TestAnswer attempt={self.attempt_id} q={self.question_id} "
            f"selected={self.selected_option} correct={self.is_correct}>"
        )
