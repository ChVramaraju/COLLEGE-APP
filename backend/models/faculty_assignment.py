from sqlalchemy import (
    Column, Integer, ForeignKey, DateTime, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base


class FacultySectionAssignment(Base):
    __tablename__ = "faculty_section_assignments"

    id = Column(Integer, primary_key=True, index=True)

    faculty_id = Column(
        Integer,
        ForeignKey("faculty.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "faculty_id", "section_id", "subject_id",
            name="uq_faculty_section_subject",
        ),
    )

    faculty = relationship("Faculty", back_populates="section_assignments")
    section = relationship("Section", back_populates="faculty_assignments")
    subject = relationship("Subject")

    def __repr__(self):
        return (
            f"<FacultySectionAssignment faculty={self.faculty_id} "
            f"section={self.section_id} subject={self.subject_id}>"
        )
