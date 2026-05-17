# =============================================================
# routes/result.py — Academic Result API Endpoints
# =============================================================
# ROUTE MAP:
#   POST   /results/subjects/                          [admin]         create subject
#   GET    /results/subjects/                          [all]           list subjects
#   GET    /results/grade-scale                        [all]           view grade scale
#   POST   /results/enter                              [admin/faculty] enter single result
#   POST   /results/bulk-enter                         [admin/faculty] bulk enter for section
#   PATCH  /results/{id}                               [admin/faculty] update before publish
#   POST   /results/publish                            [admin/faculty] publish results
#   POST   /results/generate-semester                  [admin]         compute SGPA/CGPA
#   GET    /results/transcript/me                      [student]       own transcript
#   GET    /results/transcript/{student_id}            [admin/faculty] any transcript
#   GET    /results/me                                 [student]       own results
#   GET    /results/analytics/subject/{id}             [admin/faculty] subject analytics
# =============================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.database.connection import get_db
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.models.user import User, UserRole
from backend.models.enums import Department, ExamType
from backend.schemas.result import (
    SubjectCreate, SubjectResponse,
    ResultCreate, BulkResultCreate, ResultUpdate, ResultResponse,
    SemesterResultResponse, TranscriptResponse,
    SubjectAnalytics, GradeScaleResponse,
)
from backend.services.result_service import (
    create_subject, list_subjects,
    enter_result, bulk_enter_results, update_result,
    publish_results, generate_semester_result,
    get_student_transcript, get_student_results,
    get_subject_analytics, get_grade_scale,
)

router = APIRouter(prefix="/results", tags=["Results & Academic Performance"])


# ---------------------------------------------------------------
# HELPER — enforce admin or faculty
# ---------------------------------------------------------------
def _require_admin_or_faculty(current_user: User):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty required.")


