# =============================================================
# schemas/admin.py — Admin Dashboard API Response Contracts
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

from backend.models.user import UserRole
from backend.models.enums import Department


# ---------------------------------------------------------------
# DASHBOARD — Single endpoint that returns all institution stats
# ---------------------------------------------------------------

class UserSummary(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    by_role: dict     # {"student": 50, "faculty": 10, "admin": 2}


class StudentSummary(BaseModel):
    total_students: int
    active_students: int
    by_department: dict
    by_semester: dict


class FacultySummary(BaseModel):
    total_faculty: int
    active_faculty: int
    by_department: dict


class AttendanceSummary(BaseModel):
    total_records: int
    institution_avg_percentage: float
    below_75_count: int      # Students with <75% attendance


class TestSummary(BaseModel):
    total_tests: int
    published_tests: int
    total_attempts: int
    avg_score_percentage: float


class ResultSummary(BaseModel):
    total_results: int
    published_results: int
    overall_pass_rate: float
    avg_percentage: float


class NotificationSummary(BaseModel):
    total_sent: int
    unread_count: int


class DashboardResponse(BaseModel):
    """
    The single most powerful endpoint in the entire system.
    One HTTP call gives the admin a complete picture of the institution.
    This is the 'control room view'.
    """
    users: UserSummary
    students: StudentSummary
    faculty: FacultySummary
    sections: dict           # {"total": 5, "active": 4}
    attendance: AttendanceSummary
    tests: TestSummary
    results: ResultSummary
    notifications: NotificationSummary
    generated_at: datetime


# ---------------------------------------------------------------
# USER MANAGEMENT SCHEMAS
# ---------------------------------------------------------------

class UserAdminView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: Optional[datetime] = None


class UserStatusUpdate(BaseModel):
    is_active: bool


# ---------------------------------------------------------------
# CROSS-MODULE ANALYTICS
# ---------------------------------------------------------------

class DepartmentPerformance(BaseModel):
    department: str
    student_count: int
    avg_cgpa: Optional[float] = None
    avg_attendance_pct: Optional[float] = None
    pass_rate: Optional[float] = None


class SectionPerformance(BaseModel):
    section_id: int
    section_name: str
    student_count: int
    avg_attendance_pct: Optional[float] = None
    avg_cgpa: Optional[float] = None


class TopPerformer(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    department: str
    cgpa: Optional[float] = None
    attendance_pct: Optional[float] = None


class InstitutionAnalyticsResponse(BaseModel):
    department_performance: List[DepartmentPerformance]
    section_performance: List[SectionPerformance]
    top_performers: List[TopPerformer]
    low_attendance_students: List[dict]
    gpa_distribution: dict   # {"8.0-9.0": 12, "7.0-8.0": 18, ...}
