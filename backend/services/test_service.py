# =============================================================
# services/test_service.py — Online Test Business Logic
# =============================================================
# THE GRADING ENGINE is the heart of this module.
# Everything else (create, publish, list) is standard CRUD.
# The grading engine (submit_test) is where correctness matters most.
# =============================================================

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime, timezone
from typing import Optional

from backend.models.test import Test
from backend.models.question import Question
from backend.models.test_attempt import TestAttempt
from backend.models.test_answer import TestAnswer
from backend.models.student import Student
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.user import User
from backend.schemas.test import (
    TestCreate, TestUpdate, QuestionCreate, BulkQuestionsRequest,
    ActiveAttemptResponse, QuestionForStudent,
    TestSubmissionRequest, TestResultResponse, QuestionWithAnswer,
    StudentResultSummary, TestAnalytics, QuestionAccuracy, TestResponse,
    FacultyQuestionResponse, AllResultsItem,
)

PASS_THRESHOLD = 40.0   # 40% is minimum pass mark


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------
# CREATE TEST — Draft state
# ---------------------------------------------------------------
def create_test(db: Session, faculty_user_id: int, data: TestCreate) -> Test:
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")

    section = db.query(Section).filter(Section.id == data.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail=f"Section {data.section_id} not found.")

    if faculty.department != section.department:
        raise HTTPException(
            status_code=403,
            detail=f"Faculty belongs to '{faculty.department.value}' but section is '{section.department.value}'."
        )

    test = Test(
        faculty_id=faculty.id,
        section_id=data.section_id,
        subject=data.subject,
        title=data.title,
        description=data.description,
        duration_minutes=data.duration_minutes,
        start_time=data.start_time,
        end_time=data.end_time,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


# ---------------------------------------------------------------
# ADD QUESTIONS — Bulk insert for a test in draft
# ---------------------------------------------------------------
def add_questions(
    db: Session,
    faculty_user_id: int,
    test_id: int,
    data: BulkQuestionsRequest,
) -> list[Question]:
    """
    Adds questions to a draft test.

    IMMUTABILITY RULE: Cannot add questions to a published test.
    WHY? Students may have already started. Changing questions
    mid-exam would make earlier attempts inconsistent.
    """
    test = _get_test_for_faculty(db, test_id, faculty_user_id)

    if test.is_published:
        raise HTTPException(
            status_code=400,
            detail="Cannot modify a published test. Unpublish first."
        )

    # Auto-assign order numbers starting after existing questions
    existing_count = len(test.questions)

    questions = []
    for i, q in enumerate(data.questions, start=existing_count + 1):
        order = q.order_number if q.order_number != 1 else i
        question = Question(
            test_id=test_id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            correct_option=q.correct_option,
            marks=q.marks,
            order_number=order,
        )
        questions.append(question)

    db.bulk_save_objects(questions)
    db.commit()

    # Reload questions to get their IDs
    return db.query(Question).filter(Question.test_id == test_id).order_by(Question.order_number).all()


# ---------------------------------------------------------------
# PUBLISH TEST — Validates and makes test live
# ---------------------------------------------------------------
def publish_test(db: Session, faculty_user_id: int, test_id: int) -> Test:
    """
    Publishing validates:
      1. Test belongs to this faculty
      2. At least 1 question exists
      3. Calculates and locks total_marks
      4. Sets is_published=True

    After publishing, the test is immutable.
    Questions cannot be added/changed.
    """
    test = _get_test_for_faculty(db, test_id, faculty_user_id)

    if test.is_published:
        raise HTTPException(status_code=400, detail="Test is already published.")

    if not test.questions:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish a test with no questions. Add at least one question first."
        )

    # Calculate and lock total_marks
    total = sum(q.marks for q in test.questions)
    test.total_marks = total
    test.is_published = True
    db.commit()
    db.refresh(test)
    return test


