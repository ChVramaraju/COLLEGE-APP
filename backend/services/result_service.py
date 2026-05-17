# =============================================================
# services/result_service.py — Academic Result Business Logic
# =============================================================
# THE GRADING ENGINE (calculate_grade_and_points) is the most
# important function here. Every result row's grade/grade_points
# flows through it. It must be deterministic and correct.
#
# PERFORMANCE NOTE:
#   Grade calculation uses a hardcoded Python list — O(1) average.
#   No DB lookup needed for each calculation.
#   The GradeScale TABLE is used for display and admin reference only.
# =============================================================

from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import Optional

from backend.models.result import Result
from backend.models.subject import Subject
from backend.models.semester_result import SemesterResult
from backend.models.grade_scale import GradeScale
from backend.models.student import Student
from backend.models.faculty import Faculty
from backend.models.user import User
from backend.models.enums import ExamType, ResultStatus, Department
from backend.schemas.result import (
    SubjectCreate, ResultCreate, BulkResultCreate,
    ResultUpdate, ResultResponse, SemesterResultResponse,
    TranscriptResponse, SemesterTranscript, SubjectResultInTranscript,
    SubjectAnalytics,
)

# =============================================================
# THE GRADING ENGINE — Standard 10-point CBCS scale
# =============================================================
# Sorted highest to lowest so the first match is always correct.
# This is checked sequentially: if pct >= 90, return "O", etc.
# =============================================================
_GRADE_SCALE = [
    (90.0,  "O",   10.0),
    (80.0,  "A+",   9.0),
    (70.0,  "A",    8.0),
    (60.0,  "B+",   7.0),
    (50.0,  "B",    6.0),
    (45.0,  "C",    5.0),
    (40.0,  "P",    4.0),
    ( 0.0,  "F",    0.0),
]

def calculate_grade_and_points(percentage: float) -> tuple[str, float]:
    """
    Pure function — maps percentage to (grade, grade_points).
    Deterministic: same input ALWAYS produces same output.
    No DB access needed.
    """
    for min_pct, grade, points in _GRADE_SCALE:
        if percentage >= min_pct:
            return grade, points
    return "F", 0.0


def _compute_total_and_pct(
    internal: Optional[float],
    external: Optional[float],
    max_internal: int,
    max_external: int,
) -> tuple[float, float, int]:
    """
    Computes (total_marks, percentage, max_marks) from component marks.
    Handles cases where only one component is present.
    """
    total = (internal or 0.0) + (external or 0.0)
    max_marks = max_internal + max_external
    pct = round((total / max_marks) * 100, 2) if max_marks > 0 else 0.0
    return total, pct, max_marks


# ---------------------------------------------------------------
# SUBJECT MANAGEMENT
# ---------------------------------------------------------------

def create_subject(db: Session, data: SubjectCreate) -> Subject:
    existing = db.query(Subject).filter(Subject.subject_code == data.subject_code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Subject code '{data.subject_code}' already exists."
        )
    subject = Subject(**data.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def list_subjects(
    db: Session,
    department: Optional[Department] = None,
    semester: Optional[int] = None,
) -> list[Subject]:
    q = db.query(Subject).filter(Subject.is_active == True)
    if department:
        q = q.filter(Subject.department == department)
    if semester:
        q = q.filter(Subject.semester == semester)
    return q.order_by(Subject.semester, Subject.subject_code).all()


# ---------------------------------------------------------------
# RESULT ENTRY — Single
# ---------------------------------------------------------------
def enter_result(
    db: Session,
    faculty_user_id: int,
    data: ResultCreate,
) -> Result:
    """
    Faculty enters marks for one student in one subject.

    VALIDATION FLOW:
      1. Subject exists and is active
      2. Student exists
      3. Marks don't exceed max allowed marks
      4. Calculate total, percentage, grade, grade_points
      5. INSERT — let DB enforce uniqueness constraint

    UNIQUENESS: If the same result already exists (same student,
    subject, exam_type, academic_year), raise 409 Conflict.
    The faculty must use PATCH to update an existing result.
    """
    subject = db.query(Subject).filter(Subject.id == data.subject_id, Subject.is_active == True).first()
    if not subject:
        raise HTTPException(status_code=404, detail=f"Subject ID {data.subject_id} not found.")

    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student ID {data.student_id} not found.")

    # Bounds check
    if data.internal_marks is not None and data.internal_marks > subject.max_internal:
        raise HTTPException(
            status_code=400,
            detail=f"Internal marks {data.internal_marks} exceed max {subject.max_internal}."
        )
    if data.external_marks is not None and data.external_marks > subject.max_external:
        raise HTTPException(
            status_code=400,
            detail=f"External marks {data.external_marks} exceed max {subject.max_external}."
        )

    total, pct, max_marks = _compute_total_and_pct(
        data.internal_marks, data.external_marks,
        subject.max_internal, subject.max_external,
    )
    grade, gp = calculate_grade_and_points(pct)

    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()

    try:
        result = Result(
            student_id=data.student_id,
            subject_id=data.subject_id,
            faculty_id=faculty.id if faculty else None,
            exam_type=data.exam_type,
            academic_year=data.academic_year,
            internal_marks=data.internal_marks,
            external_marks=data.external_marks,
            total_marks=total,
            max_marks=max_marks,
            percentage=pct,
            grade=grade,
            grade_points=gp,
            remarks=data.remarks,
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Result already exists for student {data.student_id}, "
                f"subject {data.subject_id}, {data.exam_type}, {data.academic_year}. "
                f"Use PATCH to update."
            )
        )


