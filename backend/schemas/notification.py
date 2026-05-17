# =============================================================
# schemas/notification.py — Notification Request/Response Contracts
# =============================================================

from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

from backend.models.enums import NotificationType


# ---------------------------------------------------------------
# REQUEST SCHEMAS — What callers send to create notifications
# ---------------------------------------------------------------

class NotificationSendRequest(BaseModel):
    """
    Direct notification to a specific user.
    Faculty → one student, Admin → any user.
    """
    recipient_user_id: int
    title: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=1)
    notification_type: NotificationType = NotificationType.general


class SectionNotificationRequest(BaseModel):
    """
    Broadcast to all students in a specific section.
    Faculty or Admin sends this for section-level announcements.
    e.g., "Lab session rescheduled to Friday"
    """
    section_id: int
    title: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=1)
    notification_type: NotificationType = NotificationType.announcement


class BroadcastRequest(BaseModel):
    """
    Global announcement — sent to ALL active users.
    Admin only. Used for institution-wide events:
    "College closed on 15th May for Republic Day"
    """
    title: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=1)
    notification_type: NotificationType = NotificationType.announcement


# ---------------------------------------------------------------
# RESPONSE SCHEMAS — What the API returns
# ---------------------------------------------------------------

class SenderBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


class NotificationResponse(BaseModel):
    """
    Single notification as seen by the recipient.
    Note: sender info is included for display ("From: Dr. Ananya Sharma")
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    notification_type: NotificationType
    is_broadcast: bool
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    sender_name: Optional[str] = None    # Resolved in route/service


class NotificationListResponse(BaseModel):
    """Paginated notification inbox."""
    total: int
    unread_count: int
    notifications: List[NotificationResponse]


class NotificationAnalytics(BaseModel):
    """Admin-level notification activity summary."""
    total_sent: int
    total_read: int
    total_unread: int
    broadcast_count: int
    by_type: dict          # {"announcement": 5, "test_result": 12, ...}
    read_rate_percentage: float
