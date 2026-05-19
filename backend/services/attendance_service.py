# =============================================================
# services/attendance_service.py — Attendance Business Logic
# =============================================================
# This service contains:
#   1. Bulk attendance marking (transactional)
#   2. Attendance retrieval (filtered queries)
#   3. Analytics calculations (aggregations, percentages)
#   4. Low attendance detection (threshold alerts)
#
# KEY ENGINEERING DECISIONS:
#   → Analytics are calculated dynamically from raw records
#     (not stored as cached summaries) — guarantees accuracy
#   → Bulk operations use db.bulk_save_objects() for performance
#   → All analytics use SQL aggregations — not Python loops
#     (SQL is faster for set operations on large datasets)
# =============================================================

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, and_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import Optional
from datetime import date

from backend.models.attendance import Attendance
from backend.models.student import Student
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.user import User
from backend.models.enums import AttendanceStatus
from backend.schemas.attendance import (
    AttendanceBulkMarkRequest,
    AttendanceBulkMarkResponse,
    StudentAttendanceAnalytics,
    SubjectBreakdown,
    SectionAttendanceAnalytics,
    LowAttendanceAlert,
    AttendanceStudentBrief,
    AttendanceSessionSummary,
    UpdateAttendanceEntry,
)

ATTENDANCE_THRESHOLD = 75.0   # Standard minimum attendance percentage


# ---------------------------------------------------------------
# MARK ATTENDANCE BULK — The core operation
# ---------------------------------------------------------------
def mark_attendance_bulk(
    db: Session,
    faculty_user_id: int,
    data: AttendanceBulkMarkRequest,
) -> AttendanceBulkMarkResponse:
    """
    Marks attendance for an entire class session in one transaction.

    PERMISSION CHECK:
    Faculty can only mark attendance for sections in their own department.
    This prevents a Mathematics faculty from accidentally (or maliciously)
    marking attendance for a CSE section.

    DUPLICATE CHECK:
    Before inserting, we check if attendance for this exact session
    (section + date + subject + period) already exists.
    If even ONE record exists → entire request is rejected with 409.
    This prevents partial re-marking which would corrupt analytics.

    TRANSACTION SAFETY:
    All records are inserted in a single transaction.
    If any insert fails → entire batch is rolled back.
    "All or nothing" — the atomic guarantee.

    BULK INSERT:
    db.bulk_save_objects() sends a single multi-row INSERT to PostgreSQL.
    Far more efficient than N separate db.add() calls for 60 students.
    """

    # --- Get faculty profile from JWT user_id ---
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found for this account."
        )

    # --- Validate section exists ---
    section = db.query(Section).filter(Section.id == data.section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {data.section_id} not found."
        )

    # --- PERMISSION: Faculty must be from same department as section ---
    # Real-world rule: A faculty from ECE cannot mark CSE attendance.
    if faculty.department != section.department:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Permission denied. Faculty is from '{faculty.department.value}' "
                f"but section belongs to '{section.department.value}'."
            )
        )

    # --- DUPLICATE CHECK: Has this exact session already been marked? ---
    # Check if ANY record exists for this section+date+subject+period.
    # Even one existing record means this session was already marked.
    already_marked = db.query(Attendance).filter(
        and_(
            Attendance.section_id == data.section_id,
            Attendance.attendance_date == data.attendance_date,
            Attendance.subject == data.subject,
            Attendance.period_number == data.period_number,
        )
    ).first()

    if already_marked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Attendance already marked for "
                f"Section {data.section_id}, {data.subject}, "
                f"Period {data.period_number} on {data.attendance_date}."
            )
        )

    # --- Validate student IDs belong to this section ---
    # Get all valid student IDs for this section.
    valid_student_ids = {
        s.id for s in
        db.query(Student.id).filter(Student.section_id == data.section_id).all()
    }

    invalid_ids = [
        e.student_id for e in data.entries
        if e.student_id not in valid_student_ids
    ]
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student IDs not in this section: {invalid_ids}"
        )

    # --- BULK INSERT: Build all Attendance objects ---
    try:
        records = [
            Attendance(
                student_id=entry.student_id,
                faculty_id=faculty.id,
                section_id=data.section_id,
                subject=data.subject,
                attendance_date=data.attendance_date,
                period_number=data.period_number,
                status=entry.status,
                remarks=entry.remarks,
            )
            for entry in data.entries
        ]

        db.bulk_save_objects(records)
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate attendance detected (database constraint violation)."
        )
    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger("smart_college").error(
            "Attendance marking failed", exc_info=e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Attendance marking failed. Please try again or contact the administrator."
        )

    present_count = sum(
        1 for e in data.entries
        if e.status in (AttendanceStatus.present, AttendanceStatus.late)
    )

    return AttendanceBulkMarkResponse(
        message="Attendance marked successfully.",
        section_id=data.section_id,
        subject=data.subject,
        attendance_date=data.attendance_date,
        period_number=data.period_number,
        records_created=len(records),
        present_count=present_count,
        absent_count=len(records) - present_count,
    )


