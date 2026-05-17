# =============================================================
# models/subject.py — Academic Subject / Course Entity
# =============================================================
# A Subject is the academic unit being assessed.
# Think of it as a row in the course catalog.
#
# CREDITS — The most important field:
#   Credits represent the "weight" of a subject.
#   A 4-credit subject has twice the impact on SGPA as a 2-credit one.
#   Credits × Grade Points = Weighted contribution to SGPA.
#
# WHY store max_internal and max_external separately?
#   Not all subjects have both internal AND external exams.
#   Practical-only subjects might have max_internal=50, max_external=50.
#   Theory subjects might have max_internal=30, max_external=70.
#   Storing them separately allows accurate percentage calculation.
#
# subject_code must be UNIQUE across the institution.
# "CS301" can only mean one thing — Data Structures, 3 credits, Sem 3.
# =============================================================

from sqlalchemy import (
    Column, Integer, SmallInteger, String, Boolean,
    Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship

from backend.database.connection import Base
from backend.models.enums import Department


class Subject(Base):
    __tablename__ = "subjects"

    id           = Column(Integer, primary_key=True, index=True)
    subject_code = Column(String(20), nullable=False, unique=True)
    subject_name = Column(String(150), nullable=False)
    credits      = Column(SmallInteger, nullable=False)  # 1–6 typically
    department   = Column(SAEnum(Department), nullable=False, index=True)
    semester     = Column(SmallInteger, nullable=False, index=True)

    # Max marks for each component
    max_internal = Column(SmallInteger, default=30, nullable=False)
    max_external = Column(SmallInteger, default=70, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("subject_code", name="uq_subject_code"),
    )

    # Relationships
    results = relationship("Result", back_populates="subject")

    def __repr__(self):
        return f"<Subject {self.subject_code} '{self.subject_name}' {self.credits}cr>"
