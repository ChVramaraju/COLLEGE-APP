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

from datetime import datetime, timezone
from typing import Optional
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
)


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
    q = db.query(User)
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