# ---------------------------------------------------------------
# GET STUDENT ATTENDANCE — Filtered history
# ---------------------------------------------------------------
def get_student_attendance(
    db: Session,
    student_id: int,
    subject: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[Attendance]:
    """
    Returns a student's attendance records with optional filters.
    Used by student dashboard and admin review.

    Dynamic filtering:
    → No filters: full history
    → subject filter: one subject's history
    → date range: e.g., "March attendance"
    → combined: "Mathematics in March"
    """
    # Verify student exists
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student ID {student_id} not found."
        )

    query = db.query(Attendance).filter(Attendance.student_id == student_id)

    if subject:
        query = query.filter(Attendance.subject == subject.strip().title())
    if from_date:
        query = query.filter(Attendance.attendance_date >= from_date)
    if to_date:
        query = query.filter(Attendance.attendance_date <= to_date)

    return (
        query
        .order_by(Attendance.attendance_date.desc(), Attendance.period_number)
        .all()
    )


# ---------------------------------------------------------------
# GET SECTION ATTENDANCE — Whole class on a specific day
# ---------------------------------------------------------------
def get_section_attendance(
    db: Session,
    section_id: int,
    attendance_date: date,
    subject: Optional[str] = None,
) -> list[Attendance]:
    """
    Returns all attendance records for a section on a given date.
    Faculty uses this to review what was marked today.

    Can be filtered by subject if a section has multiple classes per day.
    """
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    query = db.query(Attendance).options(
        joinedload(Attendance.student).joinedload(Student.user)
    ).filter(
        Attendance.section_id == section_id,
        Attendance.attendance_date == attendance_date,
    )

    if subject:
        query = query.filter(Attendance.subject == subject.strip().title())

    return query.order_by(Attendance.period_number).all()


