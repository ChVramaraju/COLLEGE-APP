# =============================================================
# services/admin_service.py — Admin Dashboard Business Logic
# =============================================================
# WHY A DEDICATED ADMIN SERVICE?
#   The dashboard needs data from EVERY module simultaneously.
#   Putting those queries in individual module services would
#   require the admin route to call 8 different services and
#   assemble the response itself — that's fat route logic.
#   A dedicated admin_service aggregates cross-module queries
#   into coherent, single-purpose functions.
#
# QUERY STRATEGY:
#   Use SQLAlchemy scalar aggregations (func.count, func.avg)
#   rather than loading all rows into Python and counting them.
#   func.count() runs in the DB engine — orders of magnitude faster
#   for large institutions (10,000+ students).
# =============================================================

import calendar
from datetime import datetime, timezone, date
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException

from backend.models.user import User, UserRole
from backend.models.student import Student
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.attendance import Attendance
from backend.models.enums import Department
from backend.schemas.admin import (
    DashboardResponse, UserSummary, StudentSummary, FacultySummary,
    AttendanceSummary, TestSummary, ResultSummary, NotificationSummary,
    UserAdminView, DepartmentPerformance, SectionPerformance,
    TopPerformer, InstitutionAnalyticsResponse,
    SystemHealthResponse, AnnouncementRequest, AnnouncementResponse,
    TrendsMonthPoint, TrendsResponse, ActivityItem,
    AnnouncementAudience,
    CreateUserRequest, UpdateUserRequest, DeleteUserResponse,
    DepartmentsDataResponse, DeptOption,
)
from backend.auth.hashing import hash_password
from backend.models.enums import Designation


# ---------------------------------------------------------------
# DASHBOARD — Full institution snapshot
# ---------------------------------------------------------------
def get_dashboard(db: Session) -> DashboardResponse:
    """
    Executes ~12 aggregation queries and returns a complete
    institution snapshot. Each sub-query runs at the DB level.
    """

    # --- USERS ---
    total_users  = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    role_counts  = dict(
        db.query(User.role, func.count(User.id))
        .group_by(User.role)
        .all()
    )
    by_role = {str(r.value): c for r, c in role_counts.items()}

    # --- STUDENTS ---
    total_students  = db.query(func.count(Student.id)).scalar() or 0
    active_students = (
        db.query(func.count(Student.id))
        .join(User, Student.user_id == User.id)
        .filter(User.is_active == True)
        .scalar() or 0
    )
    dept_rows = (
        db.query(Student.department, func.count(Student.id))
        .group_by(Student.department)
        .all()
    )
    by_department = {str(d.value): c for d, c in dept_rows}

    sem_rows = (
        db.query(Student.semester, func.count(Student.id))
        .group_by(Student.semester)
        .all()
    )
    by_semester = {str(s): c for s, c in sem_rows}

    # --- FACULTY ---
    total_faculty  = db.query(func.count(Faculty.id)).scalar() or 0
    active_faculty = (
        db.query(func.count(Faculty.id))
        .join(User, Faculty.user_id == User.id)
        .filter(User.is_active == True)
        .scalar() or 0
    )
    fac_dept_rows = (
        db.query(Faculty.department, func.count(Faculty.id))
        .group_by(Faculty.department)
        .all()
    )
    fac_by_dept = {str(d.value): c for d, c in fac_dept_rows}

    # --- SECTIONS ---
    total_sections  = db.query(func.count(Section.id)).scalar() or 0
    active_sections = total_sections  # Section model has no is_active; all sections are active

    # --- ATTENDANCE ---
    total_att_records = db.query(func.count(Attendance.id)).scalar() or 0
    present_count = (
        db.query(func.count(Attendance.id))
        .filter(Attendance.status == "present")
        .scalar() or 0
    )
    inst_avg_pct = round(present_count / total_att_records * 100, 2) if total_att_records > 0 else 0.0

    # Students below 75% — calculated from per-student attendance
    below_75_count = _count_low_attendance_students(db)

    # --- TESTS ---
    test_stats = _get_test_stats(db)

    # --- RESULTS ---
    result_stats = _get_result_stats(db)

    # --- NOTIFICATIONS ---
    notif_stats = _get_notification_stats(db)

    return DashboardResponse(
        users=UserSummary(
            total_users=total_users,
            active_users=active_users,
            inactive_users=total_users - active_users,
            by_role=by_role,
        ),
        students=StudentSummary(
            total_students=total_students,
            active_students=active_students,
            by_department=by_department,
            by_semester=by_semester,
        ),
        faculty=FacultySummary(
            total_faculty=total_faculty,
            active_faculty=active_faculty,
            by_department=fac_by_dept,
        ),
        sections={"total": total_sections, "active": active_sections},
        attendance=AttendanceSummary(
            total_records=total_att_records,
            institution_avg_percentage=inst_avg_pct,
            below_75_count=below_75_count,
        ),
        tests=test_stats,
        results=result_stats,
        notifications=notif_stats,
        generated_at=datetime.now(timezone.utc),
    )


