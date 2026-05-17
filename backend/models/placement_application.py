# =============================================================
# models/placement_application.py — Student Application Record
# =============================================================
# WHY a separate table instead of adding columns to Student?
#   One student can apply to MANY jobs.
#   One job has MANY applicants.
#   This is a classic many-to-many resolved into an association
#   table — but with extra attributes (status, remarks, applied_at)
#   which is why it becomes a full entity ("Application"), not
#   just a link table.
#
# UNIQUENESS CONSTRAINT:
#   (student_id, job_posting_id) must be unique.
#   A student can only apply ONCE per posting.
#   Second application attempt → 409 Conflict.
#
# STATUS LIFECYCLE:
#   applied → under_review → shortlisted → selected (placed!)
#                                        → rejected
#   Student can: withdrawn (before shortlisted)
#   Admin can: move forward OR reject at any stage
# =============================================================

from sqlalchemy import (
    Column, Integer, Text, DateTime, ForeignKey,
    Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import ApplicationStatus


class PlacementApplication(Base):
    __tablename__ = "placement_applications"

    # -------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -------------------------------------------------------
    # FOREIGN KEYS
    # -------------------------------------------------------
    student_id     = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True)

    # -------------------------------------------------------
    # STATUS — tracks where in the hiring pipeline this student is
    # -------------------------------------------------------
    status = Column(
        SAEnum(ApplicationStatus, name="applicationstatus"),
        default=ApplicationStatus.applied,
        nullable=False,
    )

    # -------------------------------------------------------
    # ADMIN REMARKS — e.g. "Resume shortlisted, interview on 20-Jun"
    # -------------------------------------------------------
    remarks = Column(Text, nullable=True)

    # -------------------------------------------------------
    # TIMESTAMPS
    # -------------------------------------------------------
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # -------------------------------------------------------
    # UNIQUENESS — one application per student per job
    # -------------------------------------------------------
    __table_args__ = (
        UniqueConstraint("student_id", "job_posting_id", name="uq_student_job_application"),
    )

    # -------------------------------------------------------
    # RELATIONSHIPS
    # -------------------------------------------------------
    student     = relationship("Student",     foreign_keys=[student_id],     lazy="select")
    job_posting = relationship("JobPosting",  foreign_keys=[job_posting_id], back_populates="applications", lazy="select")
