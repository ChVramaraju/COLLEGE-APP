# =============================================================
# models/job_posting.py — Company Job Posting Model
# =============================================================
# WHY a separate JobPosting table?
#   A single job opening has attributes independent of any student:
#   company name, role, package, eligibility criteria, deadline.
#   Many students apply to ONE posting → one-to-many relationship.
#   Separating it allows the admin to manage the posting lifecycle
#   (open/close) independently of the applications.
#
# ELIGIBILITY CRITERIA design:
#   min_cgpa and min_attendance_pct are stored on the posting.
#   allowed_departments is a comma-separated string ("cse,ece,it").
#   WHY not a separate DeptEligibility table?
#   → College placement rules are simple (3-5 depts per job)
#   → A string is faster to filter in Python without a JOIN
#   → A proper ARRAY type (PostgreSQL) would be better in production,
#     but plain SQLAlchemy 1.4 + portability keeps it as String.
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text,
    ForeignKey, DateTime
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base


class JobPosting(Base):
    __tablename__ = "job_postings"

    # -------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -------------------------------------------------------
    # COMPANY & ROLE
    # -------------------------------------------------------
    company_name = Column(String(200), nullable=False)
    role_title   = Column(String(200), nullable=False)
    description  = Column(Text, nullable=True)
    location     = Column(String(200), nullable=True)

    # -------------------------------------------------------
    # PACKAGE — in Lakhs Per Annum (LPA)
    # Float is fine here; this is display data, not financial arithmetic.
    # -------------------------------------------------------
    package_lpa  = Column(Float, nullable=True)   # e.g. 6.5 = ₹6.5 LPA

    # -------------------------------------------------------
    # ELIGIBILITY CRITERIA
    # -------------------------------------------------------
    # Comma-separated department values: "cse,ece,it"
    # Empty or NULL = all departments eligible
    allowed_departments  = Column(String(500), nullable=True)
    min_cgpa             = Column(Float, default=0.0, nullable=False)
    min_attendance_pct   = Column(Float, default=0.0, nullable=False)

    # -------------------------------------------------------
    # APPLICATION WINDOW
    # -------------------------------------------------------
    application_deadline = Column(DateTime(timezone=True), nullable=True)

    # -------------------------------------------------------
    # LIFECYCLE FLAGS
    # -------------------------------------------------------
    is_active = Column(Boolean, default=True, nullable=False)
    # is_open: admin can close applications manually before deadline
    is_open   = Column(Boolean, default=True, nullable=False)

    # -------------------------------------------------------
    # AUDIT
    # -------------------------------------------------------
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # -------------------------------------------------------
    # RELATIONSHIPS
    # -------------------------------------------------------
    applications = relationship(
        "PlacementApplication",
        back_populates="job_posting",
        lazy="select",
    )
    creator = relationship("User", foreign_keys=[created_by], lazy="select")