def _count_low_attendance_students(db: Session) -> int:
    """Count students whose overall present/total < 75%."""
    try:
        from backend.models.enums import AttendanceStatus
        rows = (
            db.query(
                Attendance.student_id,
                func.count(Attendance.id).label("total"),
            )
            .group_by(Attendance.student_id)
            .all()
        )
        count = 0
        for sid, total in rows:
            if total and total > 0:
                present = db.query(func.count(Attendance.id)).filter(
                    Attendance.student_id == sid,
                    Attendance.status == AttendanceStatus.present,
                ).scalar() or 0
                if present / total * 100 < 75:
                    count += 1
        return count
    except Exception:
        return 0


def _get_test_stats(db: Session) -> TestSummary:
    try:
        from backend.models.test import Test
        from backend.models.test_attempt import TestAttempt
        total_tests     = db.query(func.count(Test.id)).scalar() or 0
        published_tests = db.query(func.count(Test.id)).filter(Test.is_published == True).scalar() or 0
        total_attempts  = db.query(func.count(TestAttempt.id)).filter(TestAttempt.is_submitted == True).scalar() or 0
        avg_score_pct   = db.query(func.avg(TestAttempt.score_percentage)).filter(
            TestAttempt.is_submitted == True, TestAttempt.score_percentage.isnot(None)
        ).scalar() or 0.0
        return TestSummary(
            total_tests=total_tests,
            published_tests=published_tests,
            total_attempts=total_attempts,
            avg_score_percentage=round(float(avg_score_pct), 2),
        )
    except Exception:
        return TestSummary(total_tests=0, published_tests=0, total_attempts=0, avg_score_percentage=0.0)


def _get_result_stats(db: Session) -> ResultSummary:
    try:
        from backend.models.result import Result
        total_results     = db.query(func.count(Result.id)).scalar() or 0
        published_results = db.query(func.count(Result.id)).filter(Result.is_published == True).scalar() or 0
        pass_count = db.query(func.count(Result.id)).filter(
            Result.is_published == True, Result.grade != "F"
        ).scalar() or 0
        avg_pct = db.query(func.avg(Result.percentage)).filter(Result.is_published == True).scalar() or 0.0
        pass_rate = round(pass_count / published_results * 100, 2) if published_results > 0 else 0.0
        return ResultSummary(
            total_results=total_results,
            published_results=published_results,
            overall_pass_rate=pass_rate,
            avg_percentage=round(float(avg_pct), 2),
        )
    except Exception:
        return ResultSummary(total_results=0, published_results=0, overall_pass_rate=0.0, avg_percentage=0.0)


def _get_notification_stats(db: Session) -> NotificationSummary:
    try:
        from backend.models.notification import Notification
        total_sent  = db.query(func.count(Notification.id)).filter(Notification.is_deleted == False).scalar() or 0
        unread_count = db.query(func.count(Notification.id)).filter(
            Notification.is_deleted == False, Notification.is_read == False
        ).scalar() or 0
        return NotificationSummary(total_sent=total_sent, unread_count=unread_count)
    except Exception:
        return NotificationSummary(total_sent=0, unread_count=0)


