# =============================================================
# models/grade_scale.py — Grade Lookup Table
# =============================================================
# The GradeScale table is the SINGLE SOURCE OF TRUTH for:
#   percentage → grade letter → grade points
#
# WHY A DB TABLE instead of hardcoded Python?
#   → Institutions change grading scales (CBCS revisions, etc.)
#   → Admin can adjust cutoffs without code deployment
#   → Same data powers both calculation AND display
#   → Historical results reference the scale that was active then
#
# This table is seeded once on startup (see utils/seed_data.py).
# It should never be empty — startup seed ensures at least the
# default 10-point CBCS scale is always present.
# =============================================================

from sqlalchemy import Column, Integer, Float, String, Boolean
from backend.database.connection import Base


class GradeScale(Base):
    __tablename__ = "grade_scales"

    id            = Column(Integer, primary_key=True, index=True)
    min_percentage = Column(Float, nullable=False)
    max_percentage = Column(Float, nullable=False)
    grade         = Column(String(5),  nullable=False, unique=True)
    grade_points  = Column(Float,  nullable=False)
    description   = Column(String(50), nullable=True)
    is_pass       = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return (
            f"<GradeScale {self.grade} "
            f"[{self.min_percentage}-{self.max_percentage}%] = {self.grade_points}GP>"
        )
