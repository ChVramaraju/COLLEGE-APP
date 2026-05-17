# =============================================================
# schemas/result.py — Academic Result Request/Response Contracts
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime

from backend.models.enums import Department, ExamType, ResultStatus


# ---------------------------------------------------------------
# SUBJECT SCHEMAS
# ---------------------------------------------------------------

class SubjectCreate(BaseModel):
    subject_code: str = Field(..., min_length=2, max_length=20)
    subject_name: str = Field(..., min_length=3, max_length=150)
    credits: int = Field(..., ge=1, le=6)
    department: Department
    semester: int = Field(..., ge=1, le=8)
    max_internal: int = Field(default=30, ge=0, le=100)
    max_external: int = Field(default=70, ge=0, le=100)

    @field_validator("subject_code")
    @classmethod
    def upper_code(cls, v: str) -> str:
        return v.strip().upper()


class SubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subject_code: str
    subject_name: str
    credits: int
    department: Department
    semester: int
    max_internal: int
    max_external: int
    is_active: bool


# ---------------------------------------------------------------
# RESULT SCHEMAS
# ---------------------------------------------------------------

class ResultCreate(BaseModel):
    """
    Faculty enters a student's marks for one subject.
    internal_marks + external_marks together determine total, grade, GPA.
    """
    student_id: int
    subject_id: int
    exam_type: ExamType
    academic_year: str = Field(..., pattern=r"^\d{4}-\d{2}$")   # "2024-25"
    internal_marks: Optional[float] = Field(None, ge=0)
    external_marks: Optional[float] = Field(None, ge=0)
    remarks: Optional[str] = None

    @field_validator("academic_year")
    @classmethod
    def validate_year(cls, v: str) -> str:
        parts = v.split("-")
        if len(parts) != 2:
            raise ValueError("academic_year must be format YYYY-YY (e.g. 2024-25)")
        return v


class BulkResultEntry(BaseModel):
    """One student's marks inside a bulk entry request."""
    student_id: int
    internal_marks: Optional[float] = Field(None, ge=0)
    external_marks: Optional[float] = Field(None, ge=0)
    remarks: Optional[str] = None


class BulkResultCreate(BaseModel):
    """
    Faculty submits marks for ALL students in a section for one subject.
    Much more efficient than N individual API calls.
    """
    subject_id: int
    exam_type: ExamType
    academic_year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    entries: List[BulkResultEntry] = Field(..., min_length=1)


class ResultUpdate(BaseModel):
    """Partial update — only marks and remarks can be changed before publishing."""
    internal_marks: Optional[float] = Field(None, ge=0)
    external_marks: Optional[float] = Field(None, ge=0)
    remarks: Optional[str] = None


class ResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    subject_id: int
    faculty_id: Optional[int] = None
    exam_type: ExamType
    academic_year: str
    internal_marks: Optional[float] = None
    external_marks: Optional[float] = None
    total_marks: float
    max_marks: int
    percentage: float
    grade: str
    grade_points: float
    is_published: bool
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    subject_code: Optional[str] = None    # resolved in service
    subject_name: Optional[str] = None
    credits: Optional[int] = None


# ---------------------------------------------------------------
# SEMESTER RESULT SCHEMAS
# ---------------------------------------------------------------

class SemesterResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    semester: int
    academic_year: str
    sgpa: float
    cgpa: float
    total_credits: int
    credits_earned: int
    result_status: ResultStatus
    generated_at: Optional[datetime] = None
    subject_results: List[ResultResponse] = []


# ---------------------------------------------------------------
# TRANSCRIPT SCHEMAS
# ---------------------------------------------------------------

class SubjectResultInTranscript(BaseModel):
    """One subject row inside a transcript."""
    subject_code: str
    subject_name: str
    credits: int
    exam_type: str
    total_marks: float
    max_marks: int
    percentage: float
    grade: str
    grade_points: float


class SemesterTranscript(BaseModel):
    """One semester block in the full transcript."""
    semester: int
    academic_year: str
    sgpa: Optional[float] = None
    cgpa: Optional[float] = None
    total_credits: int
    credits_earned: int
    result_status: Optional[str] = None
    subjects: List[SubjectResultInTranscript]


class TranscriptResponse(BaseModel):
    """Full academic transcript for one student — all semesters."""
    student_id: int
    roll_number: str
    full_name: str
    department: str
    current_cgpa: Optional[float] = None
    semesters: List[SemesterTranscript]


# ---------------------------------------------------------------
# ANALYTICS SCHEMAS
# ---------------------------------------------------------------

class SubjectAnalytics(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: str
    exam_type: str
    total_entries: int
    average_percentage: float
    highest_marks: float
    lowest_marks: float
    pass_count: int
    fail_count: int
    pass_percentage: float
    grade_distribution: dict


class GradeScaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    min_percentage: float
    max_percentage: float
    grade: str
    grade_points: float
    description: Optional[str] = None
    is_pass: bool
