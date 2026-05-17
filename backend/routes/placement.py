# =============================================================
# routes/placement.py — Placement Module Endpoints
# =============================================================
# ROUTE MAP:
#   POST   /placement/postings/                  [admin]          create job posting
#   GET    /placement/postings/                  [all]            list job postings
#   GET    /placement/postings/{id}              [all]            single posting detail
#   PATCH  /placement/postings/{id}              [admin]          update posting
#   DELETE /placement/postings/{id}              [admin]          soft delete
#   POST   /placement/apply                      [student]        apply to a job
#   DELETE /placement/applications/{id}/withdraw [student]        withdraw
#   GET    /placement/applications/me            [student]        my applications
#   GET    /placement/postings/{id}/applications [admin/faculty]  all apps for a posting
#   PATCH  /placement/applications/{id}/status   [admin]          update app status
#   GET    /placement/analytics                  [admin/faculty]  placement analytics
# =============================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List

from backend.database.connection import get_db
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.models.user import User, UserRole
from backend.models.student import Student
from backend.models.enums import ApplicationStatus
from backend.schemas.placement import (
    JobPostingCreate, JobPostingUpdate, JobPostingResponse,
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
    PlacementAnalyticsResponse,
)
from backend.services.placement_service import (
    create_job_posting, list_job_postings, get_job_posting,
    update_job_posting, delete_job_posting,
    apply_to_job, withdraw_application, get_my_applications,
    update_application_status, list_applications_for_posting,
    get_placement_analytics,
    build_application_response, build_posting_response,
)

router = APIRouter(prefix="/placement", tags=["Placement"])


def _require_admin_or_faculty(user: User):
    from fastapi import HTTPException
    if user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty required.")


