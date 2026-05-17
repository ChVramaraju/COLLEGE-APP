# =============================================================
# services/notification_service.py — Notification Business Logic
# =============================================================
# THREE CATEGORIES OF FUNCTIONS:
#
#   1. CREATION functions — insert notification rows
#      (direct, section broadcast, global broadcast, system-generated)
#
#   2. RETRIEVAL functions — query inbox, unread count
#
#   3. STATE functions — mark read, mark all read, soft delete
#
# IMPORTANT — create_system_notification():
#   This function is designed to be called FROM OTHER SERVICES.
#   It has no sender_user_id (system = no human sender).
#   It deliberately catches all exceptions and never propagates them.
#   WHY? A test result notification failing must NOT roll back
#   the test submission itself. Notifications are non-critical.
#   Core operations must always succeed regardless.
#   This is called "best-effort delivery" in distributed systems.
# =============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from datetime import datetime, timezone
from typing import Optional

from backend.models.notification import Notification
from backend.models.user import User, UserRole
from backend.models.student import Student
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.enums import NotificationType
from backend.schemas.notification import (
    NotificationSendRequest,
    SectionNotificationRequest,
    BroadcastRequest,
    NotificationResponse,
    NotificationListResponse,
    NotificationAnalytics,
)


# ---------------------------------------------------------------
# CREATE — Direct notification to one user
# ---------------------------------------------------------------
def create_notification(
    db: Session,
    sender_user_id: int,
    data: NotificationSendRequest,
) -> Notification:
    """
    Sends a notification from one user to another.

    PERMISSION LOGIC:
      Faculty can notify any user (they might need to ping specific students).
      Admin can notify any user.
      Students cannot send notifications (they use other channels).
    """
    recipient = db.query(User).filter(
        User.id == data.recipient_user_id,
        User.is_active == True
    ).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipient user ID {data.recipient_user_id} not found."
        )

    notif = Notification(
        title=data.title,
        message=data.message,
        notification_type=data.notification_type,
        sender_user_id=sender_user_id,
        recipient_user_id=data.recipient_user_id,
        is_broadcast=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


# ---------------------------------------------------------------
# CREATE — Section broadcast
# ---------------------------------------------------------------
def create_section_notification(
    db: Session,
    sender_user_id: int,
    data: SectionNotificationRequest,
) -> dict:
    """
    Sends a notification to ALL active students in a section.

    PERMISSION: Faculty must belong to the same department as the section.
    Admin can broadcast to any section.

    BULK INSERT:
    We use db.bulk_save_objects() for efficiency.
    For a section of 60 students, this is ONE SQL INSERT with 60 rows
    vs 60 individual INSERT statements.

    PERFORMANCE NOTE:
    bulk_save_objects bypasses ORM session tracking.
    This is intentional — we don't need to track 60 individual
    Notification objects. We only need them persisted.
    """
    # Validate section
    section = db.query(Section).filter(Section.id == data.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail=f"Section {data.section_id} not found.")

    # Faculty permission check
    sender = db.query(User).filter(User.id == sender_user_id).first()
    if sender and sender.role == UserRole.faculty:
        faculty = db.query(Faculty).filter(Faculty.user_id == sender_user_id).first()
        if faculty and faculty.department != section.department:
            raise HTTPException(
                status_code=403,
                detail=f"Faculty from '{faculty.department.value}' cannot notify '{section.department.value}' section."
            )

    # Get all active students in section
    students = (
        db.query(Student)
        .join(User, Student.user_id == User.id)
        .filter(Student.section_id == data.section_id, User.is_active == True)
        .all()
    )

    if not students:
        return {"message": "No active students in this section.", "recipients": 0}

    notifications = [
        Notification(
            title=data.title,
            message=data.message,
            notification_type=data.notification_type,
            sender_user_id=sender_user_id,
            recipient_user_id=student.user_id,
            section_id=data.section_id,
            is_broadcast=True,
        )
        for student in students
    ]

    db.bulk_save_objects(notifications)
    db.commit()

    return {
        "message": f"Notification sent to {len(notifications)} students in section.",
        "recipients": len(notifications),
        "section_id": data.section_id,
    }


# ---------------------------------------------------------------
# CREATE — Global broadcast (Admin only)
# ---------------------------------------------------------------
def create_broadcast_notification(
    db: Session,
    sender_user_id: int,
    data: BroadcastRequest,
) -> dict:
    """
    Broadcasts a notification to ALL active users in the system.
    Admin-only operation.

    WARNING: This creates one DB row per active user.
    For a college with 1,000 users, this is 1,000 INSERT rows.
    That's fine for our scale. For WhatsApp-scale, you'd use
    a queue (Kafka/RabbitMQ) + async workers to fan out.
    """
    all_users = db.query(User).filter(User.is_active == True).all()

    notifications = [
        Notification(
            title=data.title,
            message=data.message,
            notification_type=data.notification_type,
            sender_user_id=sender_user_id,
            recipient_user_id=user.id,
            is_broadcast=True,
        )
        for user in all_users
    ]

    db.bulk_save_objects(notifications)
    db.commit()

    return {
        "message": f"Broadcast sent to {len(notifications)} users.",
        "recipients": len(notifications),
    }


# ---------------------------------------------------------------
# CREATE — System-generated (no human sender)
# ---------------------------------------------------------------
def create_system_notification(
    db: Session,
    recipient_user_id: int,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.general,
    section_id: Optional[int] = None,
) -> None:
    """
    Creates a notification from the SYSTEM (no human sender).
    Called internally by other services:
      → test_service.submit_test() → "Your result: 80%"
      → attendance_service.mark_attendance_bulk() → "Low attendance warning"
      → notes_service.upload_note() → "New notes available"

    DELIBERATELY CATCHES ALL EXCEPTIONS:
    This function must NEVER cause the calling operation to fail.
    If the notification INSERT fails, the test submission/attendance
    marking still succeeds. Notifications are best-effort.

    This is a key production pattern:
    "Non-critical side effects must never sabotage critical operations."
    """
    try:
        notif = Notification(
            title=title,
            message=message,
            notification_type=notification_type,
            sender_user_id=None,    # System has no user ID
            recipient_user_id=recipient_user_id,
            section_id=section_id,
            is_broadcast=False,
        )
        db.add(notif)
        db.flush()    # flush to DB within current transaction
        # Note: commit is caller's responsibility
    except Exception:
        pass   # Never propagate — notification failure is non-critical


# ---------------------------------------------------------------
# READ — Get paginated inbox
# ---------------------------------------------------------------
def get_user_notifications(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
) -> NotificationListResponse:
    """
    Returns paginated notification inbox for a user.

    FILTERS:
      unread_only=True → only show unread (for notification bell badge)
      unread_only=False → full inbox (for notifications page)

    The compound index ix_notif_recipient_unread makes this query
    very fast even with millions of rows.
    """
    query = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.is_deleted == False,
    )

    if unread_only:
        query = query.filter(Notification.is_read == False)

    total = query.count()
    unread_count = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.is_read == False,
        Notification.is_deleted == False,
    ).count()

    notifications = (
        query
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Resolve sender names
    notif_responses = []
    for n in notifications:
        sender_name = None
        if n.sender_user_id and n.sender:
            sender_name = n.sender.full_name

        notif_responses.append(NotificationResponse(
            id=n.id,
            title=n.title,
            message=n.message,
            notification_type=n.notification_type,
            is_broadcast=n.is_broadcast,
            is_read=n.is_read,
            read_at=n.read_at,
            created_at=n.created_at,
            sender_name=sender_name,
        ))

    return NotificationListResponse(
        total=total,
        unread_count=unread_count,
        notifications=notif_responses,
    )


# ---------------------------------------------------------------
# READ — Unread count only (for notification bell)
# ---------------------------------------------------------------
def get_unread_count(db: Session, user_id: int) -> dict:
    """
    Lightweight query for the notification bell badge.
    Returns ONLY the unread count — no notification content.
    Why? The bell badge just needs a number.
    Loading full notifications on every page load is wasteful.
    """
    count = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.is_read == False,
        Notification.is_deleted == False,
    ).count()
    return {"unread_count": count}


