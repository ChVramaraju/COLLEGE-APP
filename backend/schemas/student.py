# =============================================================
# schemas/student.py — Student Request/Response Contracts
# =============================================================
# WHY SCHEMAS EXIST (DEEPLY):
#
#   SQLAlchemy models are database-layer objects. They carry
#   DB-specific metadata: column types, FK constraints, lazy
#   loaders, session state. You must NEVER return them directly
#   to the client because:
#     → They expose hashed_password (security breach)
#     → They contain DB internals clients don't need
#     → They can trigger accidental lazy-load queries during
#       JSON serialization (N+1 query problems)
#     → They provide no input validation
#
#   Pydantic schemas are HTTP-layer objects. Pure data contracts.
#   No DB knowledge. No session state. Just shapes of data.
#
# THREE SCHEMA TIERS:
#   1. StudentCreate  → what admin sends to create a student
#   2. StudentUpdate  → what admin sends to update a student
#   3. StudentResponse → what the API returns (safe, clean)
#
# NESTED SCHEMAS:
#   StudentWithSectionResponse embeds section info.
#   No extra API calls needed — one request returns full context.
#   This is called "response composition" — standard in ERP APIs.
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic import ConfigDict
from typing import Optional
from datetime import date

from backend.models.enums import Department


# ---------------------------------------------------------------
# NESTED — Section summary embedded inside student responses
# ---------------------------------------------------------------
class SectionSummary(BaseModel):
    """
    A lightweight section representation for embedding.
    We DON'T embed the full Section schema here — that would cause
    circular schema references and return too much data.
    Just the fields a student/admin needs at a glance.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department: Department
    semester: int
    academic_year: str


# ---------------------------------------------------------------
# CREATE — What admin sends to register a new student
# ---------------------------------------------------------------
class StudentCreate(BaseModel):
    """
    Admin sends this to POST /students/
    Internally creates BOTH a users row and a students row.

    Design: username = roll_number (auto-set in service).
    Admin never manually sets username — roll_number IS the username.

    Validation rules:
    → roll_number: 4-20 chars, alphanumeric (e.g., "21CSE001")
    → semester: must be 1-8
    → admission_year: realistic 4-digit year
    → password: minimum 6 chars
    """

    # --- User fields (will create the login account) ---
    full_name: str = Field(..., min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6, description="Initial login password")

    # --- Student profile fields ---
    roll_number: str = Field(
        ..., min_length=4, max_length=20,
        description="Official roll number (e.g., 21CSE001). Becomes the login username."
    )
    department: Department
    semester: int = Field(..., ge=1, le=8, description="Current semester (1–8)")
    admission_year: int = Field(..., ge=2000, le=2100)

    # --- Optional profile fields ---
    date_of_birth: Optional[date] = None
    phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=300)
    guardian_name: Optional[str] = Field(None, max_length=100)
    guardian_phone: Optional[str] = Field(None, max_length=15)
    section_id: Optional[int] = None

    @field_validator("roll_number")
    @classmethod
    def roll_number_must_be_alphanumeric(cls, v: str) -> str:
        """
        Roll numbers like "21CSE001" are alphanumeric.
        Reject anything with spaces or special characters.
        """
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Roll number must be alphanumeric (hyphens/underscores allowed)")
        return v.upper()   # Normalize to uppercase — "21cse001" → "21CSE001"


# ---------------------------------------------------------------
# UPDATE — What admin sends to modify an existing student
# ---------------------------------------------------------------
class StudentUpdate(BaseModel):
    """
    All fields are Optional — supports PARTIAL updates.
    Admin can update just the semester, or just the section, etc.
    In HTTP terms: this maps to PATCH (partial update).

    Fields NOT in this schema (roll_number, user_id) cannot be
    changed via API — they are identity fields, immutable after creation.
    """
    full_name: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    semester: Optional[int] = Field(None, ge=1, le=8)
    section_id: Optional[int] = None
    phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=300)
    guardian_name: Optional[str] = Field(None, max_length=100)
    guardian_phone: Optional[str] = Field(None, max_length=15)
    date_of_birth: Optional[date] = None


# ---------------------------------------------------------------
# RESPONSE — What the API returns for a student
# ---------------------------------------------------------------
class StudentResponse(BaseModel):
    """
    Returned by: GET /students/{id}, POST /students/, etc.

    Notice: NO password, NO hashed_password.
    We include user_id so the frontend can reference the auth record
    if needed, but the password lives only in the DB — never in responses.

    from_attributes=True (Pydantic v2) tells Pydantic to read from
    SQLAlchemy ORM attributes (not just dict keys).
    Without this, Pydantic can't convert db_student → StudentResponse.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    roll_number: str
    department: Department
    semester: int
    admission_year: int
    phone: Optional[str] = None
    address: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    section_id: Optional[int] = None


# ---------------------------------------------------------------
# DETAILED RESPONSE — Student with full nested context
# ---------------------------------------------------------------
class StudentDetailResponse(BaseModel):
    """
    Returned by: GET /students/{id}/full
    Includes embedded user info + section info in ONE response.

    WHY embed instead of making multiple API calls?
    → Frontend renders the full student profile in ONE request
    → No "waterfall" of: fetch student → fetch user → fetch section
    → More efficient — one DB query with joins
    → Standard ERP API pattern
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int          # FK to users.id — needed for cross-module operations (notifications, etc.)
    roll_number: str
    department: Department
    semester: int
    admission_year: int
    phone: Optional[str] = None
    address: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    date_of_birth: Optional[date] = None

    # Embedded: user account info (safe fields only)
    full_name: Optional[str] = None    # accessed via student.user.full_name
    email: Optional[str] = None        # accessed via student.user.email
    is_active: Optional[bool] = None   # accessed via student.user.is_active

    # Embedded: section summary (None if not yet assigned)
    section: Optional[SectionSummary] = None