def _get_student_profile(db: Session, user_id: int) -> Student:
    from fastapi import HTTPException
    student = db.query(Student).filter(Student.user_id == user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
    return student


# ---------------------------------------------------------------
# POST /placement/postings/ — Admin creates a job posting
# ---------------------------------------------------------------
@router.post(
    "/postings/",
    response_model=JobPostingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new job posting (Admin only)",
)
def create_posting_route(
    data: JobPostingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    posting = create_job_posting(db, data, current_user.id)
    return build_posting_response(posting, db)


# ---------------------------------------------------------------
# GET /placement/postings/ — List all active postings
# ---------------------------------------------------------------
@router.get(
    "/postings/",
    response_model=List[JobPostingResponse],
    summary="List job postings. Students see eligibility flag.",
)
def list_postings_route(
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    postings = list_job_postings(db, active_only, skip, limit)
    # For students, compute eligibility per posting
    student = None
    if current_user.role == UserRole.student:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
    return [build_posting_response(p, db, student) for p in postings]


# ---------------------------------------------------------------
# GET /placement/postings/{id} — Single posting detail
# ---------------------------------------------------------------
@router.get(
    "/postings/{posting_id}",
    response_model=JobPostingResponse,
    summary="Get one job posting detail",
)
def get_posting_route(
    posting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    posting = get_job_posting(db, posting_id)
    student = None
    if current_user.role == UserRole.student:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
    return build_posting_response(posting, db, student)


# ---------------------------------------------------------------
# PATCH /placement/postings/{id} — Update posting (Admin)
# ---------------------------------------------------------------
@router.patch(
    "/postings/{posting_id}",
    response_model=JobPostingResponse,
    summary="Update a job posting (Admin only)",
)
def update_posting_route(
    posting_id: int,
    data: JobPostingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    posting = update_job_posting(db, posting_id, data)
    return build_posting_response(posting, db)


# ---------------------------------------------------------------
# DELETE /placement/postings/{id} — Soft delete (Admin)
# ---------------------------------------------------------------
@router.delete(
    "/postings/{posting_id}",
    summary="Deactivate a job posting (Admin only)",
)
def delete_posting_route(
    posting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return delete_job_posting(db, posting_id)


# ---------------------------------------------------------------
# POST /placement/apply — Student applies to a job
# ---------------------------------------------------------------
@router.post(
    "/apply",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to a job posting (Student only)",
)
def apply_route(
    data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Only students can apply.")
    student = _get_student_profile(db, current_user.id)
    app = apply_to_job(db, student.id, data)
    # Reload with relationships for response building
    from backend.models.placement_application import PlacementApplication
    app = (
        db.query(PlacementApplication)
        .options(
            joinedload(PlacementApplication.job_posting),
            joinedload(PlacementApplication.student).joinedload(Student.user),
        )
        .filter(PlacementApplication.id == app.id)
        .first()
    )
    return build_application_response(app)


# ---------------------------------------------------------------
# DELETE /placement/applications/{id}/withdraw — Student withdraws
# ---------------------------------------------------------------
@router.delete(
    "/applications/{application_id}/withdraw",
    response_model=ApplicationResponse,
    summary="Withdraw your own application (Student only)",
)
def withdraw_route(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from backend.models.placement_application import PlacementApplication
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Only students can withdraw applications.")
    student = _get_student_profile(db, current_user.id)
    app = withdraw_application(db, student.id, application_id)
    app = (
        db.query(PlacementApplication)
        .options(
            joinedload(PlacementApplication.job_posting),
            joinedload(PlacementApplication.student).joinedload(Student.user),
        )
        .filter(PlacementApplication.id == app.id)
        .first()
    )
    return build_application_response(app)


# ---------------------------------------------------------------
# GET /placement/applications/me — Student views own applications
# ---------------------------------------------------------------
@router.get(
    "/applications/me",
    response_model=List[ApplicationResponse],
    summary="View your own placement applications (Student only)",
)
def my_applications_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Students only.")
    student = _get_student_profile(db, current_user.id)
    apps = get_my_applications(db, student.id)
    return [build_application_response(a) for a in apps]


# ---------------------------------------------------------------
# GET /placement/postings/{id}/applications — Admin sees all apps
# ---------------------------------------------------------------
@router.get(
    "/postings/{posting_id}/applications",
    response_model=List[ApplicationResponse],
    summary="List all applications for a job posting (Admin or Faculty)",
)
def posting_applications_route(
    posting_id: int,
    status_filter: Optional[ApplicationStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    apps = list_applications_for_posting(db, posting_id, status_filter)
    return [build_application_response(a) for a in apps]


# ---------------------------------------------------------------
# PATCH /placement/applications/{id}/status — Admin updates status
# ---------------------------------------------------------------
@router.patch(
    "/applications/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Update application status (Admin only)",
)
def update_status_route(
    application_id: int,
    data: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from backend.models.placement_application import PlacementApplication
    app = update_application_status(db, application_id, data)
    app = (
        db.query(PlacementApplication)
        .options(
            joinedload(PlacementApplication.job_posting),
            joinedload(PlacementApplication.student).joinedload(Student.user),
        )
        .filter(PlacementApplication.id == app.id)
        .first()
    )
    return build_application_response(app)


# ---------------------------------------------------------------
# DELETE /placement/applications/{id} — Hard delete (Admin only, for cleanup)
# ---------------------------------------------------------------
@router.delete(
    "/applications/{application_id}",
    summary="Delete any application (Admin only)",
)
def admin_delete_application_route(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from fastapi import HTTPException
    from backend.models.placement_application import PlacementApplication
    app = db.query(PlacementApplication).filter(PlacementApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    db.delete(app)
    db.commit()
    return {"message": f"Application {application_id} deleted.", "id": application_id}


# ---------------------------------------------------------------
# GET /placement/admin/student/{id} — All apps for a student (Admin)
# ---------------------------------------------------------------
@router.get(
    "/admin/student/{student_id}",
    summary="Get all applications for a student (Admin only)",
)
def admin_student_applications_route(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from backend.models.placement_application import PlacementApplication
    apps = (
        db.query(PlacementApplication)
        .options(
            joinedload(PlacementApplication.job_posting),
            joinedload(PlacementApplication.student).joinedload(Student.user),
        )
        .filter(PlacementApplication.student_id == student_id)
        .all()
    )
    return [build_application_response(a) for a in apps]


# ---------------------------------------------------------------
# GET /placement/analytics — Placement statistics (Admin/Faculty)
# ---------------------------------------------------------------
@router.get(
    "/analytics",
    response_model=PlacementAnalyticsResponse,
    summary="Institution placement analytics (Admin or Faculty)",
)
def analytics_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_faculty(current_user)
    return get_placement_analytics(db)