# ---------------------------------------------------------------
# GET /results/grade-scale — public reference
# MUST be before /{id} patterns
# ---------------------------------------------------------------
@router.get(
    "/grade-scale",
    response_model=List[GradeScaleResponse],
    summary="View the institutional grade scale (all roles)",
)
def view_grade_scale(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_grade_scale(db)


# ---------------------------------------------------------------
# POST /results/subjects/ — Admin creates a subject
# ---------------------------------------------------------------
@router.post(
    "/subjects/",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new subject (Admin only)",
)
def create_subject_route(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return create_subject(db, data)


# ---------------------------------------------------------------
# GET /results/subjects/ — List subjects (filterable)
# ---------------------------------------------------------------
@router.get(
    "/subjects/",
    response_model=List[SubjectResponse],
    summary="List all subjects, optionally filtered by department/semester",
)
def list_subjects_route(
    department: Optional[Department] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=8),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_subjects(db, department, semester)


# ---------------------------------------------------------------
# POST /results/enter — Faculty enters one result
# ---------------------------------------------------------------
@router.post(
    "/enter",
    response_model=ResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enter marks for one student in one subject (Admin or Faculty)",
)
def enter_result_route(
    data: ResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    r = enter_result(db, current_user.id, data)
    return _to_response(r)


# ---------------------------------------------------------------
# POST /results/bulk-enter — Faculty enters whole section at once
# ---------------------------------------------------------------
@router.post(
    "/bulk-enter",
    status_code=status.HTTP_201_CREATED,
    summary="Bulk enter marks for multiple students (Admin or Faculty)",
)
def bulk_enter_route(
    data: BulkResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    return bulk_enter_results(db, current_user.id, data)


# ---------------------------------------------------------------
# POST /results/publish — Publish results (make student-visible)
# ---------------------------------------------------------------
@router.post(
    "/publish",
    summary="Publish all results for a subject/exam/year (Admin or Faculty)",
)
def publish_route(
    subject_id: int = Query(...),
    exam_type: ExamType = Query(...),
    academic_year: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    return publish_results(db, subject_id, exam_type, academic_year)


# ---------------------------------------------------------------
# POST /results/generate-semester — Compute SGPA + CGPA
# ---------------------------------------------------------------
@router.post(
    "/generate-semester",
    summary="Generate semester GPA record for a student (Admin only)",
)
def generate_semester_route(
    student_id: int = Query(...),
    semester: int = Query(..., ge=1, le=8),
    academic_year: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    sr = generate_semester_result(db, student_id, semester, academic_year)
    return {
        "student_id": sr.student_id,
        "semester": sr.semester,
        "academic_year": sr.academic_year,
        "sgpa": sr.sgpa,
        "cgpa": sr.cgpa,
        "total_credits": sr.total_credits,
        "credits_earned": sr.credits_earned,
        "result_status": sr.result_status.value,
    }


# ---------------------------------------------------------------
# GET /results/transcript/me — Student views own transcript
# MUST be before /transcript/{student_id}
# ---------------------------------------------------------------
@router.get(
    "/transcript/me",
    response_model=TranscriptResponse,
    summary="Student views their own full academic transcript",
)
def my_transcript(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.models.student import Student
    from fastapi import HTTPException
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
    return get_student_transcript(db, student.id, current_user.id, current_user.role.value)


# ---------------------------------------------------------------
# GET /results/transcript/{student_id} — Admin/Faculty views any
# ---------------------------------------------------------------
@router.get(
    "/transcript/{student_id}",
    response_model=TranscriptResponse,
    summary="View any student's transcript (Admin or Faculty)",
)
def student_transcript(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    return get_student_transcript(db, student_id, current_user.id, current_user.role.value)


# ---------------------------------------------------------------
# GET /results/me — Student views own published results
# ---------------------------------------------------------------
@router.get(
    "/me",
    summary="Student views their own published results",
)
def my_results(
    academic_year: Optional[str] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=8),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Student role required.")
    results = get_student_results(db, current_user.id, academic_year, semester)
    return [_to_response(r) for r in results]


# ---------------------------------------------------------------
# PATCH /results/{result_id} — Update marks before publishing
# ---------------------------------------------------------------
@router.patch(
    "/{result_id}",
    response_model=ResultResponse,
    summary="Update a result before it is published (Admin or Faculty)",
)
def update_result_route(
    result_id: int,
    data: ResultUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    r = update_result(db, result_id, current_user.id, data)
    return _to_response(r)


# ---------------------------------------------------------------
# GET /results/analytics/subject/{subject_id} — Subject analytics
# ---------------------------------------------------------------
@router.get(
    "/analytics/subject/{subject_id}",
    response_model=SubjectAnalytics,
    summary="Get subject performance analytics (Admin or Faculty)",
)
def subject_analytics_route(
    subject_id: int,
    exam_type: ExamType = Query(...),
    academic_year: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    return get_subject_analytics(db, subject_id, exam_type, academic_year)


# ---------------------------------------------------------------
# GET /results/admin/student/{id} — All results (incl. unpublished)
# ---------------------------------------------------------------
@router.get(
    "/admin/student/{student_id}",
    summary="Get ALL results for a student including unpublished (Admin or Faculty)",
)
def admin_get_student_results(
    student_id: int,
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.models.result import Result
    from sqlalchemy.orm import joinedload
    _require_admin_or_faculty(current_user)
    q = (
        db.query(Result)
        .options(joinedload(Result.subject))
        .filter(Result.student_id == student_id)
    )
    if academic_year:
        q = q.filter(Result.academic_year == academic_year)
    results = q.order_by(Result.academic_year, Result.subject_id).all()
    return [_to_response(r) for r in results]


# ---------------------------------------------------------------
# DELETE /results/{result_id} — Delete UNPUBLISHED result (Admin)
# ---------------------------------------------------------------
@router.delete(
    "/{result_id}",
    summary="Delete an unpublished result (Admin only)",
)
def delete_result_route(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from backend.models.result import Result
    from fastapi import HTTPException
    r = db.query(Result).filter(Result.id == result_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Result not found.")
    if r.is_published:
        raise HTTPException(status_code=400, detail="Cannot delete a published result.")
    db.delete(r)
    db.commit()
    return {"message": f"Result {result_id} deleted.", "result_id": result_id}


# ---------------------------------------------------------------
# INTERNAL — Build ResultResponse with denormalized subject fields
# ---------------------------------------------------------------
def _to_response(r) -> ResultResponse:
    return ResultResponse(
        id=r.id,
        student_id=r.student_id,
        subject_id=r.subject_id,
        faculty_id=r.faculty_id,
        exam_type=r.exam_type,
        academic_year=r.academic_year,
        internal_marks=r.internal_marks,
        external_marks=r.external_marks,
        total_marks=r.total_marks,
        max_marks=r.max_marks,
        percentage=r.percentage,
        grade=r.grade,
        grade_points=r.grade_points,
        is_published=r.is_published,
        remarks=r.remarks,
        created_at=r.created_at,
        subject_code=r.subject.subject_code if r.subject else None,
        subject_name=r.subject.subject_name if r.subject else None,
        credits=r.subject.credits if r.subject else None,
    )
