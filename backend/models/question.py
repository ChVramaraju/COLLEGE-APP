# =============================================================
# models/question.py — MCQ Question Entity
# =============================================================
# Each row = one MCQ question belonging to a test.
# The MOST SENSITIVE field: correct_option.
#
# CORRECT OPTION SECURITY:
#   This column is NEVER returned to students during an attempt.
#   The service layer returns a "QuestionForStudent" schema that
#   explicitly excludes this field.
#   After submission, it's revealed in the result response.
#
# WHY store correct_option in DB?
#   → Server-side grading: student cannot fake a correct answer
#   → Answer comparison happens entirely on the server
#   → Client never needs to know the answer until after submission
# =============================================================

from sqlalchemy import (
    Column, Integer, SmallInteger, Text, String,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship

from backend.database.connection import Base
from backend.models.enums import CorrectOption


class Question(Base):
    __tablename__ = "questions"

    id       = Column(Integer, primary_key=True, index=True)
    test_id  = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True)

    question_text = Column(Text, nullable=False)
    option_a      = Column(String(500), nullable=False)
    option_b      = Column(String(500), nullable=False)
    option_c      = Column(String(500), nullable=False)
    option_d      = Column(String(500), nullable=False)

    # THE ANSWER — never sent to student until result is revealed
    correct_option = Column(SAEnum(CorrectOption), nullable=False)

    # Marks for THIS question (tests can have varied marks per question)
    marks = Column(SmallInteger, default=1, nullable=False)

    # Display order in the exam
    order_number = Column(SmallInteger, nullable=False, default=1)

    # Relationships
    test    = relationship("Test",       back_populates="questions")
    answers = relationship("TestAnswer", back_populates="question")

    def __repr__(self):
        return f"<Question id={self.id} test={self.test_id} marks={self.marks}>"
