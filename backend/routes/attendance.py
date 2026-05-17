# =============================================================
# routes/attendance.py — Attendance API Endpoints
# =============================================================
# Thin routes. All business logic in attendance_service.py.
#
# ROUTE MAP:
#   POST /attendance/mark                    [faculty]
#   GET  /attendance/me                      [student]  own records
#   GET  /attendance/student/{id}            [admin/faculty]
#   GET  /attendance/section/{id}/date/{d}   [admin/faculty]
#   GET  /attendance/analytics/student/{id}  [admin/faculty/own-student]
#   GET  /attendance/analytics/section/{id}  [admin/faculty]
#   GET  /attendance/analytics/low/{id}      [admin/faculty]
# =============================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_faculty,
    get_current_student,
    get_current_admin,
    get_current_user,
)
from backend.models.user import User, UserRole
from backend.schemas.attendance import (
    AttendanceBulkMarkRequest,
    AttendanceBulkMarkResponse,
    AttendanceResponse,
    StudentAttendanceAnalytics,
    SectionAttendanceAnalytics,
    LowAttendanceAlert,
)
from backend.services.attendance_service import (
    mark_attendance_bulk,
    get_student_attendance,
    get_section_attendance,
    calculate_student_analytics,
    calculate_section_analytics,
    get_low_attendance_students,
)
from backend.services.student_service import get_student_by_user_id
from backend.services.faculty_service import get_faculty_by_user_id

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
)


# ---------------------------------------------------------------
# POST /attendance/mark — Faculty marks bulk attendance
# ---------------------------------------------------------------
@router.post(
    "/mark",
    response_model=AttendanceBulkMarkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Mark attendance for an entire class session (Faculty only)",
)
def mark_attendance_route(
    data: AttendanceBulkMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    return mark_attendance_bulk(db, current_user.id, data)


# ---------------------------------------------------------------
# GET /attendance/me — Student views own attendance
# ---------------------------------------------------------------
# MUST be before /attendance/student/{id} — same ordering rule
# ---------------------------------------------------------------
@router.get(
    "/me",
    response_model=List[AttendanceResponse],
    summary="Student views their own attendance records",
)
def get_my_attendance(
    subject: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    student = get_student_by_user_id(db, current_user.id)
    return get_student_attendance(db, student.id, subject, from_date, to_date)


# ---------------------------------------------------------------
# GET /attendance/me/analytics — Student views own analytics
# ---------------------------------------------------------------
@router.get(
    "/me/analytics",
    response_model=StudentAttendanceAnalytics,
    summary="Student views their own attendance percentage and subject breakdown",
)
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
):
    student = get_student_by_user_id(db, current_user.id)
    return calculate_student_analytics(db, student.id)


# ---------------------------------------------------------------
# GET /attendance/student/{student_id} — Admin/Faculty views student
# ---------------------------------------------------------------
@router.get(
    "/student/{student_id}",
    response_model=List[AttendanceResponse],
    summary="View a student's attendance records (Admin or Faculty)",
)
def get_student_attendance_route(
    student_id: int,
    subject: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty access required.")
    return get_student_attendance(db, student_id, subject, from_date, to_date)


# ---------------------------------------------------------------
# GET /attendance/section/{id}/date/{date} — Section daily view
# ---------------------------------------------------------------
@router.get(
    "/section/{section_id}/date/{attendance_date}",
    response_model=List[AttendanceResponse],
    summary="View section attendance on a specific date (Admin or Faculty)",
)
def get_section_attendance_route(
    section_id: int,
    attendance_date: date,
    subject: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty access required.")
    return get_section_attendance(db, section_id, attendance_date, subject)


# ---------------------------------------------------------------
# GET /attendance/analytics/student/{id} — Student analytics
# ---------------------------------------------------------------
@router.get(
    "/analytics/student/{student_id}",
    response_model=StudentAttendanceAnalytics,
    summary="Get full attendance analytics for a student (Admin or Faculty)",
)
def get_student_analytics_route(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty access required.")
    return calculate_student_analytics(db, student_id)


# ---------------------------------------------------------------
# GET /attendance/analytics/section/{id} — Section analytics
# ---------------------------------------------------------------
@router.get(
    "/analytics/section/{section_id}",
    response_model=SectionAttendanceAnalytics,
    summary="Get attendance analytics for an entire section (Admin or Faculty)",
)
def get_section_analytics_route(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty access required.")
    return calculate_section_analytics(db, section_id)


# ---------------------------------------------------------------
# GET /attendance/analytics/low/{section_id} — Low attendance alerts
# ---------------------------------------------------------------
@router.get(
    "/analytics/low/{section_id}",
    response_model=List[LowAttendanceAlert],
    summary="Get students with low attendance in a section (Admin or Faculty)",
)
def get_low_attendance_route(
    section_id: int,
    threshold: float = Query(default=75.0, ge=1.0, le=100.0,
                             description="Minimum attendance % threshold"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty access required.")
    return get_low_attendance_students(db, section_id, threshold)
