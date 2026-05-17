# =============================================================
# models/semester_result.py — Aggregated Semester GPA Record
# =============================================================
# One row = one student's complete semester performance summary.
# This is generated AFTER all subject results are published.
#
# SGPA vs CGPA:
#   SGPA (Semester GPA): Performance in THIS semester only
#   CGPA (Cumulative GPA): Performance across ALL semesters so far
#
#   CGPA is stored here (recalculated on each semester generation)
#   because it requires all previous semester data.
#   Storing CGPA avoids recalculating it on every transcript request.
#
# credits_earned vs total_credits:
#   total_credits: All credits ATTEMPTED in this semester
#   credits_earned: Credits where student passed (grade != F)
#
#   A student with 20 total_credits but only 17 credits_earned
#   has 3 credits worth of backlogs to clear.
#   This drives the "backlog count" display in dashboards.
#
# result_status:
#   "pass" = credits_earned == total_credits (all subjects cleared)
#   "fail" = any subject has grade F
#   "pending" = not all results published yet
#   "withheld" = administrative hold (fee default, disciplinary, etc.)
# =============================================================

from sqlalchemy import (
    Column, Integer, SmallInteger, Float, String,
    ForeignKey, Enum as SAEnum, DateTime, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import ResultStatus


class SemesterResult(Base):
    __tablename__ = "semester_results"

    id         = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)

    semester      = Column(SmallInteger, nullable=False)
    academic_year = Column(String(10), nullable=False)  # "2024-25"

    # GPA metrics
    sgpa = Column(Float, nullable=False)
    cgpa = Column(Float, nullable=False)

    # Credits
    total_credits   = Column(SmallInteger, nullable=False)
    credits_earned  = Column(SmallInteger, nullable=False)

    result_status = Column(SAEnum(ResultStatus), nullable=False, default=ResultStatus.pending)
    generated_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("student_id", "semester", "academic_year", name="uq_semester_result"),
        Index("ix_sem_result_student", "student_id", "academic_year"),
    )

    student = relationship("Student", back_populates="semester_results")

    def __repr__(self):
        return (
            f"<SemesterResult stu={self.student_id} "
            f"sem={self.semester} {self.academic_year} "
            f"SGPA={self.sgpa} CGPA={self.cgpa} {self.result_status}>"
        )
