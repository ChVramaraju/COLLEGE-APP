# =============================================================
# routes/test.py — Online Test API Endpoints
# =============================================================
# ROUTE MAP:
#   POST   /tests/                          [faculty]  create test (draft)
#   POST   /tests/{id}/questions            [faculty]  add questions
#   PATCH  /tests/{id}/publish              [faculty]  publish test
#   GET    /tests/my-tests                  [faculty]  own tests list
#   GET    /tests/available                 [student]  tests open right now
#   GET    /tests/{id}                      [all]      test metadata
#   POST   /tests/{id}/attempt              [student]  start / resume attempt
#   POST   /tests/attempts/{id}/submit      [student]  submit answers
#   GET    /tests/attempts/{id}/result      [student]  view result
#   GET    /tests/my-results                [student]  all my results
#   GET    /tests/{id}/analytics            [admin/faculty] analytics
#   GET    /tests/{id}/all-results          [admin/faculty] all student results
# =============================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_faculty,
    get_current_student,
    get_current_user,
)
from backend.models.user import User, UserRole
from backend.schemas.test import (
    TestCreate, TestResponse,
    BulkQuestionsRequest,
    ActiveAttemptResponse, QuestionForStudent,
    TestSubmissionRequest, TestResultResponse,
    StudentResultSummary, TestAnalytics,
)
from backend.services.test_service import (
    create_test,
    add_questions,
    publish_test,
    get_available_tests,
    start_test_attempt,
    submit_test,
    get_attempt_result,
    get_student_results,
    get_test_analytics,
    list_faculty_tests,
)

router = APIRouter(prefix="/tests", tags=["Online Tests"])


# ---------------------------------------------------------------
# POST /tests/ — Faculty creates a test (draft)
# ---------------------------------------------------------------
@router.post(
    "/",
    response_model=TestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new test in draft state (Faculty only)",
)
def create_test_route(
    data: TestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    test = create_test(db, current_user.id, data)
    return TestResponse(
        **{c.name: getattr(test, c.name) for c in test.__table__.columns},
        question_count=len(test.questions),
    )


# ---------------------------------------------------------------
# POST /tests/{id}/questions — Faculty adds MCQs
# ---------------------------------------------------------------
@router.post(
    "/{test_id}/questions",
    status_code=status.HTTP_201_CREATED,
    summary="Add questions to a draft test (Faculty only)",
)
def add_questions_route(
    test_id: int,
    data: BulkQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    questions = add_questions(db, current_user.id, test_id, data)
    return {
        "message": f"{len(questions)} questions in test {test_id}.",
        "question_count": len(questions),
        "test_id": test_id,
    }


# ---------------------------------------------------------------
# PATCH /tests/{id}/publish — Faculty publishes the test
# ---------------------------------------------------------------
@router.patch(
    "/{test_id}/publish",
    response_model=TestResponse,
    summary="Publish a draft test (Faculty only)",
)
def publish_test_route(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    test = publish_test(db, current_user.id, test_id)
    return TestResponse(
        **{c.name: getattr(test, c.name) for c in test.__table__.columns},
        question_count=len(test.questions),
    )


# ---------------------------------------------------------------
# GET /tests/my-tests — Faculty views own tests
# MUST be before /{test_id} to avoid route collision
# ---------------------------------------------------------------
@router.get(
    "/my-tests",
    response_model=List[TestResponse],
    summary="Faculty views their own tests",
)
def my_tests_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    tests = list_faculty_tests(db, current_user.id)
    return [
        TestResponse(
            **{c.name: getattr(t, c.name) for c in t.__table__.columns},
            question_count=len(t.questions),
        )
        for t in tests
    ]


# ---------------------------------------------------------------
# GET /tests/available — Student sees tests open right now
# MUST be before /{test_id}
# ---------------------------------------------------------------
@router.get(
    "/available",
    summary="Student views tests available for their section right now",
)
def get_available_tests_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    items = get_available_tests(db, current_user.id)
    return [
        {
            "id": item["test"].id,
            "title": item["test"].title,
            "subject": item["test"].subject,
            "total_marks": item["test"].total_marks,
            "duration_minutes": item["test"].duration_minutes,
            "start_time": item["test"].start_time,
            "end_time": item["test"].end_time,
            "question_count": item["question_count"],
            "already_attempted": item["already_attempted"],
        }
        for item in items
    ]


# ---------------------------------------------------------------
# GET /tests/my-results — Student views all their results
# MUST be before /{test_id}
# ---------------------------------------------------------------
@router.get(
    "/my-results",
    summary="Student views all their test results",
)
def my_results_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    attempts = get_student_results(db, current_user.id)
    return [
        {
            "attempt_id": a.id,
            "test_id": a.test_id,
            "title": a.test.title if a.test else "",
            "subject": a.test.subject if a.test else "",
            "total_marks": a.total_marks,
            "score": a.score,
            "percentage": a.percentage,
            "is_submitted": a.is_submitted,
            "submitted_at": a.submitted_at,
        }
        for a in attempts
    ]


# ---------------------------------------------------------------
# GET /tests/{id} — Test metadata (all authenticated roles)
# ---------------------------------------------------------------
@router.get(
    "/{test_id}",
    response_model=TestResponse,
    summary="Get test details by ID",
)
def get_test_route(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.models.test import Test
    from fastapi import HTTPException
    from sqlalchemy.orm import joinedload

    test = (
        db.query(Test)
        .options(joinedload(Test.questions))
        .filter(Test.id == test_id, Test.is_active == True)
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found.")

    return TestResponse(
        **{c.name: getattr(test, c.name) for c in test.__table__.columns},
        question_count=len(test.questions),
    )


# ---------------------------------------------------------------
# POST /tests/{id}/attempt — Student starts or resumes attempt
# ---------------------------------------------------------------
@router.post(
    "/{test_id}/attempt",
    status_code=status.HTTP_201_CREATED,
    summary="Start or resume a test attempt (Student only)",
)
def start_attempt_route(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    result = start_test_attempt(db, current_user.id, test_id)
    return {
        "attempt_id": result["attempt_id"],
        "test_id": result["test_id"],
        "title": result["title"],
        "duration_minutes": result["duration_minutes"],
        "started_at": result["started_at"],
        "end_time": result["end_time"],
        "questions": [
            QuestionForStudent.model_validate(q)
            for q in result["questions"]
        ],
    }


# ---------------------------------------------------------------
# POST /tests/attempts/{id}/submit — Student submits answers
# ---------------------------------------------------------------
@router.post(
    "/attempts/{attempt_id}/submit",
    response_model=TestResultResponse,
    summary="Submit test answers and receive graded result (Student only)",
)
def submit_test_route(
    attempt_id: int,
    data: TestSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    return submit_test(db, current_user.id, attempt_id, data)


# ---------------------------------------------------------------
# GET /tests/attempts/{id}/result — Student views result
# ---------------------------------------------------------------
@router.get(
    "/attempts/{attempt_id}/result",
    response_model=TestResultResponse,
    summary="View graded result for a submitted attempt (Student only)",
)
def get_result_route(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    return get_attempt_result(db, current_user.id, attempt_id)


# ---------------------------------------------------------------
# GET /tests/{id}/analytics — Faculty/Admin analytics
# ---------------------------------------------------------------
@router.get(
    "/{test_id}/analytics",
    response_model=TestAnalytics,
    summary="Get full analytics for a test (Admin or Faculty)",
)
def get_analytics_route(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty required.")
    return get_test_analytics(db, test_id)
