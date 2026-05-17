# =============================================================
# schemas/section.py — Section Request/Response Contracts
# =============================================================
# A section is the "classroom unit" of the ERP.
# It connects: department + semester + group + year + faculty + students
#
# Section schemas are simpler than student/faculty because
# sections don't create user accounts — they're pure academic data.
#
# Key validation:
#   → semester must be 1-8
#   → academic_year must match "YYYY-YY" format (e.g., "2024-25")
#   → name should be short (A, B, C, or CSE-A, etc.)
#   → Composite uniqueness is enforced at DB level (via constraint)
#     but we describe it in the schema docs for API consumers
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from pydantic import ConfigDict
from typing import Optional, List
import re

from backend.models.enums import Department


# ---------------------------------------------------------------
# NESTED — Lightweight student info for section roster
# ---------------------------------------------------------------
class StudentBriefForSection(BaseModel):
    """
    Minimal student info embedded in section detail responses.
    A section with 60 students doesn't return full profiles for each —
    just enough for a roster view.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    roll_number: str
    semester: int


# ---------------------------------------------------------------
# NESTED — Faculty info embedded in section responses
# ---------------------------------------------------------------
class FacultyBriefForSection(BaseModel):
    """
    Brief faculty info embedded in section detail responses.
    Shows who is incharge without returning full faculty profile.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: str
    full_name: Optional[str] = None


# ---------------------------------------------------------------
# CREATE — Admin sends to create a new section
# ---------------------------------------------------------------
class SectionCreate(BaseModel):
    """
    Admin sends this to POST /sections/

    The DB-level unique constraint prevents duplicates, but we
    document the rule here so API consumers know the rule before
    hitting a 409 error.

    academic_year format: "2024-25" (4 digit year, hyphen, 2 digit year)
    """
    name: str = Field(
        ..., min_length=1, max_length=5,
        description="Section label: 'A', 'B', 'C', or 'CSE-A', etc."
    )
    department: Department
    semester: int = Field(..., ge=1, le=8)
    academic_year: str = Field(
        ..., min_length=7, max_length=10,
        description="Format: '2024-25'. Must be unique per dept+semester+name."
    )
    incharge_faculty_id: Optional[int] = None
    max_strength: int = Field(default=60, ge=10, le=200)

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year_format(cls, v: str) -> str:
        """
        Enforce "YYYY-YY" format.
        "2024-25" → valid
        "2024-2025" → invalid (too long)
        "24-25" → invalid (year too short)
        """
        pattern = r"^\d{4}-\d{2}$"
        if not re.match(pattern, v):
            raise ValueError("academic_year must be in 'YYYY-YY' format (e.g., '2024-25')")
        return v

    @field_validator("name")
    @classmethod
    def normalize_section_name(cls, v: str) -> str:
        return v.upper().strip()


# ---------------------------------------------------------------
# UPDATE — Admin can update section metadata
# ---------------------------------------------------------------
class SectionUpdate(BaseModel):
    """
    Partial updates — reassign incharge faculty, adjust max_strength, etc.
    name/department/semester/academic_year are identity fields — immutable.
    """
    incharge_faculty_id: Optional[int] = None
    max_strength: Optional[int] = Field(None, ge=10, le=200)


# ---------------------------------------------------------------
# RESPONSE — Clean section data returned by the API
# ---------------------------------------------------------------
class SectionResponse(BaseModel):
    """
    Returned by: POST /sections/, GET /sections/{id}
    Basic section info — no nested data.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department: Department
    semester: int
    academic_year: str
    incharge_faculty_id: Optional[int] = None
    max_strength: int


# ---------------------------------------------------------------
# DETAILED RESPONSE — Section with faculty + student roster
# ---------------------------------------------------------------
class SectionDetailResponse(BaseModel):
    """
    Returned by: GET /sections/{id}/full
    Full section context: incharge faculty + student list.

    The student list uses StudentBriefForSection (minimal data).
    For full student profiles: call GET /students/{id} individually.
    This is intentional — avoid massive payloads for large sections.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department: Department
    semester: int
    academic_year: str
    max_strength: int

    # Embedded incharge faculty — None if not yet assigned
    incharge_faculty: Optional[FacultyBriefForSection] = None

    # Student roster — brief info only
    students: List[StudentBriefForSection] = []