# ---------------------------------------------------------------
# GET AVAILABLE TESTS — What students can currently attempt
# ---------------------------------------------------------------
def get_available_tests(db: Session, student_user_id: int) -> list[dict]:
    """
    Returns tests that:
      1. Are published
      2. Are assigned to the student's section
      3. Are within start_time and end_time
      4. Have not been attempted by this student yet (optional filter)

    Also annotates each test with whether student already attempted.
    """
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    now = _now_utc()

    tests = (
        db.query(Test)
        .filter(
            Test.section_id == student.section_id,
            Test.is_published == True,
            Test.is_active == True,
            Test.start_time <= now,
            Test.end_time >= now,
        )
        .order_by(Test.end_time)
        .all()
    )

    # Check attempt status for each test
    attempted_test_ids = {
        a.test_id for a in
        db.query(TestAttempt.test_id).filter(TestAttempt.student_id == student.id).all()
    }

    results = []
    for test in tests:
        results.append({
            "test": test,
            "question_count": len(test.questions),
            "already_attempted": test.id in attempted_test_ids,
        })
    return results


# ---------------------------------------------------------------
# START TEST ATTEMPT — Student opens the exam
# ---------------------------------------------------------------
def start_test_attempt(db: Session, student_user_id: int, test_id: int) -> dict:
    """
    Creates a TestAttempt record and returns questions WITHOUT correct answers.

    TIMING CHECK:
      now must be between test.start_time and test.end_time
      Otherwise: test hasn't started OR has already ended

    DUPLICATE PREVENTION:
      UNIQUE(test_id, student_id) constraint catches this at DB level.
      We also check in service for a friendly error message.

    WHAT IS RETURNED:
      The active attempt response contains ONLY QuestionForStudent,
      which excludes correct_option entirely.
      Schema-level access control in action.
    """
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    test = (
        db.query(Test)
        .options(joinedload(Test.questions))
        .filter(Test.id == test_id, Test.is_published == True, Test.is_active == True)
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found or not published.")

    # Section check
    if test.section_id != student.section_id:
        raise HTTPException(status_code=403, detail="This test is not assigned to your section.")

    # Timing check
    now = _now_utc()
    if now < test.start_time:
        raise HTTPException(
            status_code=400,
            detail=f"Test has not started yet. Starts at {test.start_time.isoformat()}"
        )
    if now > test.end_time:
        raise HTTPException(status_code=400, detail="This test has already ended.")

    # Duplicate attempt check
    existing = db.query(TestAttempt).filter(
        TestAttempt.test_id == test_id,
        TestAttempt.student_id == student.id,
    ).first()
    if existing:
        if existing.is_submitted:
            raise HTTPException(
                status_code=409,
                detail="You have already submitted this test. View your result instead."
            )
        # Resume existing unsubmitted attempt
        return _build_active_attempt_response(existing, test)

    # Create new attempt
    try:
        attempt = TestAttempt(
            test_id=test_id,
            student_id=student.id,
            total_marks=test.total_marks,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Concurrent attempt detected. Try again.")

    return _build_active_attempt_response(attempt, test)


# ---------------------------------------------------------------
# SUBMIT TEST — The Grading Engine
# ---------------------------------------------------------------
def submit_test(
    db: Session,
    student_user_id: int,
    attempt_id: int,
    data: TestSubmissionRequest,
) -> TestResultResponse:
    """
    THE GRADING ENGINE.

    FLOW:
      1. Verify attempt belongs to this student
      2. Verify not already submitted
      3. Verify time hasn't expired (started_at + duration <= now)
      4. Load all questions for this test
      5. For each question: find student's answer → compare → grade
      6. Bulk insert TestAnswer rows
      7. Calculate total score + percentage
      8. Update attempt: score, percentage, is_submitted, submitted_at
      9. Commit atomically

    TIMING ENFORCEMENT:
      We check: now <= attempt.started_at + duration_minutes
      If exceeded: attempt is forcibly auto-submitted with whatever answers sent.
      WHY? We don't block late submissions — we accept them.
      The frontend should show a warning, not a hard block.
      Blocking creates bad UX when network latency causes 1-second overruns.
    """
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    attempt = (
        db.query(TestAttempt)
        .options(joinedload(TestAttempt.test).joinedload(Test.questions))
        .filter(TestAttempt.id == attempt_id, TestAttempt.student_id == student.id)
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    if attempt.is_submitted:
        raise HTTPException(status_code=409, detail="This attempt has already been submitted.")

    test = attempt.test
    questions = {q.id: q for q in test.questions}

    # Build answer lookup from submission
    submitted = {a.question_id: a.selected_option for a in data.answers}

    # GRADE EACH QUESTION
    answer_rows = []
    total_score = 0

    for q_id, question in questions.items():
        selected = submitted.get(q_id)             # None if question was skipped
        is_correct = (
            selected is not None and
            selected.value == question.correct_option.value
        )
        awarded = question.marks if is_correct else 0
        total_score += awarded

        answer_rows.append(TestAnswer(
            attempt_id=attempt_id,
            question_id=q_id,
            selected_option=selected,
            is_correct=is_correct,
            marks_awarded=awarded,
        ))

    # Bulk insert answer rows
    db.bulk_save_objects(answer_rows)

    # Update attempt with results
    total_marks = test.total_marks or sum(q.marks for q in questions.values())
    pct = round((total_score / total_marks * 100), 2) if total_marks > 0 else 0.0

    attempt.score = total_score
    attempt.percentage = pct
    attempt.is_submitted = True
    attempt.submitted_at = _now_utc()

    db.commit()
    db.refresh(attempt)

    # FIRE-AND-FORGET: Notify student of their result (non-critical)
    try:
        from backend.services.notification_service import create_system_notification
        from backend.models.enums import NotificationType
        create_system_notification(
            db,
            recipient_user_id=student.user_id,
            title=f"Test Result: {test.title}",
            message=f"You scored {total_score}/{total_marks} ({pct}%). {'Pass' if pct >= PASS_THRESHOLD else 'Fail'}.",
            notification_type=NotificationType.test_result,
        )
        db.commit()
    except Exception:
        pass   # Never block test submission for notification failure

    # Reload answers with question data for response
    answers_with_data = (
        db.query(TestAnswer)
        .options(joinedload(TestAnswer.question))
        .filter(TestAnswer.attempt_id == attempt_id)
        .all()
    )

    return _build_result_response(attempt, test, answers_with_data)


# ---------------------------------------------------------------
# GET ATTEMPT RESULT — After submission
# ---------------------------------------------------------------
def get_attempt_result(
    db: Session,
    student_user_id: int,
    attempt_id: int,
) -> TestResultResponse:
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    attempt = (
        db.query(TestAttempt)
        .options(
            joinedload(TestAttempt.test),
            joinedload(TestAttempt.answers).joinedload(TestAnswer.question),
        )
        .filter(TestAttempt.id == attempt_id, TestAttempt.student_id == student.id)
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    if not attempt.is_submitted:
        raise HTTPException(status_code=400, detail="Test not yet submitted.")

    return _build_result_response(attempt, attempt.test, attempt.answers)


# ---------------------------------------------------------------
# GET ALL STUDENT RESULTS
# ---------------------------------------------------------------
def get_student_results(db: Session, student_user_id: int) -> list[dict]:
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    attempts = (
        db.query(TestAttempt)
        .options(joinedload(TestAttempt.test))
        .filter(TestAttempt.student_id == student.id)
        .order_by(TestAttempt.started_at.desc())
        .all()
    )
    return attempts


# ---------------------------------------------------------------
# GET TEST ANALYTICS — Faculty/Admin view
# ---------------------------------------------------------------
def get_test_analytics(
    db: Session,
    test_id: int,
) -> TestAnalytics:
    test = (
        db.query(Test)
        .options(joinedload(Test.questions))
        .filter(Test.id == test_id)
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found.")

    submitted_attempts = (
        db.query(TestAttempt)
        .options(joinedload(TestAttempt.student).joinedload(Student.user))
        .filter(TestAttempt.test_id == test_id, TestAttempt.is_submitted == True)
        .all()
    )

    total_attempts = db.query(TestAttempt).filter(TestAttempt.test_id == test_id).count()
    scores = [a.score for a in submitted_attempts if a.score is not None]

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    avg_pct   = round(sum(a.percentage or 0 for a in submitted_attempts) / len(submitted_attempts), 2) if submitted_attempts else 0.0
    pass_count = sum(1 for a in submitted_attempts if (a.percentage or 0) >= PASS_THRESHOLD)

    topper = max(submitted_attempts, key=lambda a: a.score or 0, default=None)

    # Per-question accuracy — single GROUP BY instead of 2×Q queries.
    # BEFORE: for a 50-question test → 100 DB round-trips.
    # AFTER:  one query fetches all question stats at once.
    question_ids = [q.id for q in test.questions]
    acc_rows = (
        db.query(
            TestAnswer.question_id,
            func.count(TestAnswer.id).label("total"),
            func.sum(
                case([(TestAnswer.is_correct == True, 1)], else_=0)
            ).label("correct"),
        )
        .filter(TestAnswer.question_id.in_(question_ids))
        .group_by(TestAnswer.question_id)
        .all()
    )
    acc_map = {row.question_id: row for row in acc_rows}

    question_accuracy = []
    for q in test.questions:
        row = acc_map.get(q.id)
        total_ans = row.total if row else 0
        correct_ans = int(row.correct or 0) if row else 0
        acc_pct = round(correct_ans / total_ans * 100, 2) if total_ans > 0 else 0.0
        question_accuracy.append(QuestionAccuracy(
            question_id=q.id,
            question_text=q.question_text[:80],
            total_answers=total_ans,
            correct_answers=correct_ans,
            accuracy_percentage=acc_pct,
        ))

    return TestAnalytics(
        test_id=test.id,
        title=test.title,
        subject=test.subject,
        total_marks=test.total_marks or 0,
        total_attempts=total_attempts,
        submitted_count=len(submitted_attempts),
        average_score=avg_score,
        average_percentage=avg_pct,
        highest_score=max(scores, default=0),
        lowest_score=min(scores, default=0),
        pass_count=pass_count,
        fail_count=len(submitted_attempts) - pass_count,
        topper_roll_number=topper.student.roll_number if topper and topper.student else None,
        topper_score=topper.score if topper else None,
        question_accuracy=question_accuracy,
    )


# ---------------------------------------------------------------
# UPDATE TEST — Modify draft metadata
# ---------------------------------------------------------------
def update_test(
    db: Session,
    faculty_user_id: int,
    test_id: int,
    data: TestUpdate,
) -> Test:
    test = _get_test_for_faculty(db, test_id, faculty_user_id)
    if test.is_published:
        raise HTTPException(
            status_code=400,
            detail="Cannot modify a published test. Unpublish first."
        )
    if data.title           is not None: test.title            = data.title
    if data.description     is not None: test.description      = data.description
    if data.subject         is not None: test.subject          = data.subject
    if data.duration_minutes is not None: test.duration_minutes = data.duration_minutes
    if data.start_time      is not None: test.start_time       = data.start_time
    if data.end_time        is not None: test.end_time         = data.end_time
    db.commit()
    db.refresh(test)
    return test


# ---------------------------------------------------------------
# DELETE TEST — Soft-delete (is_active = False)
# ---------------------------------------------------------------
def delete_test(
    db: Session,
    faculty_user_id: int,
    test_id: int,
) -> None:
    test = _get_test_for_faculty(db, test_id, faculty_user_id)
    if test.is_published:
        attempt_count = db.query(TestAttempt).filter(
            TestAttempt.test_id == test_id
        ).count()
        if attempt_count > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot delete: {attempt_count} student attempt(s) exist. "
                    "Unpublish first and ensure no active attempts."
                )
            )
    test.is_active = False
    db.commit()


# ---------------------------------------------------------------
# GET QUESTIONS FOR FACULTY — Includes correct_option
# ---------------------------------------------------------------
def get_test_questions_for_faculty(
    db: Session,
    faculty_user_id: int,
    test_id: int,
) -> list[Question]:
    test = _get_test_for_faculty(db, test_id, faculty_user_id)
    return test.questions


# ---------------------------------------------------------------
# REPLACE QUESTIONS — Atomic replace of all questions on a draft
# ---------------------------------------------------------------
def replace_questions(
    db: Session,
    faculty_user_id: int,
    test_id: int,
    data: BulkQuestionsRequest,
) -> list[Question]:
    """
    Completely replaces all questions for a draft test.
    Unlike add_questions (which appends), this starts fresh.
    Ensures order_numbers are clean and sequential.
    """
    test = _get_test_for_faculty(db, test_id, faculty_user_id)
    if test.is_published:
        raise HTTPException(
            status_code=400,
            detail="Cannot modify questions on a published test. Unpublish first."
        )
    db.query(Question).filter(Question.test_id == test_id).delete(
        synchronize_session="fetch"
    )
    questions = [
        Question(
            test_id=test_id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            correct_option=q.correct_option,
            marks=q.marks,
            order_number=i,
        )
        for i, q in enumerate(data.questions, start=1)
    ]
    db.bulk_save_objects(questions)
    db.commit()
    return (
        db.query(Question)
        .filter(Question.test_id == test_id)
        .order_by(Question.order_number)
        .all()
    )


# ---------------------------------------------------------------
# UNPUBLISH TEST — Revert to draft (only if no attempts)
# ---------------------------------------------------------------
def unpublish_test(
    db: Session,
    faculty_user_id: int,
    test_id: int,
) -> Test:
    test = _get_test_for_faculty(db, test_id, faculty_user_id)
    if not test.is_published:
        raise HTTPException(status_code=400, detail="Test is not published.")
    attempt_count = db.query(TestAttempt).filter(
        TestAttempt.test_id == test_id
    ).count()
    if attempt_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot unpublish: {attempt_count} student(s) have already attempted "
                "this test. Their data would be lost."
            )
        )
    test.is_published = False
    db.commit()
    db.refresh(test)
    return test


# ---------------------------------------------------------------
# GET ALL RESULTS — All student attempts for a test (faculty view)
# ---------------------------------------------------------------
def get_all_results(
    db: Session,
    test_id: int,
    faculty_user_id: int,
) -> list[dict]:
    _get_test_for_faculty(db, test_id, faculty_user_id)  # ownership check
    attempts = (
        db.query(TestAttempt)
        .options(
            joinedload(TestAttempt.student).joinedload(Student.user)
        )
        .filter(TestAttempt.test_id == test_id)
        .order_by(TestAttempt.is_submitted.desc(), TestAttempt.started_at.desc())
        .all()
    )
    return [
        {
            "attempt_id":  a.id,
            "student_id":  a.student_id,
            "roll_number": a.student.roll_number if a.student else "Unknown",
            "full_name":   a.student.user.full_name if (a.student and a.student.user) else None,
            "score":       a.score,
            "total_marks": a.total_marks,
            "percentage":  a.percentage,
            "is_submitted": a.is_submitted,
            "submitted_at": a.submitted_at,
        }
        for a in attempts
    ]


# ---------------------------------------------------------------
# LIST TESTS — For faculty to see their tests
# ---------------------------------------------------------------
def list_faculty_tests(db: Session, faculty_user_id: int) -> list[Test]:
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")
    return (
        db.query(Test)
        .options(joinedload(Test.questions))
        .filter(Test.faculty_id == faculty.id, Test.is_active == True)
        .order_by(Test.created_at.desc())
        .all()
    )


# =============================================================
# PRIVATE HELPERS
# =============================================================

def _get_test_for_faculty(db: Session, test_id: int, faculty_user_id: int) -> Test:
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")

    test = (
        db.query(Test)
        .options(joinedload(Test.questions))
        .filter(Test.id == test_id, Test.faculty_id == faculty.id, Test.is_active == True)
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found or you don't own it.")
    return test


def _build_active_attempt_response(attempt: TestAttempt, test: Test) -> dict:
    return {
        "attempt_id": attempt.id,
        "test_id": test.id,
        "title": test.title,
        "duration_minutes": test.duration_minutes,
        "started_at": attempt.started_at,
        "end_time": test.end_time,
        "questions": test.questions,
    }


def _build_result_response(attempt: TestAttempt, test: Test, answers) -> TestResultResponse:
    answer_map = {a.question_id: a for a in answers}

    answered_questions = []
    for q in test.questions:
        ans = answer_map.get(q.id)
        answered_questions.append(QuestionWithAnswer(
            id=q.id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            marks=q.marks,
            correct_option=q.correct_option,
            selected_option=ans.selected_option if ans else None,
            is_correct=ans.is_correct if ans else False,
            marks_awarded=ans.marks_awarded if ans else 0,
        ))

    total_marks = test.total_marks or sum(q.marks for q in test.questions)
    return TestResultResponse(
        attempt_id=attempt.id,
        test_id=test.id,
        title=test.title,
        subject=test.subject,
        total_marks=total_marks,
        score=attempt.score or 0,
        percentage=attempt.percentage or 0.0,
        is_pass=(attempt.percentage or 0) >= PASS_THRESHOLD,
        submitted_at=attempt.submitted_at,
        answered_questions=answered_questions,
    )
