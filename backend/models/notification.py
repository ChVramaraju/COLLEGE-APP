# =============================================================
# models/notification.py — Notification Persistence Layer
# =============================================================
# DESIGN: Fan-out on Write
#   One row per (notification, recipient) pair.
#   This means a section broadcast of 60 students = 60 rows.
#   Each row tracks its own is_read state independently.
#
# WHY STORE NOTIFICATIONS IN DB (not just push to websocket)?
#   In-app notifications must survive:
#     → User was offline when notification was created
#     → User closed the app mid-session
#     → User wants to re-read old notifications
#   Without DB persistence, notifications are lost forever.
#
# THE TWO FOREIGN KEYS ON users TABLE:
#   sender_user_id → who sent it (nullable for system-generated)
#   recipient_user_id → who receives it (always set)
#
#   SQLAlchemy requires explicit foreign_keys= when a model
#   has two FKs pointing to the same table. Without it,
#   SQLAlchemy can't determine which FK maps to which relationship.
#
# SOFT DELETE via is_deleted:
#   Users "delete" notifications from their inbox.
#   The row stays in the DB for audit purposes.
#   is_read + is_deleted = full lifecycle tracking.
# =============================================================

from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    DateTime, ForeignKey, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.connection import Base
from backend.models.enums import NotificationType


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # -----------------------------------------------------------------
    # CONTENT
    # -----------------------------------------------------------------
    title   = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(
        SAEnum(NotificationType),
        nullable=False,
        default=NotificationType.general
    )

    # -----------------------------------------------------------------
    # SENDER — Nullable because system notifications have no human sender
    # -----------------------------------------------------------------
    # System notifications: attendance alerts, test results, notes alerts
    # These are created by the backend itself, not by any user.
    # sender_user_id = NULL means "this is a system-generated event".
    # -----------------------------------------------------------------
    sender_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # -----------------------------------------------------------------
    # RECIPIENT — Always set. Every notification row belongs to one user.
    # -----------------------------------------------------------------
    recipient_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,    # THE MOST IMPORTANT INDEX: "get MY notifications"
    )

    # -----------------------------------------------------------------
    # CONTEXT — Optional metadata for grouping/linking
    # -----------------------------------------------------------------
    # section_id: Set for section-wide broadcasts.
    # Allows "show all section A announcements" queries.
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="SET NULL"),
        nullable=True,
    )

    # is_broadcast: True if this was sent to multiple users at once.
    # Useful for analytics: "how many broadcast notifications this month?"
    is_broadcast = Column(Boolean, default=False, nullable=False)

    # -----------------------------------------------------------------
    # LIFECYCLE STATE
    # -----------------------------------------------------------------
    # is_read: Has the recipient seen this notification?
    # Indexed: most queries filter "WHERE is_read = FALSE"
    is_read    = Column(Boolean, default=False, nullable=False, index=True)
    read_at    = Column(DateTime(timezone=True), nullable=True)

    # is_deleted: Soft delete — user dismissed it from their inbox.
    # Row stays in DB for audit trail.
    is_deleted = Column(Boolean, default=False, nullable=False)

    # -----------------------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------------------
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,    # Date-range queries: "notifications from this week"
    )

    # -----------------------------------------------------------------
    # TABLE INDEXES
    # -----------------------------------------------------------------
    __table_args__ = (
        # THE PRIMARY QUERY PATTERN: recipient's unread notifications
        # "SELECT * FROM notifications WHERE recipient_user_id=? AND is_read=FALSE"
        # This compound index covers BOTH filters in one scan.
        Index("ix_notif_recipient_unread", "recipient_user_id", "is_read"),
    )

    # -----------------------------------------------------------------
    # ORM RELATIONSHIPS
    # -----------------------------------------------------------------
    # Explicit foreign_keys= required when two FKs point to same table.
    # Without this: SQLAlchemy raises AmbiguousForeignKeysError.
    sender    = relationship("User", foreign_keys=[sender_user_id])
    recipient = relationship("User", foreign_keys=[recipient_user_id])

    def __repr__(self):
        return (
            f"<Notification id={self.id} type={self.notification_type} "
            f"to={self.recipient_user_id} read={self.is_read}>"
        )
