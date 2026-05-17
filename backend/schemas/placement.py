# =============================================================
# schemas/placement.py — Placement Module Pydantic Schemas
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime

from backend.models.enums import ApplicationStatus


# ---------------------------------------------------------------
# JOB POSTING SCHEMAS
# ---------------------------------------------------------------

class JobPostingCreate(BaseModel):
    company_name: str
    role_title: str
    description: Optional[str] = None
    location: Optional[str] = None
    package_lpa: Optional[float] = None
    allowed_departments: Optional[str] = None   # "cse,ece,it" or null for all
    min_cgpa: float = 0.0
    min_attendance_pct: float = 0.0
    application_deadline: Optional[datetime] = None

    @field_validator("min_cgpa")
    @classmethod
    def validate_cgpa(cls, v: float) -> float:
        if not (0.0 <= v <= 10.0):
            raise ValueError("min_cgpa must be between 0.0 and 10.0")
        return v

    @field_validator("min_attendance_pct")
    @classmethod
    def validate_attendance(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("min_attendance_pct must be between 0 and 100")
        return v


class JobPostingUpdate(BaseModel):
    company_name: Optional[str] = None
    role_title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    package_lpa: Optional[float] = None
    allowed_departments: Optional[str] = None
    min_cgpa: Optional[float] = None
    min_attendance_pct: Optional[float] = None
    application_deadline: Optional[datetime] = None
    is_open: Optional[bool] = None
    is_active: Optional[bool] = None


class JobPostingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_name: str
    role_title: str
    description: Optional[str] = None
    location: Optional[str] = None
    package_lpa: Optional[float] = None
    allowed_departments: Optional[str] = None
    min_cgpa: float
    min_attendance_pct: float
    application_deadline: Optional[datetime] = None
    is_active: bool
    is_open: bool
    created_at: Optional[datetime] = None
    total_applications: Optional[int] = None
    is_eligible: Optional[bool] = None       # Populated when student views listing


# ---------------------------------------------------------------
# APPLICATION SCHEMAS
# ---------------------------------------------------------------

class ApplicationCreate(BaseModel):
    job_posting_id: int


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    remarks: Optional[str] = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    job_posting_id: int
    status: ApplicationStatus
    remarks: Optional[str] = None
    applied_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Denormalised fields
    company_name: Optional[str] = None
    role_title: Optional[str] = None
    package_lpa: Optional[float] = None
    roll_number: Optional[str] = None
    student_name: Optional[str] = None


# ---------------------------------------------------------------
# ANALYTICS SCHEMAS
# ---------------------------------------------------------------

class PlacementFunnelStats(BaseModel):
    total_applied: int
    under_review: int
    shortlisted: int
    selected: int
    rejected: int
    withdrawn: int


class DepartmentPlacementStats(BaseModel):
    department: str
    total_students: int
    placed_count: int
    placement_rate: float
    avg_package_lpa: Optional[float] = None
    highest_package_lpa: Optional[float] = None


class CompanyStats(BaseModel):
    company_name: str
    total_openings: int
    total_applications: int
    students_placed: int


class PlacementAnalyticsResponse(BaseModel):
    total_job_postings: int
    active_postings: int
    total_applications: int
    total_placed_students: int
    overall_placement_rate: float
    avg_package_lpa: Optional[float] = None
    highest_package_lpa: Optional[float] = None
    funnel: PlacementFunnelStats
    by_department: List[DepartmentPlacementStats]
    top_companies: List[CompanyStats]
