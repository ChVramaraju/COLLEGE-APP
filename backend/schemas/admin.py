# =============================================================
# schemas/admin.py — Admin Dashboard API Response Contracts
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator
from typing import Optional, List, Any
from datetime import datetime
import enum

from backend.models.user import UserRole
from backend.models.enums import Department, NotificationType


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
    id:          int
    username:    str
    full_name:   Optional[str] = None
    email:       Optional[str] = None
    role:        UserRole
    is_active:   bool
    created_at:  Optional[datetime] = None
    # Role-specific profile fields (populated by model_validator below)
    section_id:  Optional[int]  = None
    semester:    Optional[int]  = None
    department:  Optional[str]  = None
    designation: Optional[str]  = None

    @model_validator(mode='before')
    @classmethod
    def extract_profile_fields(cls, data: Any) -> Any:
        """Convert ORM User object → dict, injecting profile fields."""
        if isinstance(data, dict):
            return data
        result = {
            'id':          getattr(data, 'id',         None),
            'username':    getattr(data, 'username',   None),
            'full_name':   getattr(data, 'full_name',  None),
            'email':       getattr(data, 'email',      None),
            'role':        getattr(data, 'role',       None),
            'is_active':   getattr(data, 'is_active',  None),
            'created_at':  getattr(data, 'created_at', None),
            'section_id':  None,
            'semester':    None,
            'department':  None,
            'designation': None,
        }
        role = getattr(data, 'role', None)
        role_val = role.value if role and hasattr(role, 'value') else (str(role) if role else None)
        if role_val == 'student':
            sp = getattr(data, 'student_profile', None)
            if sp is not None:
                result['section_id'] = getattr(sp, 'section_id', None)
                sem = getattr(sp, 'semester', None)
                result['semester']   = int(sem) if sem is not None else None
                dept = getattr(sp, 'department', None)
                result['department'] = dept.value if dept is not None else None
        elif role_val == 'faculty':
            fp = getattr(data, 'faculty_profile', None)
            if fp is not None:
                dept  = getattr(fp, 'department',  None)
                desig = getattr(fp, 'designation', None)
                result['department']  = dept.value  if dept  is not None else None
                result['designation'] = desig.value if desig is not None else None
        return result


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


# ---------------------------------------------------------------
# SYSTEM HEALTH
# ---------------------------------------------------------------

class SystemHealthResponse(BaseModel):
    ws_connections: int
    total_users: int
    active_students: int
    active_faculty: int
    total_notifications_sent: int
    total_files_uploaded: int
    total_attendance_records: int
    total_test_attempts: int
    total_sections: int
    generated_at: datetime


# ---------------------------------------------------------------
# ANNOUNCEMENTS
# ---------------------------------------------------------------

class AnnouncementAudience(str, enum.Enum):
    all      = "all"
    students = "student"
    faculty  = "faculty"


class AnnouncementRequest(BaseModel):
    title:             str
    message:           str
    audience:          AnnouncementAudience = AnnouncementAudience.all
    notification_type: NotificationType     = NotificationType.announcement


class AnnouncementResponse(BaseModel):
    recipients_count: int
    message:          str


# ---------------------------------------------------------------
# ANALYTICS TRENDS (monthly)
# ---------------------------------------------------------------

class TrendsMonthPoint(BaseModel):
    month:                    str   # "Jan 2025"
    notifications_count:      int
    test_attempts_count:      int
    attendance_records_count: int


class TrendsResponse(BaseModel):
    monthly_data:              List[TrendsMonthPoint]
    dept_student_distribution: List[dict]   # [{"dept": "cse", "count": 50}]
    gpa_distribution:          dict


# ---------------------------------------------------------------
# ACTIVITY FEED (recent system events)
# ---------------------------------------------------------------

class ActivityItem(BaseModel):
    id:                int
    title:             str
    message:           str
    notification_type: str
    created_at:        Optional[datetime] = None


# ---------------------------------------------------------------
# USER ADMINISTRATION — CRUD schemas
# ---------------------------------------------------------------

class CreateUserRequest(BaseModel):
    """
    Admin-triggered user creation.
    username = roll_number for students, employee_id for faculty.
    Role-specific fields validated via model_validator.
    """
    full_name:     str
    username:      str
    email:         Optional[EmailStr] = None
    password:      str
    role:          UserRole
    # student-specific
    department:    Optional[str] = None
    semester:      Optional[int] = None
    section_id:    Optional[int] = None
    admission_year: Optional[int] = None
    # faculty-specific
    designation:   Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_length(cls, v: str) -> str:
        if len(v.strip()) < 4:
            raise ValueError("Username must be at least 4 characters.")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be blank.")
        return v.strip()

    @model_validator(mode="after")
    def validate_role_specific(self) -> "CreateUserRequest":
        if self.role == UserRole.student:
            if not self.department:
                raise ValueError("department is required for students.")
            if self.semester is None:
                raise ValueError("semester is required for students.")
            if not (1 <= self.semester <= 8):
                raise ValueError("semester must be between 1 and 8.")
        elif self.role == UserRole.faculty:
            if not self.department:
                raise ValueError("department is required for faculty.")
            if not self.designation:
                raise ValueError("designation is required for faculty.")
        return self


class UpdateUserRequest(BaseModel):
    """
    Partial-update for any user.  All fields optional.
    model_fields_set is used by the service to distinguish
    'not provided' from 'explicitly set to None'.
    """
    full_name:   Optional[str]      = None
    email:       Optional[EmailStr] = None
    # student profile
    section_id:  Optional[int]      = None   # None = unassign; absent = no change
    semester:    Optional[int]      = None
    # faculty profile
    department:  Optional[str]      = None
    designation: Optional[str]      = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Full name cannot be blank.")
        return v.strip() if v else v

    @field_validator("semester")
    @classmethod
    def semester_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 8):
            raise ValueError("Semester must be between 1 and 8.")
        return v


class ResetPasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class DeleteUserResponse(BaseModel):
    user_id: int
    message: str


class DeptOption(BaseModel):
    value: str
    label: str


class DepartmentsDataResponse(BaseModel):
    departments:  List[DeptOption]
    designations: List[DeptOption]