# ---------------------------------------------------------------
# CALCULATE STUDENT ANALYTICS — Percentage + Subject Breakdown
# ---------------------------------------------------------------
def calculate_student_analytics(
    db: Session,
    student_id: int,
) -> StudentAttendanceAnalytics:
    """
    Calculates complete attendance analytics for one student.

    SQL AGGREGATION APPROACH:
    We use GROUP BY + CASE/SUM at the SQL level — not Python loops.

    WHY?
    → Student may have 1,200 records over a year
    → Python loop: fetch 1,200 rows → iterate → slow, memory-heavy
    → SQL GROUP BY: DB engine does the math, returns ~5-10 summary rows
    → 100x less data transferred, 50x faster for large datasets

    PERCENTAGE FORMULA:
    percentage = (present + late) / total * 100

    WHY count "late" as present?
    → Student was physically present, just arrived late
    → Marking them absent would be inaccurate
    → Standard practice in most Indian college ERP systems
    """
    student = (
        db.query(Student)
        .options(joinedload(Student.user))
        .filter(Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student ID {student_id} not found."
        )

    # SQL aggregation: GROUP BY subject
    # For each subject: total count, present count, absent count, etc.
    results = (
        db.query(
            Attendance.subject,
            func.count(Attendance.id).label("total"),
            func.sum(
                case(
                    [(Attendance.status.in_(["present", "late"]), 1)],
                    else_=0,
                )
            ).label("present_count"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.absent, 1)], else_=0)
            ).label("absent_count"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.late, 1)], else_=0)
            ).label("late_count"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.excused, 1)], else_=0)
            ).label("excused_count"),
        )
        .filter(Attendance.student_id == student_id)
        .group_by(Attendance.subject)
        .all()
    )

    subject_breakdown = []
    overall_total = 0
    overall_present = 0

    for row in results:
        total = row.total or 0
        present = int(row.present_count or 0)
        pct = round((present / total * 100), 2) if total > 0 else 0.0

        subject_breakdown.append(SubjectBreakdown(
            subject=row.subject,
            total_classes=total,
            present_count=present,
            absent_count=int(row.absent_count or 0),
            late_count=int(row.late_count or 0),
            excused_count=int(row.excused_count or 0),
            percentage=pct,
            is_below_threshold=pct < ATTENDANCE_THRESHOLD,
        ))

        overall_total += total
        overall_present += present

    overall_pct = round(
        (overall_present / overall_total * 100), 2
    ) if overall_total > 0 else 0.0

    return StudentAttendanceAnalytics(
        student_id=student.id,
        roll_number=student.roll_number,
        full_name=student.user.full_name if student.user else "",
        overall_total=overall_total,
        overall_present=overall_present,
        overall_percentage=overall_pct,
        is_low_attendance=overall_pct < ATTENDANCE_THRESHOLD,
        subject_breakdown=sorted(subject_breakdown, key=lambda x: x.subject),
    )


# ---------------------------------------------------------------
# BULK STUDENT ANALYTICS HELPER — One query for all students
# ---------------------------------------------------------------
def _bulk_student_analytics(
    db: Session,
    students: list,
) -> dict:
    """
    Calculates attendance analytics for a list of students in ONE
    SQL query instead of 2×N individual queries.

    BEFORE (N+1 pattern):
      For 60 students → 120 DB round-trips per analytics request.
      Each call to calculate_student_analytics() issued:
        1. SELECT student WHERE id=X
        2. SELECT attendance GROUP BY subject WHERE student_id=X

    AFTER (single aggregation):
      One GROUP BY (student_id, subject) for all students at once.
      60 rows fetched → pivoted in Python → same result, 1 query.

    Returns: dict mapping student_id → StudentAttendanceAnalytics
    """
    if not students:
        return {}

    from collections import defaultdict

    student_ids = [s.id for s in students]

    rows = (
        db.query(
            Attendance.student_id,
            Attendance.subject,
            func.count(Attendance.id).label("total"),
            func.sum(
                case([(Attendance.status.in_(["present", "late"]), 1)], else_=0)
            ).label("present_count"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.absent, 1)], else_=0)
            ).label("absent_count"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.late, 1)], else_=0)
            ).label("late_count"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.excused, 1)], else_=0)
            ).label("excused_count"),
        )
        .filter(Attendance.student_id.in_(student_ids))
        .group_by(Attendance.student_id, Attendance.subject)
        .all()
    )

    per_student: dict = defaultdict(list)
    for row in rows:
        per_student[row.student_id].append(row)

    result = {}
    for student in students:
        student_rows = per_student.get(student.id, [])
        subject_breakdown = []
        overall_total = 0
        overall_present = 0

        for row in student_rows:
            total = row.total or 0
            present = int(row.present_count or 0)
            pct = round((present / total * 100), 2) if total > 0 else 0.0

            subject_breakdown.append(SubjectBreakdown(
                subject=row.subject,
                total_classes=total,
                present_count=present,
                absent_count=int(row.absent_count or 0),
                late_count=int(row.late_count or 0),
                excused_count=int(row.excused_count or 0),
                percentage=pct,
                is_below_threshold=pct < ATTENDANCE_THRESHOLD,
            ))
            overall_total += total
            overall_present += present

        overall_pct = round(
            (overall_present / overall_total * 100), 2
        ) if overall_total > 0 else 0.0

        result[student.id] = StudentAttendanceAnalytics(
            student_id=student.id,
            roll_number=student.roll_number,
            full_name=student.user.full_name if student.user else "",
            overall_total=overall_total,
            overall_present=overall_present,
            overall_percentage=overall_pct,
            is_low_attendance=overall_pct < ATTENDANCE_THRESHOLD,
            subject_breakdown=sorted(subject_breakdown, key=lambda x: x.subject),
        )

    return result