# ---------------------------------------------------------------
# STATE — Mark one notification as read
# ---------------------------------------------------------------
def mark_notification_read(
    db: Session,
    user_id: int,
    notification_id: int,
) -> Notification:
    """
    Marks a specific notification as read.
    Also records the exact read_at timestamp for analytics.

    OWNERSHIP CHECK: User can only mark THEIR OWN notifications.
    Without this, User A could mark User B's notifications as read,
    causing User B to miss important alerts.
    """
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_user_id == user_id,
        Notification.is_deleted == False,
    ).first()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)

    return notif


# ---------------------------------------------------------------
# STATE — Mark ALL notifications as read
# ---------------------------------------------------------------
def mark_all_read(db: Session, user_id: int) -> dict:
    """
    Bulk UPDATE — marks ALL unread notifications as read.
    Called when user clicks "Mark all as read" in their inbox.

    Uses SQLAlchemy's bulk update (UPDATE WHERE) instead of
    loading all rows into memory. Much faster for 100+ notifications.
    """
    now = datetime.now(timezone.utc)
    updated = (
        db.query(Notification)
        .filter(
            Notification.recipient_user_id == user_id,
            Notification.is_read == False,
            Notification.is_deleted == False,
        )
        .update({"is_read": True, "read_at": now}, synchronize_session=False)
    )
    db.commit()
    return {"message": f"Marked {updated} notifications as read.", "updated_count": updated}


# ---------------------------------------------------------------
# STATE — Soft delete a notification
# ---------------------------------------------------------------
def soft_delete_notification(
    db: Session,
    user_id: int,
    notification_id: int,
) -> dict:
    """
    User removes a notification from their inbox.
    Row stays in DB (audit trail). is_deleted = True hides it from queries.
    """
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_user_id == user_id,
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_deleted = True
    db.commit()
    return {"message": "Notification dismissed.", "notification_id": notification_id}


# ---------------------------------------------------------------
# ANALYTICS — Admin view of notification activity
# ---------------------------------------------------------------
def get_notification_analytics(db: Session) -> NotificationAnalytics:
    """
    System-wide notification statistics for admin dashboard.
    Uses SQL aggregations — no Python-level loops.
    """
    total_sent   = db.query(Notification).count()
    total_read   = db.query(Notification).filter(Notification.is_read == True).count()
    total_unread = db.query(Notification).filter(
        Notification.is_read == False, Notification.is_deleted == False
    ).count()
    broadcast_count = db.query(Notification).filter(Notification.is_broadcast == True).count()

    read_rate = round(total_read / total_sent * 100, 2) if total_sent > 0 else 0.0

    # Per-type breakdown using GROUP BY
    type_rows = (
        db.query(Notification.notification_type, func.count(Notification.id))
        .group_by(Notification.notification_type)
        .all()
    )
    by_type = {row[0].value: row[1] for row in type_rows}

    return NotificationAnalytics(
        total_sent=total_sent,
        total_read=total_read,
        total_unread=total_unread,
        broadcast_count=broadcast_count,
        by_type=by_type,
        read_rate_percentage=read_rate,
    )
