# =============================================================
# schemas/test.py — Assessment Request/Response Contracts
# =============================================================
# TWO VERSIONS OF QUESTION SCHEMA (THE MOST IMPORTANT DESIGN):
#
#   QuestionForStudent → during attempt (NO correct_option)
#   QuestionWithAnswer → in results (WITH correct_option + student's choice)
#
# This is "schema-as-access-control":
#   If QuestionForStudent is returned during the exam,
#   the student literally cannot see correct_option because
#   it's not in the schema. Pydantic strips it during serialization.
#   No matter what the ORM object contains, the schema controls output.
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List
from datetime import datetime

from backend.models.enums import CorrectOption


# ---------------------------------------------------------------
# QUESTION SCHEMAS — Two versions for different contexts
# ---------------------------------------------------------------

class QuestionCreate(BaseModel):
    """Faculty sends this when adding questions to a test."""
    question_text: str = Field(..., min_length=5)
    option_a: str = Field(..., min_length=1, max_length=500)
    option_b: str = Field(..., min_length=1, max_length=500)
    option_c: str = Field(..., min_length=1, max_length=500)
    option_d: str = Field(..., min_length=1, max_length=500)
    correct_option: CorrectOption
    marks: int = Field(default=1, ge=1, le=10)
    order_number: int = Field(default=1, ge=1)

    @field_validator("correct_option", mode="before")
    @classmethod
    def normalize_correct_option(cls, v: object) -> object:
        """Accept uppercase 'A'-'D' from frontend; normalise to lowercase for DB."""
        if isinstance(v, str):
            return v.lower()
        return v


class QuestionForStudent(BaseModel):
    """
    Returned DURING an active test attempt.
    correct_option is INTENTIONALLY ABSENT.
    Student sees the question + 4 options, nothing more.
    """
    model_config = ConfigDict(from_attributes=True)
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    marks: int
    order_number: int


class QuestionWithAnswer(BaseModel):
    """
    Returned AFTER submission in the result response.
    Now correct_option is shown, along with student's choice and grading.
    """
    model_config = ConfigDict(from_attributes=True)
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    marks: int
    correct_option: CorrectOption       # NOW revealed
    selected_option: Optional[CorrectOption] = None  # What student chose
    is_correct: Optional[bool] = None
    marks_awarded: Optional[int] = None


# ---------------------------------------------------------------
# TEST CREATE / RESPONSE SCHEMAS
# ---------------------------------------------------------------

class TestCreate(BaseModel):
    section_id: int
    subject: str = Field(..., min_length=2, max_length=100)
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    duration_minutes: int = Field(..., ge=5, le=300)
    start_time: datetime
    end_time: datetime

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v, info):
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time.")
        return v

    @field_validator("subject")
    @classmethod
    def normalize_subject(cls, v: str) -> str:
        return v.strip().title()


class TestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    faculty_id: int
    section_id: int
    subject: str
    title: str
    description: Optional[str] = None
    total_marks: Optional[int] = None
    duration_minutes: int
    start_time: datetime
    end_time: datetime
    is_published: bool
    is_active: bool
    question_count: int = 0     # computed in route
    created_at: Optional[datetime] = None


class TestUpdate(BaseModel):
    """Partial update for a DRAFT test — all fields optional."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, min_length=2, max_length=100)
    duration_minutes: Optional[int] = Field(None, ge=5, le=300)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @model_validator(mode="after")
    def end_after_start(self) -> "TestUpdate":
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self

    @field_validator("subject", mode="before")
    @classmethod
    def normalize_subject(cls, v: object) -> object:
        if v and isinstance(v, str):
            return v.strip().title()
        return v


class BulkQuestionsRequest(BaseModel):
    """Faculty sends a list of questions to add to a test."""
    questions: List[QuestionCreate] = Field(..., min_length=1)


# ---------------------------------------------------------------
# ATTEMPT SCHEMAS
# ---------------------------------------------------------------

class AnswerSubmission(BaseModel):
    """One student answer for one question."""
    question_id: int
    selected_option: Optional[CorrectOption] = None  # None = skipped

    @field_validator("selected_option", mode="before")
    @classmethod
    def normalize_selected_option(cls, v: object) -> object:
        """Accept uppercase 'A'-'D' from frontend; normalise to lowercase for DB."""
        if v is not None and isinstance(v, str):
            return v.lower()
        return v


class TestSubmissionRequest(BaseModel):
    """Student's final submission payload."""
    answers: List[AnswerSubmission]


class ActiveAttemptResponse(BaseModel):
    """
    Returned when student starts a test.
    Contains questions WITHOUT correct_option.
    Also contains timing info so frontend can show countdown.
    """
    model_config = ConfigDict(from_attributes=True)
    attempt_id: int
    test_id: int
    title: str
    duration_minutes: int
    started_at: datetime
    end_time: datetime          # Frontend uses this for hard deadline
    questions: List[QuestionForStudent]


# ---------------------------------------------------------------
# RESULT SCHEMAS
# ---------------------------------------------------------------

class TestResultResponse(BaseModel):
    """Full result after submission — with correct answers revealed."""
    attempt_id: int
    test_id: int
    title: str
    subject: str
    total_marks: int
    score: int
    percentage: float
    is_pass: bool               # True if percentage >= 40%
    submitted_at: Optional[datetime]
    answered_questions: List[QuestionWithAnswer]


class StudentResultSummary(BaseModel):
    """Compact result item for lists (my-results endpoint)."""
    model_config = ConfigDict(from_attributes=True)
    attempt_id: int
    test_id: int
    title: str
    subject: str
    total_marks: int
    score: Optional[int]
    percentage: Optional[float]
    is_submitted: bool
    submitted_at: Optional[datetime]


# ---------------------------------------------------------------
# ANALYTICS SCHEMAS
# ---------------------------------------------------------------

class FacultyQuestionResponse(BaseModel):
    """Question WITH correct_option — returned only to the owning faculty."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: CorrectOption
    marks: int
    order_number: int


class AllResultsItem(BaseModel):
    """One row in the all-results list for a test — faculty/admin view."""
    attempt_id: int
    student_id: int
    roll_number: str
    full_name: Optional[str] = None
    score: Optional[int] = None
    total_marks: int
    percentage: Optional[float] = None
    is_submitted: bool
    submitted_at: Optional[datetime] = None


class QuestionAccuracy(BaseModel):
    question_id: int
    question_text: str
    total_answers: int
    correct_answers: int
    accuracy_percentage: float


class TestAnalytics(BaseModel):
    test_id: int
    title: str
    subject: str
    total_marks: int
    total_attempts: int
    submitted_count: int
    average_score: float
    average_percentage: float
    highest_score: int
    lowest_score: int
    pass_count: int
    fail_count: int
    topper_roll_number: Optional[str] = None
    topper_score: Optional[int] = None
    question_accuracy: List[QuestionAccuracy]