# ---------------------------------------------------------------
# BULK RESULT ENTRY — Entire section at once
# ---------------------------------------------------------------
def bulk_enter_results(
    db: Session,
    faculty_user_id: int,
    data: BulkResultCreate,
) -> dict:
    """
    Enter marks for multiple students in one request.
    Processes each entry independently — one failure does NOT
    block the others. Returns a summary of successes and failures.
    """
    subject = db.query(Subject).filter(Subject.id == data.subject_id, Subject.is_active == True).first()
    if not subject:
        raise HTTPException(status_code=404, detail=f"Subject ID {data.subject_id} not found.")

    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()

    success_count = 0
    skip_count = 0
    errors = []

    for entry in data.entries:
        # Check bounds
        if entry.internal_marks is not None and entry.internal_marks > subject.max_internal:
            errors.append(f"Student {entry.student_id}: internal marks exceed max.")
            skip_count += 1
            continue
        if entry.external_marks is not None and entry.external_marks > subject.max_external:
            errors.append(f"Student {entry.student_id}: external marks exceed max.")
            skip_count += 1
            continue

        total, pct, max_marks = _compute_total_and_pct(
            entry.internal_marks, entry.external_marks,
            subject.max_internal, subject.max_external,
        )
        grade, gp = calculate_grade_and_points(pct)

        result = Result(
            student_id=entry.student_id,
            subject_id=data.subject_id,
            faculty_id=faculty.id if faculty else None,
            exam_type=data.exam_type,
            academic_year=data.academic_year,
            internal_marks=entry.internal_marks,
            external_marks=entry.external_marks,
            total_marks=total,
            max_marks=max_marks,
            percentage=pct,
            grade=grade,
            grade_points=gp,
            remarks=entry.remarks,
        )
        db.add(result)
        # Use a PostgreSQL SAVEPOINT so that a duplicate on entry N
        # only rolls back entry N — not the entire session.
        # Without this, db.rollback() destroys all prior successes
        # and db.commit() ends up saving nothing despite the loop.
        try:
            savepoint = db.begin_nested()
            db.flush()
            success_count += 1
        except IntegrityError:
            savepoint.rollback()
            errors.append(f"Student {entry.student_id}: duplicate result, skipped.")
            skip_count += 1

    db.commit()
    return {
        "message": f"Bulk entry complete: {success_count} saved, {skip_count} skipped.",
        "success": success_count,
        "skipped": skip_count,
        "errors": errors,
    }


