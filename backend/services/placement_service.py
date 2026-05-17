# =============================================================
# services/placement_service.py — Placement Module Business Logic
# =============================================================
# KEY DESIGN DECISIONS:
#
# 1. ELIGIBILITY ENGINE
#    Before a student can apply, check three criteria:
#    a) Department in allowed_departments (string split)
#    b) Latest CGPA >= min_cgpa (from semester_results table)
#    c) Overall attendance % >= min_attendance_pct
#    All three must pass. Checked at apply-time AND shown to
#    student when browsing listings (is_eligible flag).
#
# 2. NOTIFICATION ON STATUS CHANGE
#    Admin changes status → system notification fires to student.
#    Uses the same create_system_notification() pattern as the rest.
#    Wrapped in try/except so notification failure never blocks the update.
#
# 3. PLACEMENT ANALYTICS
#    "Placed" = application status == selected.
#    Placement rate = placed / total eligible students (not total applied).
#    This is the industry-standard metric used by NIRF rankings.
#
# 4. ONE-APPLICATION-PER-JOB
#    Enforced by DB UNIQUE constraint + 409 check in service.
#    Student can withdraw before shortlisting.
#    After shortlisted, withdrawal is locked (company has their CV).
# =============================================================

from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException

from backend.models.job_posting import JobPosting
from backend.models.placement_application import PlacementApplication
from backend.models.student import Student
from backend.models.user import User
from backend.models.enums import ApplicationStatus, Department
from backend.schemas.placement import (
    JobPostingCreate, JobPostingUpdate, JobPostingResponse,
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
    PlacementAnalyticsResponse, PlacementFunnelStats,
    DepartmentPlacementStats, CompanyStats,
)


# ---------------------------------------------------------------
# JOB POSTING — Admin operations
# ---------------------------------------------------------------

def create_job_posting(db: Session, data: JobPostingCreate, admin_user_id: int) -> JobPosting:
    posting = JobPosting(
        company_name=data.company_name,
        role_title=data.role_title,
        description=data.description,
        location=data.location,
        package_lpa=data.package_lpa,
        allowed_departments=data.allowed_departments.lower().strip() if data.allowed_departments else None,
        min_cgpa=data.min_cgpa,
        min_attendance_pct=data.min_attendance_pct,
        application_deadline=data.application_deadline,
        created_by=admin_user_id,
    )
    db.add(posting)
    db.commit()
    db.refresh(posting)

    # Notify eligible students about the new opening
    _notify_eligible_students(db, posting)
    return posting


def list_job_postings(
    db: Session,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 50,
) -> List[JobPosting]:
    q = db.query(JobPosting)
    if active_only:
        q = q.filter(JobPosting.is_active == True)
    return q.order_by(JobPosting.created_at.desc()).offset(skip).limit(limit).all()