# ---------------------------------------------------------------
# GET LOW ATTENDANCE STUDENTS — Alert list
# ---------------------------------------------------------------
def get_low_attendance_students(
    db: Session,
    section_id: int,
    threshold: float = ATTENDANCE_THRESHOLD,
) -> list[LowAttendanceAlert]:
    """
    Returns students whose overall attendance is below the threshold.

    CLASSES NEEDED FORMULA:
    If a student has attended P out of T classes, and needs 75%:
    (P + x) / (T + x) = 0.75
    Solving: x = (0.75T - P) / 0.25 = 3T - 4P

    Uses _bulk_student_analytics() — 1 query for all students.
    """
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    students = (
        db.query(Student)
        .join(User, Student.user_id == User.id)
        .options(joinedload(Student.user))
        .filter(Student.section_id == section_id, User.is_active == True)
        .all()
    )

    analytics_map = _bulk_student_analytics(db, students)

    alerts = []
    for student in students:
        analytics = analytics_map.get(student.id)
        if not analytics or analytics.overall_percentage >= threshold:
            continue
        t = analytics.overall_total
        p = analytics.overall_present
        needed = max(0, int(
            (threshold / 100 * t - p) / (1 - threshold / 100) + 1
        )) if t > 0 else 0

        alerts.append(LowAttendanceAlert(
            student_id=student.id,
            roll_number=student.roll_number,
            full_name=student.user.full_name if student.user else "",
            overall_percentage=analytics.overall_percentage,
            classes_needed_to_reach_75=needed,
        ))

    return sorted(alerts, key=lambda x: x.overall_percentage)


# ---------------------------------------------------------------
# SECTION ANALYTICS — Overview of entire section
# ---------------------------------------------------------------
def calculate_section_analytics(
    db: Session,
    section_id: int,
) -> SectionAttendanceAnalytics:
    """
    Aggregates attendance analytics across all students in a section.
    Uses _bulk_student_analytics() — 1 query replaces N per-student queries.
    """
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    students = (
        db.query(Student)
        .join(User, Student.user_id == User.id)
        .options(joinedload(Student.user))
        .filter(Student.section_id == section_id, User.is_active == True)
        .all()
    )

    analytics_map = _bulk_student_analytics(db, students)
    summaries = list(analytics_map.values())

    low_count = sum(1 for s in summaries if s.is_low_attendance)
    avg_pct = (
        round(sum(s.overall_percentage for s in summaries) / len(summaries), 2)
        if summaries else 0.0
    )

    return SectionAttendanceAnalytics(
        section_id=section.id,
        section_name=section.name,
        total_students=len(students),
        low_attendance_count=low_count,
        average_attendance_percentage=avg_pct,
        student_summaries=summaries,
    )