# ---------------------------------------------------------------
# UPDATE RESULT — Before publishing
# ---------------------------------------------------------------
def update_result(
    db: Session,
    result_id: int,
    faculty_user_id: int,
    data: ResultUpdate,
) -> Result:
    result = db.query(Result).options(joinedload(Result.subject)).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found.")
    if result.is_published:
        raise HTTPException(status_code=400, detail="Cannot edit a published result.")

    if data.internal_marks is not None:
        result.internal_marks = data.internal_marks
    if data.external_marks is not None:
        result.external_marks = data.external_marks
    if data.remarks is not None:
        result.remarks = data.remarks

    subject = result.subject
    total, pct, _ = _compute_total_and_pct(
        result.internal_marks, result.external_marks,
        subject.max_internal, subject.max_external,
    )
    grade, gp = calculate_grade_and_points(pct)
    result.total_marks  = total
    result.percentage   = pct
    result.grade        = grade
    result.grade_points = gp

    db.commit()
    db.refresh(result)
    return result


# ---------------------------------------------------------------
# PUBLISH RESULTS — Make visible to students
# ---------------------------------------------------------------
def publish_results(
    db: Session,
    subject_id: int,
    exam_type: ExamType,
    academic_year: str,
) -> dict:
    """
    Marks all result rows for a subject/exam/year as published.
    Bulk UPDATE — efficient regardless of student count.
    After this, students can see their grades.
    """
    updated = (
        db.query(Result)
        .filter(
            Result.subject_id == subject_id,
            Result.exam_type == exam_type,
            Result.academic_year == academic_year,
            Result.is_published == False,
        )
        .update({"is_published": True}, synchronize_session=False)
    )
    db.commit()

    # Fire notifications to students
    try:
        from backend.services.notification_service import create_system_notification
        from backend.models.enums import NotificationType
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        results = db.query(Result).options(joinedload(Result.student)).filter(
            Result.subject_id == subject_id,
            Result.exam_type == exam_type,
            Result.academic_year == academic_year,
            Result.is_published == True,
        ).all()
        for r in results:
            if r.student and r.student.user_id:
                create_system_notification(
                    db,
                    recipient_user_id=r.student.user_id,
                    title=f"Result Published: {subject.subject_name if subject else 'Subject'}",
                    message=f"Your {exam_type.value} result: {r.grade} ({r.percentage}%)",
                    notification_type=NotificationType.general,
                )
        db.commit()
    except Exception:
        pass

    return {
        "message": f"Published {updated} results.",
        "published_count": updated,
    }


