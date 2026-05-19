# =============================================================
# schemas/faculty_assignment.py — Faculty Assignment API Contracts
# =============================================================
# Three schema layers:
#
#   FacultyAssignmentCreate  — admin POSTs to create an assignment
#   FacultyAssignmentResponse — what the API returns (flattened)
#   AssignedSectionBrief     — compact shape for faculty dropdowns
#
# AssignedSectionBrief is the key type consumed by the frontend
# in every module that needs a "which section + subject?" selector:
#   - Attendance marking
#   - Notes upload
#   - Test creation
#   - Results view
#
# It includes display_label which is pre-built for <select> options:
#   "A • Sem 3 • CSE • Data Structures"
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field
from pydantic import ConfigDict
from typing import Optional
from datetime import datetime


# ---------------------------------------------------------------
# CREATE — Admin assigns a faculty member to a section+subject
# ---------------------------------------------------------------
class FacultyAssignmentCreate(BaseModel):
    """
    POST /admin/faculty-assignments
    Admin specifies which faculty teaches which subject in which section.
    The subject is normalized (strip + title-case) in the service.
    """
    faculty_id: int
    section_id: int
    subject: str = Field(..., min_length=2, max_length=100)
    semester: int = Field(..., ge=1, le=8)


# ---------------------------------------------------------------
# FULL RESPONSE — Returned by list and create endpoints
# ---------------------------------------------------------------
class FacultyAssignmentResponse(BaseModel):
    """
    Returned by GET /admin/faculty-assignments and POST.
    Flattens faculty + section data so the admin UI needs no extra calls.
    """
    model_config = ConfigDict(from_attributes=False)

    id: int
    faculty_id: int
    section_id: int
    subject: str
    semester: int
    assigned_by_admin_id: Optional[int] = None
    created_at: datetime

    # Flattened from Section
    section_name: str
    section_department: str
    section_academic_year: str

    # Flattened from Faculty → User
    faculty_name: str
    faculty_employee_id: str


# ---------------------------------------------------------------
# ASSIGNED SECTION BRIEF — Compact shape for faculty UI dropdowns
# ---------------------------------------------------------------
class AssignedSectionBrief(BaseModel):
    """
    Returned by GET /faculty/me/assignments.
    One item per (section, subject) this faculty is authorised to teach.

    The frontend renders one <option> per item using display_label.
    When selected, section_id + subject are used for the API payload.

    display_label format: "A • Sem 3 • CSE • Data Structures"
    """
    model_config = ConfigDict(from_attributes=False)

    assignment_id: int
    section_id: int
    section_name: str          # "A"
    department: str            # "cse"
    semester: int              # 3
    academic_year: str         # "2024-25"
    subject: str               # "Data Structures"
    display_label: str         # "A • Sem 3 • CSE • Data Structures"
