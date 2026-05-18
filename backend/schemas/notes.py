# =============================================================
# schemas/notes.py — Notes Request/Response Contracts
# =============================================================
# WHY SCHEMAS MATTER MORE HERE THAN IN OTHER MODULES:
#
# File uploads use multipart/form-data — a different content type
# than JSON. FastAPI can't use a Pydantic model for the request
# body of a file upload. Instead, each text field is Form().
#
# BUT we still use Pydantic for:
#   → Response serialization (what we return to clients)
#   → Ensuring file_path is NEVER included in responses
#   → Consistent metadata shape across endpoints
#
# SECURITY: NoteResponse intentionally EXCLUDES:
#   → file_path (internal server path — must never be exposed)
#   → file_name (UUID name — meaningless and unnecessary to expose)
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


# ---------------------------------------------------------------
# NOTE RESPONSE — Safe public representation of a note
# ---------------------------------------------------------------
class NoteResponse(BaseModel):
    """
    Returned for list endpoints and after upload.

    DELIBERATELY MISSING:
      → file_path: attacker could learn server filesystem structure
      → file_name: UUID is internal, meaningless to users

    INCLUDES:
      → id: used to construct /notes/{id}/download URL
      → original_file_name: what users see ("Chapter5_DS.pdf")
      → file_size: displayed in UI ("1.2 MB")
      → mime_type: UI knows which icon to show
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    faculty_id: int
    section_id: int
    subject: str
    title: str
    description: Optional[str] = None
    original_file_name: str
    file_size: int
    mime_type: str
    is_active: bool
    uploaded_at: Optional[datetime] = None

    @property
    def file_size_display(self) -> str:
        """Human-readable file size: '1.2 MB', '450 KB'"""
        if self.file_size >= 1_048_576:
            return f"{self.file_size / 1_048_576:.1f} MB"
        elif self.file_size >= 1_024:
            return f"{self.file_size / 1_024:.1f} KB"
        return f"{self.file_size} B"


# ---------------------------------------------------------------
# NOTE DETAIL RESPONSE — With uploader info
# ---------------------------------------------------------------
class FacultyBriefForNote(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: str


class NoteDetailResponse(NoteResponse):
    """
    Extended response with faculty uploader info.
    Used for single note GET requests.
    """
    faculty: Optional[FacultyBriefForNote] = None


# ---------------------------------------------------------------
# NOTE UPDATE SCHEMA — Only metadata fields can be updated
# ---------------------------------------------------------------
class NoteUpdate(BaseModel):
    """
    PATCH schema — only title/description/subject can be changed.
    The actual file cannot be changed — must delete and re-upload.
    This is by design: immutable files, mutable metadata.
    """
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, min_length=2, max_length=100)


# ---------------------------------------------------------------
# FACULTY NOTE RESPONSE — Extends NoteResponse with management fields
# ---------------------------------------------------------------
class FacultyNoteResponse(NoteResponse):
    """
    Returned by faculty-only endpoints.

    EXTENDS NoteResponse with:
      → is_published: whether this note is visible to students.
                      Not included in student-facing NoteResponse —
                      students never need to know the draft/publish status.
      → updated_at:   last metadata or file update timestamp.
                      Useful for the faculty dashboard "last edited" column.

    WHY extend NoteResponse instead of creating a new model?
      → DRY: NoteResponse already excludes file_path, file_name.
        FacultyNoteResponse inherits that safety automatically.
      → Substitutability: any consumer of NoteResponse can safely
        receive a FacultyNoteResponse — extra fields are ignored.
    """
    is_published: bool = False
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------
# PUBLISH TOGGLE SCHEMA — PATCH /notes/{id}/publish
# ---------------------------------------------------------------
class NotePublishToggle(BaseModel):
    """
    Payload for toggling publish state.

    WHY a dedicated schema instead of NoteUpdate?
      → Separation of concerns: publish/unpublish is a LIFECYCLE ACTION,
        not a metadata edit. It triggers different business logic
        (e.g. student notification on publish).
      → Clarity at the API level: PATCH /notes/{id}/publish communicates
        intent far better than PATCH /notes/{id} with { is_published: true }.
      → Security: NoteUpdate intentionally cannot change is_published.
        Keeping them separate prevents accidental privilege escalation where
        a metadata update accidentally exposes a draft note.
    """
    is_published: bool