# ---------------------------------------------------------------
# GENERATE SEMESTER RESULT — SGPA + CGPA calculation
# ---------------------------------------------------------------
def generate_semester_result(
    db: Session,
    student_id: int,
    semester: int,
    academic_year: str,
) -> SemesterResult:
    """
    THE ACADEMIC AGGREGATION ENGINE.

    Calculates SGPA for this semester and CGPA across all semesters.

    WHICH RESULTS ARE INCLUDED?
    Only PUBLISHED results for subjects that belong to the
    requested semester. Unpublished results are excluded.

    SGPA FORMULA:
      SGPA = Σ(credits_i × grade_points_i) / Σ(credits_i)

    CGPA FORMULA (weighted by semester credits):
      CGPA = Σ(semester_credits × SGPA) / Σ(semester_credits)

    Pass/Fail status:
      If ALL subjects pass (grade != F): pass
      If ANY subject fails: fail
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")

    # Get all published results for this student in this academic_year
    # for subjects belonging to the requested semester
    results = (
        db.query(Result)
        .join(Subject, Result.subject_id == Subject.id)
        .filter(
            Result.student_id == student_id,
            Result.academic_year == academic_year,
            Subject.semester == semester,
            Result.is_published == True,
        )
        .all()
    )

    if not results:
        raise HTTPException(
            status_code=400,
            detail=f"No published results found for student {student_id}, "
                   f"semester {semester}, year {academic_year}."
        )

    # Load subjects for credit info
    subject_ids = [r.subject_id for r in results]
    subjects = {s.id: s for s in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()}

    # Calculate SGPA
    total_weighted  = sum(subjects[r.subject_id].credits * r.grade_points for r in results)
    total_credits   = sum(subjects[r.subject_id].credits for r in results)
    credits_earned  = sum(subjects[r.subject_id].credits for r in results if r.grade != "F")
    sgpa = round(total_weighted / total_credits, 2) if total_credits > 0 else 0.0

    # Determine pass/fail status
    has_fail = any(r.grade == "F" for r in results)
    result_status = ResultStatus.fail_status if has_fail else ResultStatus.pass_status

    # Calculate CGPA using all existing semester results + this one
    prior_sem_results = db.query(SemesterResult).filter(
        SemesterResult.student_id == student_id,
        SemesterResult.id.isnot(None),
    ).all()

    # Build weighted CGPA including this new semester
    all_sgpas = [(sr.sgpa, sr.total_credits) for sr in prior_sem_results
                 if not (sr.semester == semester and sr.academic_year == academic_year)]
    all_sgpas.append((sgpa, total_credits))

    total_cgpa_weighted = sum(s * c for s, c in all_sgpas)
    total_cgpa_credits  = sum(c for _, c in all_sgpas)
    cgpa = round(total_cgpa_weighted / total_cgpa_credits, 2) if total_cgpa_credits > 0 else sgpa

    # Upsert semester result
    existing = db.query(SemesterResult).filter(
        SemesterResult.student_id == student_id,
        SemesterResult.semester == semester,
        SemesterResult.academic_year == academic_year,
    ).first()

    if existing:
        existing.sgpa = sgpa
        existing.cgpa = cgpa
        existing.total_credits = total_credits
        existing.credits_earned = credits_earned
        existing.result_status = result_status
        db.commit()
        db.refresh(existing)
        return existing
    else:
        sem_result = SemesterResult(
            student_id=student_id,
            semester=semester,
            academic_year=academic_year,
            sgpa=sgpa,
            cgpa=cgpa,
            total_credits=total_credits,
            credits_earned=credits_earned,
            result_status=result_status,
        )
        db.add(sem_result)
        db.commit()
        db.refresh(sem_result)
        return sem_result


# ---------------------------------------------------------------
# STUDENT TRANSCRIPT — Complete academic record
# ---------------------------------------------------------------
def get_student_transcript(
    db: Session,
    student_id: int,
    requesting_user_id: int,
    requesting_user_role: str,
) -> TranscriptResponse:
    """
    Returns the complete academic transcript for a student.

    PRIVACY:
      Students can only view their OWN transcript.
      Faculty and Admin can view any transcript.
    """
    student = (
        db.query(Student)
        .options(joinedload(Student.user))
        .filter(Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if requesting_user_role == "student":
        req_student = db.query(Student).filter(Student.user_id == requesting_user_id).first()
        if not req_student or req_student.id != student_id:
            raise HTTPException(status_code=403, detail="You can only view your own transcript.")

    # Fetch all published results with subject info
    results = (
        db.query(Result)
        .options(joinedload(Result.subject))
        .filter(Result.student_id == student_id, Result.is_published == True)
        .order_by(Result.academic_year)
        .all()
    )

    # Fetch all semester GPA records
    sem_results = {
        (sr.semester, sr.academic_year): sr
        for sr in db.query(SemesterResult).filter(SemesterResult.student_id == student_id).all()
    }

    # Group results by (semester, academic_year)
    from collections import defaultdict
    grouped: dict = defaultdict(list)
    for r in results:
        key = (r.subject.semester, r.academic_year)
        grouped[key].append(r)

    semesters = []
    for (sem, year), sem_results_list in sorted(grouped.items()):
        sr = sem_results.get((sem, year))
        subjects = [
            SubjectResultInTranscript(
                subject_code=r.subject.subject_code,
                subject_name=r.subject.subject_name,
                credits=r.subject.credits,
                exam_type=r.exam_type.value,
                total_marks=r.total_marks,
                max_marks=r.max_marks,
                percentage=r.percentage,
                grade=r.grade,
                grade_points=r.grade_points,
            )
            for r in sem_results_list
        ]
        semesters.append(SemesterTranscript(
            semester=sem,
            academic_year=year,
            sgpa=sr.sgpa if sr else None,
            cgpa=sr.cgpa if sr else None,
            total_credits=sr.total_credits if sr else sum(r.subject.credits for r in sem_results_list),
            credits_earned=sr.credits_earned if sr else 0,
            result_status=sr.result_status.value if sr else None,
            subjects=subjects,
        ))

    # Current CGPA = latest semester result
    all_sr = sorted(sem_results.values(), key=lambda x: (x.academic_year, x.semester))
    current_cgpa = all_sr[-1].cgpa if all_sr else None

    return TranscriptResponse(
        student_id=student_id,
        roll_number=student.roll_number,
        full_name=student.user.full_name if student.user else "",
        department=student.department.value,
        current_cgpa=current_cgpa,
        semesters=semesters,
    )


# ---------------------------------------------------------------
# STUDENT'S OWN RESULTS — Filtered by semester/year
# ---------------------------------------------------------------
def get_student_results(
    db: Session,
    student_user_id: int,
    academic_year: Optional[str] = None,
    semester: Optional[int] = None,
) -> list[Result]:
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    q = (
        db.query(Result)
        .options(joinedload(Result.subject))
        .filter(Result.student_id == student.id, Result.is_published == True)
    )
    if academic_year:
        q = q.filter(Result.academic_year == academic_year)
    if semester is not None:
        q = q.join(Subject, Result.subject_id == Subject.id).filter(Subject.semester == semester)

    return q.order_by(Result.academic_year, Result.subject_id).all()


# ---------------------------------------------------------------
# SUBJECT ANALYTICS
# ---------------------------------------------------------------
def get_subject_analytics(
    db: Session,
    subject_id: int,
    exam_type: ExamType,
    academic_year: str,
) -> SubjectAnalytics:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    results = db.query(Result).filter(
        Result.subject_id == subject_id,
        Result.exam_type == exam_type,
        Result.academic_year == academic_year,
        Result.is_published == True,
    ).all()

    if not results:
        raise HTTPException(status_code=404, detail="No published results found for this subject/exam.")

    percentages = [r.percentage for r in results]
    pass_count = sum(1 for r in results if r.grade != "F")

    grade_dist: dict = {}
    for r in results:
        grade_dist[r.grade] = grade_dist.get(r.grade, 0) + 1

    return SubjectAnalytics(
        subject_id=subject_id,
        subject_code=subject.subject_code,
        subject_name=subject.subject_name,
        exam_type=exam_type.value,
        total_entries=len(results),
        average_percentage=round(sum(percentages) / len(percentages), 2),
        highest_marks=max(r.total_marks for r in results),
        lowest_marks=min(r.total_marks for r in results),
        pass_count=pass_count,
        fail_count=len(results) - pass_count,
        pass_percentage=round(pass_count / len(results) * 100, 2),
        grade_distribution=grade_dist,
    )


# ---------------------------------------------------------------
# GRADE SCALE — Display
# ---------------------------------------------------------------
def get_grade_scale(db: Session) -> list[GradeScale]:
    return db.query(GradeScale).order_by(GradeScale.min_percentage.desc()).all()


# ---------------------------------------------------------------
# SEED GRADE SCALE — Called on startup
# ---------------------------------------------------------------
def seed_grade_scale(db: Session) -> None:
    """
    Seeds the standard 10-point CBCS grade scale if table is empty.
    Idempotent — safe to call on every startup.
    """
    if db.query(GradeScale).count() > 0:
        return
    scales = [
        GradeScale(min_percentage=90.0, max_percentage=100.0, grade="O",   grade_points=10.0, description="Outstanding", is_pass=True),
        GradeScale(min_percentage=80.0, max_percentage=89.99, grade="A+",  grade_points=9.0,  description="Excellent",   is_pass=True),
        GradeScale(min_percentage=70.0, max_percentage=79.99, grade="A",   grade_points=8.0,  description="Very Good",   is_pass=True),
        GradeScale(min_percentage=60.0, max_percentage=69.99, grade="B+",  grade_points=7.0,  description="Good",        is_pass=True),
        GradeScale(min_percentage=50.0, max_percentage=59.99, grade="B",   grade_points=6.0,  description="Above Avg",   is_pass=True),
        GradeScale(min_percentage=45.0, max_percentage=49.99, grade="C",   grade_points=5.0,  description="Average",     is_pass=True),
        GradeScale(min_percentage=40.0, max_percentage=44.99, grade="P",   grade_points=4.0,  description="Pass",        is_pass=True),
        GradeScale(min_percentage=0.0,  max_percentage=39.99, grade="F",   grade_points=0.0,  description="Fail",        is_pass=False),
    ]
    db.bulk_save_objects(scales)
    db.commit()
