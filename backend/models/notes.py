# =============================================================
# models/notes.py — Notes Metadata Table
# =============================================================
# GOLDEN RULE OF DOCUMENT MANAGEMENT:
#   PostgreSQL stores METADATA about files.
#   The filesystem stores the ACTUAL FILES.
#
# This table answers:
#   → "Who uploaded this?" (faculty_id)
#   → "For which class?" (section_id, subject)
#   → "What is it called?" (title, description)
#   → "Where is it on disk?" (file_path — internal, never exposed)
#   → "What kind of file?" (mime_type)
#   → "How big is it?" (file_size)
#   → "Is it still available?" (is_active)
#
# WHAT THIS TABLE DOES NOT STORE:
#   → The actual file bytes (those live in uploads/notes/)
#   → The raw file_path in API responses (security: path leakage)
#
# VOLUME: A college with 50 faculty × 10 subjects × 10 notes each
#   = 5,000 rows. This table will always be small.
#   The FILESYSTEM is where the volume grows (gigabytes of PDFs).
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    BigInteger, ForeignKey, DateTime, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base


class Note(Base):
    __tablename__ = "notes"

    # -----------------------------------------------------------------
    # PRIMARY KEY
    # -----------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # WHO UPLOADED — FK to faculty.id
    # -----------------------------------------------------------------
    # ondelete="CASCADE": If the faculty account is hard-deleted,
    # their notes metadata is deleted too.
    # In practice, soft-delete means this rarely fires.
    # -----------------------------------------------------------------
    faculty_id = Column(
        Integer,
        ForeignKey("faculty.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # FOR WHICH SECTION — FK to sections.id
    # -----------------------------------------------------------------
    # Notes are scoped to a section. Students in Section A
    # only see notes uploaded for Section A.
    # -----------------------------------------------------------------
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------------------
    # ACADEMIC CONTEXT
    # -----------------------------------------------------------------
    subject = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # -----------------------------------------------------------------
    # FILE METADATA — The core of this table
    # -----------------------------------------------------------------

    # What the faculty named their file: "Chapter 5 DS Notes.pdf"
    # Returned in download responses so browser shows correct filename.
    original_file_name = Column(String(255), nullable=False)

    # What we renamed it to on disk: "3f7a2c1d-e849-4b2f.pdf"
    # Unique to prevent any filename collision.
    file_name = Column(String(255), nullable=False, unique=True)

    # Absolute path on disk: "/app/backend/uploads/notes/3f7a2c1d.pdf"
    # NEVER included in API responses — internal reference only.
    file_path = Column(String(500), nullable=False)

    # File size in bytes. BigInteger handles files up to 9 exabytes.
    # Integer (4 bytes) maxes at ~2GB — fine but BigInteger is safer.
    file_size = Column(BigInteger, nullable=False)

    # MIME type: "application/pdf", "application/vnd.ms-powerpoint", etc.
    # Stored so download endpoint sends correct Content-Type header.
    mime_type = Column(String(100), nullable=False)

    # -----------------------------------------------------------------
    # PUBLISH STATE
    # -----------------------------------------------------------------
    # is_published=False → draft: only the uploader can see it.
    # is_published=True  → live: students in the section can see it.
    #
    # DEFAULT STRATEGY:
    #   server_default='true'  → existing rows in the DB become published
    #                            when the migration runs (backward compat).
    #   default=False          → new Python-created Note objects start as
    #                            drafts unless auto_publish=True is passed.
    #
    # WHY separate from is_active?
    #   is_active = soft-delete flag (governs DB existence)
    #   is_published = visibility flag (governs student access)
    #   A note can be: active+unpublished (draft), active+published (live),
    #   inactive+unpublished (deleted draft). These are independent axes.
    is_published = Column(Boolean, default=False, nullable=False, server_default="true")

    # -----------------------------------------------------------------
    # SOFT DELETE
    # -----------------------------------------------------------------
    is_active = Column(Boolean, default=True, nullable=False)

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    # -----------------------------------------------------------------
    # TABLE INDEXES
    # -----------------------------------------------------------------
    __table_args__ = (
        # Most common query: "Show me all notes for Section X, Subject Y"
        Index("ix_notes_section_subject", "section_id", "subject"),
    )

    # =================================================================
    # ORM RELATIONSHIPS
    # =================================================================
    faculty = relationship("Faculty", back_populates="uploaded_notes")
    section = relationship("Section", back_populates="notes")

    def __repr__(self):
        return (
            f"<Note id={self.id} title='{self.title}' "
            f"subject={self.subject} section={self.section_id}>"
        )
