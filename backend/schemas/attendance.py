# =============================================================
# schemas/attendance.py — Attendance Request/Response Contracts
# =============================================================
# THREE CATEGORIES:
#   1. Marking schemas  → faculty sends attendance data
#   2. Response schemas → API returns attendance records
#   3. Analytics schemas → calculated summaries, percentages, trends
#
# THE BULK PATTERN (most important schema here):
#   AttendanceBulkMarkRequest contains:
#     → section/date/subject/period metadata (same for whole class)
#     → List[AttendanceEntry] (per-student status within that session)
#
#   This maps to the real workflow:
#     "Faculty is marking attendance for CSE Section A,
#      Mathematics, 3rd period, 14 May 2026"
#     → One set of metadata
#     → 60 per-student entries
#     → ONE API call
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from pydantic import ConfigDict
from typing import Optional, List
from datetime import date

from backend.models.enums import AttendanceStatus


# ---------------------------------------------------------------
# PER-STUDENT ENTRY inside a bulk request
# ---------------------------------------------------------------
class AttendanceEntry(BaseModel):
    """
    One student's status within a bulk attendance session.
    Faculty provides: which student, what status, optional note.
    """
    student_id: int
    status: AttendanceStatus
    remarks: Optional[str] = Field(None, max_length=200)


# ---------------------------------------------------------------
# BULK MARK REQUEST — The main input schema for marking attendance
# ---------------------------------------------------------------
class AttendanceBulkMarkRequest(BaseModel):
    """
    Faculty sends this to POST /attendance/mark

    Contains:
      → Session metadata (same for all students in this marking)
      → List of per-student entries (status for each student)

    VALIDATION:
      → period_number: 1-8
      → attendance_date: cannot be in the future
      → subject: trimmed and title-cased for consistency
      → entries: at least 1 entry required (can't mark empty class)
    """
    section_id: int
    subject: str = Field(..., min_length=2, max_length=100)
    attendance_date: date
    period_number: int = Field(..., ge=1, le=8)
    entries: List[AttendanceEntry] = Field(
        ..., min_length=1,
        description="List of student attendance entries for this session."
    )

    @field_validator("attendance_date")
    @classmethod
    def date_cannot_be_future(cls, v: date) -> date:
        """
        Cannot mark attendance for a future date.
        Prevents pre-marking attendance fraud.
        """
        from datetime import date as date_type
        if v > date_type.today():
            raise ValueError("Attendance date cannot be in the future.")
        return v

    @field_validator("subject")
    @classmethod
    def normalize_subject(cls, v: str) -> str:
        return v.strip().title()   # "mathematics" → "Mathematics"


# ---------------------------------------------------------------
# RESPONSE — Single attendance record
# ---------------------------------------------------------------
class AttendanceResponse(BaseModel):
    """
    Returned when a single attendance record is serialized.
    Used in list responses (student history, section view).
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    faculty_id: Optional[int] = None
    section_id: int
    subject: str
    attendance_date: date
    period_number: int
    status: AttendanceStatus
    remarks: Optional[str] = None


# ---------------------------------------------------------------
# BULK MARK RESPONSE — Summary after bulk insert
# ---------------------------------------------------------------
class AttendanceBulkMarkResponse(BaseModel):
    """
    Returned after POST /attendance/mark
    Tells the faculty what happened — how many records were saved.
    """
    message: str
    section_id: int
    subject: str
    attendance_date: date
    period_number: int
    records_created: int
    present_count: int
    absent_count: int


# ---------------------------------------------------------------
# SUBJECT BREAKDOWN — Analytics per subject
# ---------------------------------------------------------------
class SubjectBreakdown(BaseModel):
    """
    One subject's attendance summary for a student.
    Part of the full analytics response.
    """
    subject: str
    total_classes: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    percentage: float = Field(..., description="Attendance percentage (0-100)")
    is_below_threshold: bool = Field(
        ..., description="True if attendance < 75%"
    )


# ---------------------------------------------------------------
# STUDENT ANALYTICS — Full attendance breakdown for one student
# ---------------------------------------------------------------
class StudentAttendanceAnalytics(BaseModel):
    """
    Returned by GET /attendance/analytics/student/{id}
    Full attendance picture: overall % + per-subject breakdown.

    Used by:
      → Student's own dashboard (view their attendance status)
      → Admin's student management view
      → Faculty's section analytics
    """
    student_id: int
    roll_number: str
    full_name: str
    overall_total: int
    overall_present: int
    overall_percentage: float
    is_low_attendance: bool         # True if overall < 75%
    subject_breakdown: List[SubjectBreakdown]


# ---------------------------------------------------------------
# SECTION ANALYTICS — Summary across all students in a section
# ---------------------------------------------------------------
class SectionAttendanceAnalytics(BaseModel):
    """
    Returned by GET /attendance/analytics/section/{id}
    High-level view for admin/faculty: how is the whole class doing?
    """
    section_id: int
    section_name: str
    total_students: int
    low_attendance_count: int       # students below 75%
    average_attendance_percentage: float
    student_summaries: List[StudentAttendanceAnalytics]


# ---------------------------------------------------------------
# LOW ATTENDANCE ALERT ITEM
# ---------------------------------------------------------------
class LowAttendanceAlert(BaseModel):
    """
    Returned by GET /attendance/analytics/low/{section_id}
    Lists students whose attendance has dropped below the threshold.
    Used to generate warning notices, SMS alerts, etc.
    """
    student_id: int
    roll_number: str
    full_name: str
    overall_percentage: float
    classes_needed_to_reach_75: int   # How many consecutive present needed
