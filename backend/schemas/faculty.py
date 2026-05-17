# =============================================================
# schemas/faculty.py — Faculty Request/Response Contracts
# =============================================================
# Same layered approach as student schemas.
# Faculty creation = one API call that creates BOTH:
#   → A users row (login account, role="faculty")
#   → A faculty row (professional profile)
#
# Key differences from Student:
#   → Login username = employee_id (not roll_number)
#   → Has designation (seniority level)
#   → Has specialization (teaching focus)
#   → Has joining_date (HR record)
#   → Sections_in_charge is a list (One-to-Many from faculty side)
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from typing import Optional, List
from datetime import date

from backend.models.enums import Department, Designation


# ---------------------------------------------------------------
# NESTED — Lightweight section summary for faculty responses
# ---------------------------------------------------------------
class SectionBriefForFaculty(BaseModel):
    """
    Embedded inside faculty responses to show assigned sections.
    Deliberately minimal — just what the faculty dashboard needs.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department: Department
    semester: int
    academic_year: str


# ---------------------------------------------------------------
# CREATE — Admin sends to register a new faculty member
# ---------------------------------------------------------------
class FacultyCreate(BaseModel):
    """
    Admin sends this to POST /faculty/
    Internally creates BOTH a users row and a faculty row.

    Design: username = employee_id (auto-set in service).
    Faculty login with employee ID, not name, not email.

    Validation:
    → employee_id: 4-20 chars
    → password: minimum 8 chars (faculty accounts get stricter rules)
    """

    # --- User fields ---
    full_name: str = Field(..., min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=8)

    # --- Faculty profile fields ---
    employee_id: str = Field(
        ..., min_length=4, max_length=20,
        description="Official employee ID (e.g., FAC2024001). Becomes login username."
    )
    department: Department
    designation: Designation
    specialization: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)
    joining_date: Optional[date] = None


# ---------------------------------------------------------------
# UPDATE — Admin or faculty can update profile fields
# ---------------------------------------------------------------
class FacultyUpdate(BaseModel):
    """
    All optional — PATCH-style partial updates.
    employee_id and user_id are identity fields — not updatable.
    """
    full_name: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    designation: Optional[Designation] = None
    specialization: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)
    joining_date: Optional[date] = None


# ---------------------------------------------------------------
# RESPONSE — What the API returns for a faculty member
# ---------------------------------------------------------------
class FacultyResponse(BaseModel):
    """
    Base faculty response — no nested data.
    Returned by: POST /faculty/, GET /faculty/{id}
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    employee_id: str
    department: Department
    designation: Designation
    specialization: Optional[str] = None
    phone: Optional[str] = None
    joining_date: Optional[date] = None


# ---------------------------------------------------------------
# DETAILED RESPONSE — Faculty with user info + sections list
# ---------------------------------------------------------------
class FacultyDetailResponse(BaseModel):
    """
    Returned by: GET /faculty/{id}/full
    Includes user info + all sections this faculty is incharge of.

    Use case: faculty dashboard — show their name, dept, sections.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: str
    department: Department
    designation: Designation
    specialization: Optional[str] = None
    phone: Optional[str] = None
    joining_date: Optional[date] = None

    # From the linked user account
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

    # All sections this faculty manages
    sections_in_charge: List[SectionBriefForFaculty] = []