def get_job_posting(db: Session, posting_id: int) -> JobPosting:
    p = db.query(JobPosting).filter(JobPosting.id == posting_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Job posting {posting_id} not found.")
    return p


def update_job_posting(db: Session, posting_id: int, data: JobPostingUpdate) -> JobPosting:
    p = get_job_posting(db, posting_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


def delete_job_posting(db: Session, posting_id: int) -> dict:
    """Soft-delete: set is_active=False. Preserves application history."""
    p = get_job_posting(db, posting_id)
    p.is_active = False
    p.is_open = False
    db.commit()
    return {"message": f"Job posting {posting_id} deactivated.", "id": posting_id}


# ---------------------------------------------------------------
# ELIGIBILITY ENGINE
# ---------------------------------------------------------------

def check_eligibility(db: Session, student: Student, posting: JobPosting) -> tuple[bool, str]:
    """
    Returns (is_eligible, reason_if_not_eligible).

    Three-gate check — all must pass:
    1. Department gate
    2. CGPA gate
    3. Attendance gate
    """
    # GATE 1: Department
    if posting.allowed_departments:
        allowed = [d.strip().lower() for d in posting.allowed_departments.split(",")]
        if student.department.value not in allowed:
            return False, f"Department {student.department.value} not in allowed list: {allowed}"

    # GATE 2: CGPA
    if posting.min_cgpa and posting.min_cgpa > 0:
        latest_cgpa = _get_student_cgpa(db, student.id)
        if latest_cgpa is None:
            return False, "No semester results on record yet."
        if latest_cgpa < posting.min_cgpa:
            return False, f"CGPA {latest_cgpa} below required {posting.min_cgpa}"

    # GATE 3: Attendance
    if posting.min_attendance_pct and posting.min_attendance_pct > 0:
        att_pct = _get_student_attendance_pct(db, student.id)
        if att_pct < posting.min_attendance_pct:
            return False, f"Attendance {att_pct}% below required {posting.min_attendance_pct}%"

    return True, "Eligible"


def _get_student_cgpa(db: Session, student_id: int) -> Optional[float]:
    """Latest CGPA = max CGPA recorded across all semester results."""
    from backend.models.semester_result import SemesterResult
    result = (
        db.query(func.max(SemesterResult.cgpa))
        .filter(SemesterResult.student_id == student_id)
        .scalar()
    )
    return float(result) if result is not None else None


def _get_student_attendance_pct(db: Session, student_id: int) -> float:
    """Overall attendance percentage across all records."""
    from backend.models.attendance import Attendance
    from backend.models.enums import AttendanceStatus
    total = db.query(func.count(Attendance.id)).filter(Attendance.student_id == student_id).scalar() or 0
    if total == 0:
        return 100.0  # No records = not penalised
    present = db.query(func.count(Attendance.id)).filter(
        Attendance.student_id == student_id,
        Attendance.status == AttendanceStatus.present,
    ).scalar() or 0
    return round(present / total * 100, 2)


# ---------------------------------------------------------------
# APPLICATIONS — Student operations
# ---------------------------------------------------------------

def apply_to_job(db: Session, student_id: int, data: ApplicationCreate) -> PlacementApplication:
    posting = get_job_posting(db, data.job_posting_id)

    # Check posting is open
    if not posting.is_active or not posting.is_open:
        raise HTTPException(status_code=400, detail="This job posting is closed.")

    # Check deadline
    if posting.application_deadline:
        now = datetime.now(timezone.utc)
        deadline = posting.application_deadline
        if deadline.tzinfo is None:
            from datetime import timezone as tz
            deadline = deadline.replace(tzinfo=tz.utc)
        if now > deadline:
            raise HTTPException(status_code=400, detail="Application deadline has passed.")

    # Fetch student
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # Eligibility check
    eligible, reason = check_eligibility(db, student, posting)
    if not eligible:
        raise HTTPException(status_code=403, detail=f"Not eligible: {reason}")

    # Duplicate check
    existing = db.query(PlacementApplication).filter(
        PlacementApplication.student_id == student_id,
        PlacementApplication.job_posting_id == data.job_posting_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already applied to this job.")

    application = PlacementApplication(
        student_id=student_id,
        job_posting_id=data.job_posting_id,
        status=ApplicationStatus.applied,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def withdraw_application(db: Session, student_id: int, application_id: int) -> PlacementApplication:
    """
    Student withdraws an application.
    Only allowed if status is 'applied' or 'under_review'.
    Once shortlisted, the company has the student's CV — withdrawal blocked.
    """
    app = db.query(PlacementApplication).filter(
        PlacementApplication.id == application_id,
        PlacementApplication.student_id == student_id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    if app.status in (ApplicationStatus.shortlisted, ApplicationStatus.selected, ApplicationStatus.rejected):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot withdraw after status is '{app.status.value}'."
        )
    app.status = ApplicationStatus.withdrawn
    db.commit()
    db.refresh(app)
    return app


def get_my_applications(db: Session, student_id: int) -> List[PlacementApplication]:
    return (
        db.query(PlacementApplication)
        .options(joinedload(PlacementApplication.job_posting))
        .filter(PlacementApplication.student_id == student_id)
        .order_by(PlacementApplication.applied_at.desc())
        .all()
    )


# ---------------------------------------------------------------
# APPLICATIONS — Admin operations
# ---------------------------------------------------------------

def update_application_status(
    db: Session,
    application_id: int,
    data: ApplicationStatusUpdate,
) -> PlacementApplication:
    app = (
        db.query(PlacementApplication)
        .options(
            joinedload(PlacementApplication.student),
            joinedload(PlacementApplication.job_posting),
        )
        .filter(PlacementApplication.id == application_id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    old_status = app.status
    app.status = data.status
    if data.remarks:
        app.remarks = data.remarks
    db.commit()
    db.refresh(app)

    # Fire notification to student on status change
    if old_status != data.status:
        _notify_status_change(db, app)

    return app


def list_applications_for_posting(
    db: Session,
    posting_id: int,
    status_filter: Optional[ApplicationStatus] = None,
) -> List[PlacementApplication]:
    q = (
        db.query(PlacementApplication)
        .options(
            joinedload(PlacementApplication.student)
            .joinedload(Student.user),
        )
        .filter(PlacementApplication.job_posting_id == posting_id)
    )
    if status_filter:
        q = q.filter(PlacementApplication.status == status_filter)
    return q.order_by(PlacementApplication.applied_at.desc()).all()


# ---------------------------------------------------------------
# ANALYTICS
# ---------------------------------------------------------------

def get_placement_analytics(db: Session) -> PlacementAnalyticsResponse:
    total_postings  = db.query(func.count(JobPosting.id)).scalar() or 0
    active_postings = db.query(func.count(JobPosting.id)).filter(JobPosting.is_active == True).scalar() or 0
    total_apps      = db.query(func.count(PlacementApplication.id)).scalar() or 0
    placed_count    = db.query(func.count(PlacementApplication.id)).filter(
        PlacementApplication.status == ApplicationStatus.selected
    ).scalar() or 0

    # Overall placement rate = placed / total students
    total_students  = db.query(func.count(Student.id)).scalar() or 1
    placement_rate  = round(placed_count / total_students * 100, 2)

    # Package stats — from selected applications joined to job postings
    pkg_query = (
        db.query(JobPosting.package_lpa)
        .join(PlacementApplication, PlacementApplication.job_posting_id == JobPosting.id)
        .filter(
            PlacementApplication.status == ApplicationStatus.selected,
            JobPosting.package_lpa.isnot(None),
        )
    )
    pkg_vals = [row[0] for row in pkg_query.all()]
    avg_pkg  = round(sum(pkg_vals) / len(pkg_vals), 2) if pkg_vals else None
    max_pkg  = max(pkg_vals) if pkg_vals else None

    # Funnel stats
    funnel_rows = (
        db.query(PlacementApplication.status, func.count(PlacementApplication.id))
        .group_by(PlacementApplication.status)
        .all()
    )
    funnel_map = {s.value: c for s, c in funnel_rows}
    funnel = PlacementFunnelStats(
        total_applied=funnel_map.get("applied", 0),
        under_review=funnel_map.get("under_review", 0),
        shortlisted=funnel_map.get("shortlisted", 0),
        selected=funnel_map.get("selected", 0),
        rejected=funnel_map.get("rejected", 0),
        withdrawn=funnel_map.get("withdrawn", 0),
    )

    by_dept  = _department_placement_stats(db, total_students)
    top_comp = _top_companies(db)

    return PlacementAnalyticsResponse(
        total_job_postings=total_postings,
        active_postings=active_postings,
        total_applications=total_apps,
        total_placed_students=placed_count,
        overall_placement_rate=placement_rate,
        avg_package_lpa=avg_pkg,
        highest_package_lpa=max_pkg,
        funnel=funnel,
        by_department=by_dept,
        top_companies=top_comp,
    )


def _department_placement_stats(db: Session, total_students: int) -> List[DepartmentPlacementStats]:
    results = []
    for dept in Department:
        dept_count = db.query(func.count(Student.id)).filter(Student.department == dept).scalar() or 0
        if dept_count == 0:
            continue
        placed = (
            db.query(func.count(PlacementApplication.id))
            .join(Student, PlacementApplication.student_id == Student.id)
            .filter(
                Student.department == dept,
                PlacementApplication.status == ApplicationStatus.selected,
            )
            .scalar() or 0
        )
        pkg_vals = [
            row[0] for row in (
                db.query(JobPosting.package_lpa)
                .join(PlacementApplication, PlacementApplication.job_posting_id == JobPosting.id)
                .join(Student, PlacementApplication.student_id == Student.id)
                .filter(
                    Student.department == dept,
                    PlacementApplication.status == ApplicationStatus.selected,
                    JobPosting.package_lpa.isnot(None),
                ).all()
            )
        ]
        results.append(DepartmentPlacementStats(
            department=dept.value,
            total_students=dept_count,
            placed_count=placed,
            placement_rate=round(placed / dept_count * 100, 2),
            avg_package_lpa=round(sum(pkg_vals) / len(pkg_vals), 2) if pkg_vals else None,
            highest_package_lpa=max(pkg_vals) if pkg_vals else None,
        ))
    return results


def _top_companies(db: Session, limit: int = 10) -> List[CompanyStats]:
    rows = (
        db.query(
            JobPosting.company_name,
            func.count(JobPosting.id.distinct()).label("openings"),
            func.count(PlacementApplication.id).label("apps"),
        )
        .outerjoin(PlacementApplication, PlacementApplication.job_posting_id == JobPosting.id)
        .group_by(JobPosting.company_name)
        .order_by(func.count(PlacementApplication.id).desc())
        .limit(limit)
        .all()
    )
    result = []
    for name, openings, apps in rows:
        placed = (
            db.query(func.count(PlacementApplication.id))
            .join(JobPosting, PlacementApplication.job_posting_id == JobPosting.id)
            .filter(
                JobPosting.company_name == name,
                PlacementApplication.status == ApplicationStatus.selected,
            )
            .scalar() or 0
        )
        result.append(CompanyStats(
            company_name=name,
            total_openings=openings,
            total_applications=apps or 0,
            students_placed=placed,
        ))
    return result


# ---------------------------------------------------------------
# RESPONSE BUILDER — Denormalise for API response
# ---------------------------------------------------------------

def build_application_response(app: PlacementApplication) -> ApplicationResponse:
    return ApplicationResponse(
        id=app.id,
        student_id=app.student_id,
        job_posting_id=app.job_posting_id,
        status=app.status,
        remarks=app.remarks,
        applied_at=app.applied_at,
        updated_at=app.updated_at,
        company_name=app.job_posting.company_name if app.job_posting else None,
        role_title=app.job_posting.role_title if app.job_posting else None,
        package_lpa=app.job_posting.package_lpa if app.job_posting else None,
        roll_number=app.student.roll_number if app.student else None,
        student_name=app.student.user.full_name if (app.student and app.student.user) else None,
    )


def build_posting_response(
    posting: JobPosting,
    db: Session,
    student: Optional[Student] = None,
) -> JobPostingResponse:
    total_applications = db.query(func.count(PlacementApplication.id)).filter(
        PlacementApplication.job_posting_id == posting.id
    ).scalar() or 0

    is_eligible = None
    if student:
        eligible, _ = check_eligibility(db, student, posting)
        is_eligible = eligible

    return JobPostingResponse(
        id=posting.id,
        company_name=posting.company_name,
        role_title=posting.role_title,
        description=posting.description,
        location=posting.location,
        package_lpa=posting.package_lpa,
        allowed_departments=posting.allowed_departments,
        min_cgpa=posting.min_cgpa,
        min_attendance_pct=posting.min_attendance_pct,
        application_deadline=posting.application_deadline,
        is_active=posting.is_active,
        is_open=posting.is_open,
        created_at=posting.created_at,
        total_applications=total_applications,
        is_eligible=is_eligible,
    )


# ---------------------------------------------------------------
# NOTIFICATIONS — Internal helpers
# ---------------------------------------------------------------

def _notify_eligible_students(db: Session, posting: JobPosting) -> None:
    """Fan-out: notify every eligible student about a new job opening."""
    try:
        from backend.services.notification_service import create_system_notification
        from backend.models.enums import NotificationType

        students = db.query(Student).options(joinedload(Student.user)).all()
        notified = 0
        for student in students:
            eligible, _ = check_eligibility(db, student, posting)
            if eligible and student.user:
                create_system_notification(
                    db=db,
                    recipient_user_id=student.user_id,
                    title=f"New Job Opening: {posting.company_name}",
                    message=(
                        f"{posting.company_name} is hiring for {posting.role_title}. "
                        f"Package: {'₹' + str(posting.package_lpa) + ' LPA' if posting.package_lpa else 'Not disclosed'}. "
                        f"Min CGPA: {posting.min_cgpa}"
                    ),
                    notification_type=NotificationType.placement_update,
                )
                notified += 1
    except Exception:
        pass  # Never block posting creation


def _notify_status_change(db: Session, app: PlacementApplication) -> None:
    """Notify the student when their application status changes."""
    try:
        from backend.services.notification_service import create_system_notification
        from backend.models.enums import NotificationType

        status_messages = {
            ApplicationStatus.under_review: "is now under review",
            ApplicationStatus.shortlisted:  "has been shortlisted for interview",
            ApplicationStatus.selected:     "CONGRATULATIONS! You have been selected",
            ApplicationStatus.rejected:     "was not selected this time",
            ApplicationStatus.withdrawn:    "has been withdrawn",
        }
        msg_suffix = status_messages.get(app.status, f"status updated to {app.status.value}")
        company = app.job_posting.company_name if app.job_posting else "Company"
        role    = app.job_posting.role_title if app.job_posting else "Role"

        create_system_notification(
            db=db,
            recipient_user_id=app.student.user_id if app.student else None,
            title=f"Placement Update: {company}",
            message=f"Your application for {role} at {company} {msg_suffix}."
                    + (f" Remarks: {app.remarks}" if app.remarks else ""),
            notification_type=NotificationType.placement_update,
        )
    except Exception:
        pass