# ---------------------------------------------------------------
# USER MANAGEMENT
# ---------------------------------------------------------------
def list_all_users(
    db: Session,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[User]:
    q = (
        db.query(User)
        .options(
            joinedload(User.student_profile),
            joinedload(User.faculty_profile),
        )
    )
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    return q.order_by(User.id).offset(skip).limit(limit).all()


def set_user_active_status(db: Session, user_id: int, is_active: bool) -> User:
    """
    Activate or deactivate a user account.
    Deactivated accounts cannot log in — JWT is still valid until expiry,
    but get_current_user checks is_active on every request.
    WHY soft deactivation instead of deletion?
      → Referential integrity (student results, attendance still need the user)
      → Audit trail preserved
      → Easy reactivation
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found.")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Cannot deactivate an admin account.")
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------
# INSTITUTION-WIDE ANALYTICS
# ---------------------------------------------------------------
def get_institution_analytics(db: Session) -> InstitutionAnalyticsResponse:
    dept_perf = _get_department_performance(db)
    sec_perf  = _get_section_performance(db)
    toppers   = _get_top_performers(db)
    low_att   = _get_low_attendance_list(db)
    gpa_dist  = _get_gpa_distribution(db)
    return InstitutionAnalyticsResponse(
        department_performance=dept_perf,
        section_performance=sec_perf,
        top_performers=toppers,
        low_attendance_students=low_att,
        gpa_distribution=gpa_dist,
    )


def _get_department_performance(db: Session) -> list[DepartmentPerformance]:
    try:
        from backend.models.semester_result import SemesterResult
        results = []
        for dept in Department:
            student_count = (
                db.query(func.count(Student.id))
                .filter(Student.department == dept)
                .scalar() or 0
            )
            if student_count == 0:
                continue
            # Average CGPA for students in this department
            avg_cgpa = (
                db.query(func.avg(SemesterResult.cgpa))
                .join(Student, SemesterResult.student_id == Student.id)
                .filter(Student.department == dept)
                .scalar()
            )
            results.append(DepartmentPerformance(
                department=dept.value,
                student_count=student_count,
                avg_cgpa=round(float(avg_cgpa), 2) if avg_cgpa else None,
            ))
        return results
    except Exception:
        return []


def _get_section_performance(db: Session) -> list[SectionPerformance]:
    try:
        from backend.models.semester_result import SemesterResult
        sections = db.query(Section).filter(Section.is_active == True).all()
        results = []
        for sec in sections:
            student_count = db.query(func.count(Student.id)).filter(
                Student.section_id == sec.id
            ).scalar() or 0

            avg_cgpa = (
                db.query(func.avg(SemesterResult.cgpa))
                .join(Student, SemesterResult.student_id == Student.id)
                .filter(Student.section_id == sec.id)
                .scalar()
            )
            results.append(SectionPerformance(
                section_id=sec.id,
                section_name=sec.name,
                student_count=student_count,
                avg_cgpa=round(float(avg_cgpa), 2) if avg_cgpa else None,
            ))
        return results
    except Exception:
        return []


def _get_top_performers(db: Session, limit: int = 10) -> list[TopPerformer]:
    try:
        from backend.models.semester_result import SemesterResult
        rows = (
            db.query(
                Student,
                func.max(SemesterResult.cgpa).label("latest_cgpa"),
            )
            .join(SemesterResult, Student.id == SemesterResult.student_id)
            .join(User, Student.user_id == User.id)
            .group_by(Student.id)
            .order_by(func.max(SemesterResult.cgpa).desc())
            .limit(limit)
            .all()
        )
        return [
            TopPerformer(
                student_id=s.id,
                roll_number=s.roll_number,
                full_name=s.user.full_name if s.user else "",
                department=s.department.value,
                cgpa=round(float(cgpa), 2) if cgpa else None,
            )
            for s, cgpa in rows
        ]
    except Exception:
        return []


def _get_low_attendance_list(db: Session, limit: int = 20) -> list[dict]:
    try:
        from backend.models.enums import AttendanceStatus
        rows = (
            db.query(
                Student.id,
                Student.roll_number,
                func.count(Attendance.id).label("total"),
            )
            .join(Attendance, Student.id == Attendance.student_id)
            .group_by(Student.id, Student.roll_number)
            .having(func.count(Attendance.id) > 0)
            .all()
        )
        low = []
        for sid, roll, total in rows:
            present = db.query(func.count(Attendance.id)).filter(
                Attendance.student_id == sid,
                Attendance.status == AttendanceStatus.present,
            ).scalar() or 0
            pct = round(present / total * 100, 2)
            if pct < 75:
                low.append({"student_id": sid, "roll_number": roll, "attendance_pct": pct})
        low.sort(key=lambda x: x["attendance_pct"])
        return low[:limit]
    except Exception:
        return []


def _get_gpa_distribution(db: Session) -> dict:
    try:
        from backend.models.semester_result import SemesterResult
        rows = db.query(SemesterResult.cgpa).filter(SemesterResult.cgpa.isnot(None)).all()
        dist = {"9.0-10.0": 0, "8.0-9.0": 0, "7.0-8.0": 0, "6.0-7.0": 0, "below_6.0": 0}
        for (cgpa,) in rows:
            if cgpa >= 9.0:
                dist["9.0-10.0"] += 1
            elif cgpa >= 8.0:
                dist["8.0-9.0"] += 1
            elif cgpa >= 7.0:
                dist["7.0-8.0"] += 1
            elif cgpa >= 6.0:
                dist["6.0-7.0"] += 1
            else:
                dist["below_6.0"] += 1
        return dist
    except Exception:
        return {}


# ---------------------------------------------------------------
# SYSTEM HEALTH
# ---------------------------------------------------------------
def get_system_health(db: Session) -> SystemHealthResponse:
    from backend.services.websocket_manager import ws_manager
    from backend.models.notification import Notification

    try:
        from backend.models.notes import Note
        total_files = db.query(func.count(Note.id)).scalar() or 0
    except Exception:
        total_files = 0

    try:
        from backend.models.test_attempt import TestAttempt
        total_attempts = (
            db.query(func.count(TestAttempt.id))
            .filter(TestAttempt.is_submitted == True)
            .scalar() or 0
        )
    except Exception:
        total_attempts = 0

    return SystemHealthResponse(
        ws_connections=ws_manager.connection_count(),
        total_users=db.query(func.count(User.id)).scalar() or 0,
        active_students=(
            db.query(func.count(Student.id))
            .join(User, Student.user_id == User.id)
            .filter(User.is_active == True)
            .scalar() or 0
        ),
        active_faculty=(
            db.query(func.count(Faculty.id))
            .join(User, Faculty.user_id == User.id)
            .filter(User.is_active == True)
            .scalar() or 0
        ),
        total_notifications_sent=(
            db.query(func.count(Notification.id))
            .filter(Notification.is_deleted == False)
            .scalar() or 0
        ),
        total_files_uploaded=total_files,
        total_attendance_records=db.query(func.count(Attendance.id)).scalar() or 0,
        total_test_attempts=total_attempts,
        total_sections=db.query(func.count(Section.id)).scalar() or 0,
        generated_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------
# ANALYTICS TRENDS (last 6 months)
# ---------------------------------------------------------------
def get_analytics_trends(db: Session) -> TrendsResponse:
    from backend.models.notification import Notification

    now = datetime.now(timezone.utc)
    monthly_data: List[TrendsMonthPoint] = []

    for i in range(5, -1, -1):
        # Compute month boundaries in Python, then compare at DB level
        year  = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year  -= 1
        _, last_day  = calendar.monthrange(year, month)
        m_start = date(year, month, 1)
        m_end   = date(year, month, last_day)
        label   = m_start.strftime("%b %Y")

        # Notifications sent that month
        notif_count = (
            db.query(func.count(Notification.id))
            .filter(
                func.date(Notification.created_at) >= m_start,
                func.date(Notification.created_at) <= m_end,
            )
            .scalar() or 0
        )

        # Attendance records for that month
        att_count = (
            db.query(func.count(Attendance.id))
            .filter(Attendance.date >= m_start, Attendance.date <= m_end)
            .scalar() or 0
        )

        # Test attempts submitted that month (best-effort)
        test_count = 0
        try:
            from backend.models.test_attempt import TestAttempt
            test_count = (
                db.query(func.count(TestAttempt.id))
                .filter(
                    TestAttempt.is_submitted == True,
                    func.date(TestAttempt.submitted_at) >= m_start,
                    func.date(TestAttempt.submitted_at) <= m_end,
                )
                .scalar() or 0
            )
        except Exception:
            pass

        monthly_data.append(TrendsMonthPoint(
            month=label,
            notifications_count=notif_count,
            test_attempts_count=test_count,
            attendance_records_count=att_count,
        ))

    # Dept student distribution
    dept_rows = (
        db.query(Student.department, func.count(Student.id))
        .group_by(Student.department)
        .all()
    )
    dept_dist = [{"dept": d.value, "count": c} for d, c in dept_rows]

    return TrendsResponse(
        monthly_data=monthly_data,
        dept_student_distribution=dept_dist,
        gpa_distribution=_get_gpa_distribution(db),
    )


# ---------------------------------------------------------------
# ANNOUNCEMENTS — Role-targeted broadcast
# ---------------------------------------------------------------
def create_announcement(
    db: Session,
    sender_user_id: int,
    req: AnnouncementRequest,
) -> AnnouncementResponse:
    from backend.models.notification import Notification
    from backend.services.websocket_manager import ws_manager

    # Build recipient query
    q = db.query(User).filter(User.is_active == True)
    if req.audience == AnnouncementAudience.students:
        q = q.filter(User.role == UserRole.student)
    elif req.audience == AnnouncementAudience.faculty:
        q = q.filter(User.role == UserRole.faculty)
    # AnnouncementAudience.all → no role filter

    recipients = q.all()
    count = 0
    for user in recipients:
        try:
            n = Notification(
                title=req.title,
                message=req.message,
                notification_type=req.notification_type,
                sender_user_id=sender_user_id,
                recipient_user_id=user.id,
                is_broadcast=True,
            )
            db.add(n)
            count += 1
        except Exception:
            continue

    db.commit()

    # Best-effort WS push to connected recipients
    for user in recipients:
        ws_manager.push_sync(user.id, {
            "type": "notification",
            "data": {
                "id": 0,
                "title": req.title,
                "message": req.message,
                "notification_type": req.notification_type.value,
                "is_read": False,
                "is_broadcast": True,
                "read_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "sender_name": "Admin",
            },
        })

    return AnnouncementResponse(
        recipients_count=count,
        message=f"Announcement sent to {count} recipients.",
    )


# ---------------------------------------------------------------
# ACTIVITY FEED — Recent system-generated notifications
# ---------------------------------------------------------------
def get_activity_feed(db: Session, limit: int = 20) -> List[ActivityItem]:
    from backend.models.notification import Notification
    rows = (
        db.query(Notification)
        .filter(
            Notification.sender_user_id.is_(None),  # system-generated only
            Notification.is_deleted == False,
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ActivityItem(
            id=n.id,
            title=n.title,
            message=n.message,
            notification_type=n.notification_type.value,
            created_at=n.created_at,
        )
        for n in rows
    ]


# ---------------------------------------------------------------
# USER ADMINISTRATION — CRUD
# ---------------------------------------------------------------

def admin_create_user(db: Session, req: CreateUserRequest) -> User:
    """
    Creates a User row plus the role-specific profile (Student/Faculty)
    in a single transaction.  Rolls back fully on any failure.
    """
    # ── Duplicate guards ──────────────────────────────────────────
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(
            status_code=400,
            detail=f"Username '{req.username}' is already taken.",
        )
    if req.email:
        if db.query(User).filter(User.email == req.email).first():
            raise HTTPException(
                status_code=400,
                detail=f"Email '{req.email}' is already registered.",
            )

    try:
        # ── Core user row ─────────────────────────────────────────
        user = User(
            username=req.username,
            full_name=req.full_name,
            email=req.email,
            hashed_password=hash_password(req.password),
            role=req.role,
            is_active=True,
        )
        db.add(user)
        db.flush()   # generates user.id without committing

        # ── Role-specific profile ─────────────────────────────────
        if req.role == UserRole.student:
            dept = Department(req.department)
            profile = Student(
                user_id=user.id,
                roll_number=req.username,
                department=dept,
                semester=req.semester,
                section_id=req.section_id,
                admission_year=req.admission_year or datetime.now().year,
            )
            db.add(profile)

        elif req.role == UserRole.faculty:
            dept = Department(req.department)
            desig = Designation(req.designation)
            profile = Faculty(
                user_id=user.id,
                employee_id=req.username,
                department=dept,
                designation=desig,
            )
            db.add(profile)

        # admin role: only the users row is needed — no separate profile table

        db.commit()
        db.refresh(user)
        return user

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(exc)}",
        )


def admin_update_user(
    db: Session,
    user_id: int,
    req: UpdateUserRequest,
    current_admin_id: int,
) -> User:
    """
    Partial-update any user including role-specific profile fields.
    Uses model_fields_set to distinguish 'not sent' from 'set to None'.
    Transaction-safe: rolled back on any failure.
    """
    user = (
        db.query(User)
        .options(
            joinedload(User.student_profile),
            joinedload(User.faculty_profile),
        )
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    fields = req.model_fields_set
    try:
        # ── Core fields ───────────────────────────────────────────
        if 'full_name' in fields and req.full_name is not None:
            user.full_name = req.full_name

        if 'email' in fields:
            if req.email is not None:
                dup = (
                    db.query(User)
                    .filter(User.email == req.email, User.id != user_id)
                    .first()
                )
                if dup:
                    raise HTTPException(status_code=400, detail="Email already in use.")
            user.email = req.email

        # ── Student profile ───────────────────────────────────────
        if user.role == UserRole.student:
            profile = user.student_profile
            if profile is not None:
                if 'section_id' in fields:
                    if req.section_id is not None:
                        exists = db.query(Section).filter(Section.id == req.section_id).first()
                        if not exists:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Section {req.section_id} does not exist.",
                            )
                    profile.section_id = req.section_id   # None = unassign

                if 'semester' in fields and req.semester is not None:
                    profile.semester = req.semester

        # ── Faculty profile ───────────────────────────────────────
        elif user.role == UserRole.faculty:
            profile = user.faculty_profile
            if profile is not None:
                if 'department' in fields and req.department is not None:
                    try:
                        profile.department = Department(req.department)
                    except ValueError:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid department: '{req.department}'.",
                        )

                if 'designation' in fields and req.designation is not None:
                    try:
                        profile.designation = Designation(req.designation)
                    except ValueError:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid designation: '{req.designation}'.",
                        )

        db.commit()
        db.refresh(user)
        # Re-load profiles after refresh so model_validator can access them
        _ = user.student_profile
        _ = user.faculty_profile
        return user

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Update failed: {str(exc)}")


def admin_reset_password(db: Session, user_id: int, new_password: str) -> User:
    """
    Admin-initiated password reset.  Hashes the new password and
    persists it.  The target user's sessions remain valid until
    their token expires — acceptable trade-off for simplicity.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.hashed_password = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


def admin_delete_user(
    db: Session,
    user_id: int,
    current_admin_id: int,
) -> DeleteUserResponse:
    """
    Soft-deletes a user by deactivating them.
    Hard safety guards:
      - Cannot delete yourself
      - Cannot deactivate the last remaining admin
    """
    if user_id == current_admin_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.role == UserRole.admin:
        active_admin_count = (
            db.query(func.count(User.id))
            .filter(User.role == UserRole.admin, User.is_active == True)
            .scalar() or 0
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last active admin account.",
            )

    user.is_active = False
    db.commit()
    return DeleteUserResponse(
        user_id=user_id,
        message=f"User '{user.username}' has been deactivated.",
    )


def get_departments_data() -> DepartmentsDataResponse:
    """
    Returns the Department and Designation enum values as
    human-readable option lists for frontend dropdowns.
    """
    dept_labels = {
        "cse":   "Computer Science (CSE)",
        "ece":   "Electronics & Comm. (ECE)",
        "mech":  "Mechanical (MECH)",
        "civil": "Civil Engineering",
        "eee":   "Electrical & Electronics (EEE)",
        "it":    "Information Technology (IT)",
        "aids":  "AI & Data Science (AIDS)",
    }
    desig_labels = {
        "hod":            "Head of Department",
        "professor":      "Professor",
        "assoc_prof":     "Associate Professor",
        "asst_prof":      "Assistant Professor",
        "lecturer":       "Lecturer",
        "lab_instructor": "Lab Instructor",
    }
    return DepartmentsDataResponse(
        departments=[
            DeptOption(value=d.value, label=dept_labels.get(d.value, d.value.upper()))
            for d in Department
        ],
        designations=[
            DeptOption(value=d.value, label=desig_labels.get(d.value, d.value))
            for d in Designation
        ],
    )