# ---------------------------------------------------------------
# GET STUDENTS FOR ATTENDANCE MARKING — Roster with full names
# ---------------------------------------------------------------
def get_students_for_attendance(
    db: Session,
    section_id: int,
) -> list[AttendanceStudentBrief]:
    """
    Returns the active student roster for a section, including full names.
    Used by the mark-attendance form to build the student list UI.

    Sorted by roll_number for a consistent, predictable order on screen.
    """
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found.",
        )

    students = (
        db.query(Student)
        .join(User, Student.user_id == User.id)
        .filter(Student.section_id == section_id, User.is_active == True)
        .order_by(Student.roll_number)
        .all()
    )

    return [
        AttendanceStudentBrief(
            id=s.id,
            roll_number=s.roll_number,
            full_name=s.user.full_name if s.user else "",
            semester=s.semester,
        )
        for s in students
    ]


# ---------------------------------------------------------------
# GET FACULTY ATTENDANCE HISTORY — Sessions grouped by metadata
# ---------------------------------------------------------------
def get_faculty_attendance_history(
    db: Session,
    faculty_user_id: int,
) -> list[AttendanceSessionSummary]:
    """
    Returns all unique attendance sessions marked by this faculty,
    grouped by (section_id, subject, attendance_date, period_number).

    Uses SQL GROUP BY + CASE aggregation — one query for all sessions.
    Returned newest-first so the faculty sees recent activity at the top.
    """
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found.",
        )

    rows = (
        db.query(
            Attendance.section_id,
            Section.name.label("section_name"),
            Attendance.subject,
            Attendance.attendance_date,
            Attendance.period_number,
            func.count(Attendance.id).label("total"),
            func.sum(
                case(
                    [(Attendance.status.in_(["present", "late"]), 1)],
                    else_=0,
                )
            ).label("present"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.absent, 1)], else_=0)
            ).label("absent"),
            func.sum(
                case([(Attendance.status == AttendanceStatus.late, 1)], else_=0)
            ).label("late"),
        )
        .join(Section, Attendance.section_id == Section.id)
        .filter(Attendance.faculty_id == faculty.id)
        .group_by(
            Attendance.section_id,
            Section.name,
            Attendance.subject,
            Attendance.attendance_date,
            Attendance.period_number,
        )
        .order_by(Attendance.attendance_date.desc(), Attendance.period_number)
        .all()
    )

    return [
        AttendanceSessionSummary(
            section_id=row.section_id,
            section_name=row.section_name,
            subject=row.subject,
            attendance_date=row.attendance_date,
            period_number=row.period_number,
            total=row.total or 0,
            present=int(row.present or 0),
            absent=int(row.absent or 0),
            late=int(row.late or 0),
        )
        for row in rows
    ]


# ---------------------------------------------------------------
# UPDATE ATTENDANCE RECORD — Correct a single student's status
# ---------------------------------------------------------------
def update_attendance_record(
    db: Session,
    record_id: int,
    faculty_user_id: int,
    data: UpdateAttendanceEntry,
) -> Attendance:
    """
    Allows faculty to correct a previously-marked attendance record.

    PERMISSION RULES:
      → Faculty can only edit records they originally marked (faculty_id match)
        OR records for sections in their own department.
      → Admins bypass these checks in a separate admin endpoint.

    IMMUTABLE FIELDS:
      → section_id, student_id, attendance_date, subject, period_number
      → Only status and remarks can be changed.

    AUDIT TRAIL:
      → updated_at is automatically set by SQLAlchemy (onupdate=func.now())
      → The original faculty_id is preserved — who marked vs. who last edited
        is tracked via the updated_at timestamp.
    """
    record = db.query(Attendance).filter(Attendance.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record ID {record_id} not found.",
        )

    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found.",
        )

    # PERMISSION: must have originally marked it OR be same dept as section
    section = db.query(Section).filter(Section.id == record.section_id).first()
    owns_record   = record.faculty_id == faculty.id
    same_dept     = section and section.department == faculty.department

    if not (owns_record or same_dept):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this attendance record.",
        )

    record.status  = data.status
    record.remarks = data.remarks
    db.commit()
    db.refresh(record)
    return record
