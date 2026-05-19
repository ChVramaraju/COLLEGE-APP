# =============================================================
# routes/notification.py — Notification API Endpoints
# =============================================================
# ROUTE MAP:
#   POST /notifications/send              [admin/faculty] → one user
#   POST /notifications/section           [admin/faculty] → section students
#   POST /notifications/broadcast         [admin only]    → all users
#   GET  /notifications/                  [all]           → own inbox
#   GET  /notifications/unread-count      [all]           → badge count
#   PATCH /notifications/{id}/read        [all]           → mark one read
#   PATCH /notifications/read-all         [all]           → mark all read
#   DELETE /notifications/{id}            [all]           → soft dismiss
#   GET  /notifications/analytics         [admin]         → system stats
# =============================================================

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from typing import Optional
import json

from backend.database.connection import get_db, SessionLocal
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.auth.jwt import verify_access_token
from backend.models.user import User, UserRole
from backend.services.websocket_manager import ws_manager
from backend.schemas.notification import (
    NotificationSendRequest,
    SectionNotificationRequest,
    BroadcastRequest,
    NotificationResponse,
    NotificationListResponse,
    NotificationAnalytics,
)
from backend.services.notification_service import (
    create_notification,
    create_section_notification,
    create_broadcast_notification,
    get_user_notifications,
    get_unread_count,
    mark_notification_read,
    mark_all_read,
    soft_delete_notification,
    get_notification_analytics,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ---------------------------------------------------------------
# POST /notifications/send — Direct notification to one user
# ---------------------------------------------------------------
@router.post(
    "/send",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a direct notification to a specific user (Admin or Faculty)",
)
def send_direct_notification(
    data: NotificationSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty required.")
    notif = create_notification(db, current_user.id, data)
    return NotificationResponse(
        id=notif.id, title=notif.title, message=notif.message,
        notification_type=notif.notification_type,
        is_broadcast=notif.is_broadcast, is_read=notif.is_read,
        read_at=notif.read_at, created_at=notif.created_at,
        sender_name=current_user.full_name,
    )


# ---------------------------------------------------------------
# POST /notifications/section — Section-wide broadcast
# ---------------------------------------------------------------
@router.post(
    "/section",
    status_code=status.HTTP_201_CREATED,
    summary="Send a notification to all students in a section (Admin or Faculty)",
)
def send_section_notification(
    data: SectionNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Admin or Faculty required.")
    return create_section_notification(db, current_user.id, data)


# ---------------------------------------------------------------
# POST /notifications/broadcast — Global announcement (Admin only)
# ---------------------------------------------------------------
@router.post(
    "/broadcast",
    status_code=status.HTTP_201_CREATED,
    summary="Broadcast a notification to all users in the system (Admin only)",
)
def send_broadcast(
    data: BroadcastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return create_broadcast_notification(db, current_user.id, data)


# ---------------------------------------------------------------
# GET /notifications/unread-count — Badge count
# MUST be before /{id} to avoid route collision
# ---------------------------------------------------------------
@router.get(
    "/unread-count",
    summary="Get the unread notification count for the current user",
)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_unread_count(db, current_user.id)


# ---------------------------------------------------------------
# GET /notifications/analytics — Admin analytics
# MUST be before /{id}
# ---------------------------------------------------------------
@router.get(
    "/analytics",
    response_model=NotificationAnalytics,
    summary="Get system-wide notification analytics (Admin only)",
)
def notification_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return get_notification_analytics(db)


# ---------------------------------------------------------------
# PATCH /notifications/read-all — Mark ALL as read
# MUST be before /{id}
# ---------------------------------------------------------------
@router.patch(
    "/read-all",
    summary="Mark all notifications as read for the current user",
)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return mark_all_read(db, current_user.id)


# ---------------------------------------------------------------
# GET /notifications/ — Own inbox (paginated)
# ---------------------------------------------------------------
@router.get(
    "/",
    response_model=NotificationListResponse,
    summary="Get the current user's notification inbox",
)
def get_inbox(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_notifications(db, current_user.id, skip, limit, unread_only)


# ---------------------------------------------------------------
# PATCH /notifications/{id}/read — Mark one as read
# ---------------------------------------------------------------
@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a specific notification as read",
)
def mark_one_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = mark_notification_read(db, current_user.id, notification_id)
    sender_name = notif.sender.full_name if notif.sender_user_id and notif.sender else None
    return NotificationResponse(
        id=notif.id, title=notif.title, message=notif.message,
        notification_type=notif.notification_type,
        is_broadcast=notif.is_broadcast, is_read=notif.is_read,
        read_at=notif.read_at, created_at=notif.created_at,
        sender_name=sender_name,
    )


# ---------------------------------------------------------------
# DELETE /notifications/{id} — Soft dismiss
# ---------------------------------------------------------------
@router.delete(
    "/{notification_id}",
    summary="Dismiss (soft-delete) a notification from your inbox",
)
def dismiss_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return soft_delete_notification(db, current_user.id, notification_id)


# ---------------------------------------------------------------
# WS /notifications/ws — Real-time notification stream
# ---------------------------------------------------------------
# Authentication: JWT passed as ?token= query parameter.
# Browser WebSocket API cannot set custom headers, so the token
# must travel as a URL query param for the initial handshake.
#
# CONNECTION LIFECYCLE:
#   1. Client connects with ?token=<jwt>
#   2. Server validates JWT → closes 4001 if invalid
#   3. Server sends {"type": "connected"}
#   4. Client listens for {"type": "notification", "data": {...}}
#   5. Client sends {"type": "ping"} every ~25s for keep-alive
#   6. Server replies {"type": "pong"}
#   7. On client disconnect → ws_manager removes connection
#
# PUSH SOURCE:
#   notification_service.py calls ws_manager.push_sync() after
#   creating each notification row, delivering it instantly to
#   any open tab for that recipient.
# ---------------------------------------------------------------
@router.websocket("/ws")
async def notifications_websocket(
    websocket: WebSocket,
    token: str = Query(...),
):
    # ── 1. JWT validation ────────────────────────────────────────
    try:
        payload = verify_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=4001)
        return

    # ── 2. User existence + active check ────────────────────────
    db = SessionLocal()
    try:
        user = db.query(User).filter(
            User.id == user_id,
            User.is_active == True,
        ).first()
        if not user:
            await websocket.close(code=4001)
            return
    finally:
        db.close()

    # ── 3. Register connection ───────────────────────────────────
    await ws_manager.connect(user_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "user_id": user_id})

        # ── 4. Message loop ──────────────────────────────────────
        while True:
            try:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                    if isinstance(msg, dict) and msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except (json.JSONDecodeError, AttributeError):
                    pass  # Ignore malformed frames
            except WebSocketDisconnect:
                break
            except Exception:
                break

    finally:
        # ── 5. Cleanup on any exit path ──────────────────────────
        ws_manager.disconnect(user_id, websocket)
