# =============================================================
# routes/admin.py — Admin Dashboard & Management Endpoints
# =============================================================
# ROUTE MAP:
#   GET   /admin/dashboard                  Institution snapshot
#   GET   /admin/users                      List all users
#   GET   /admin/users/{id}                 Single user detail
#   PATCH /admin/users/{id}/status          Activate/deactivate user
#   GET   /admin/analytics                  Cross-module analytics
# =============================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.database.connection import get_db
from backend.auth.dependencies import get_current_admin
from backend.models.user import User, UserRole
from backend.schemas.admin import (
    DashboardResponse,
    UserAdminView,
    UserStatusUpdate,
    InstitutionAnalyticsResponse,
    SystemHealthResponse,
    AnnouncementRequest,
    AnnouncementResponse,
    TrendsResponse,
    ActivityItem,
    CreateUserRequest,
    UpdateUserRequest,
    ResetPasswordRequest,
    DeleteUserResponse,
    DepartmentsDataResponse,
)
from backend.services.admin_service import (
    get_dashboard,
    list_all_users,
    set_user_active_status,
    get_institution_analytics,
    get_system_health,
    get_analytics_trends,
    create_announcement,
    get_activity_feed,
    admin_create_user,
    admin_update_user,
    admin_reset_password,
    admin_delete_user,
    get_departments_data,
)

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# ---------------------------------------------------------------
# GET /admin/dashboard — Full institution snapshot (Admin only)
# ---------------------------------------------------------------
@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Institution-wide dashboard snapshot (Admin only)",
)
def dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return get_dashboard(db)


# ---------------------------------------------------------------
# GET /admin/users — List all users with optional filters
# ---------------------------------------------------------------
@router.get(
    "/users",
    response_model=List[UserAdminView],
    summary="List all system users (Admin only)",
)
def list_users(
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return list_all_users(db, role, is_active, skip, limit)


# ---------------------------------------------------------------
# GET /admin/users/{id} — Single user detail
# ---------------------------------------------------------------
@router.get(
    "/users/{user_id}",
    response_model=UserAdminView,
    summary="Get a specific user's account details (Admin only)",
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    from fastapi import HTTPException
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


# ---------------------------------------------------------------
# PATCH /admin/users/{id}/status — Activate or deactivate
# ---------------------------------------------------------------
@router.patch(
    "/users/{user_id}/status",
    response_model=UserAdminView,
    summary="Activate or deactivate a user account (Admin only)",
)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return set_user_active_status(db, user_id, data.is_active)


# ---------------------------------------------------------------
# GET /admin/analytics — Cross-module institution analytics
# ---------------------------------------------------------------
@router.get(
    "/analytics",
    response_model=InstitutionAnalyticsResponse,
    summary="Cross-module institution analytics (Admin only)",
)
def analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return get_institution_analytics(db)


# ---------------------------------------------------------------
# GET /admin/system-health — Live infrastructure metrics
# ---------------------------------------------------------------
@router.get(
    "/system-health",
    response_model=SystemHealthResponse,
    summary="Live system health metrics (Admin only)",
)
def system_health(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return get_system_health(db)


# ---------------------------------------------------------------
# GET /admin/analytics/trends — Last 6 months activity
# ---------------------------------------------------------------
@router.get(
    "/analytics/trends",
    response_model=TrendsResponse,
    summary="Monthly trends for last 6 months (Admin only)",
)
def analytics_trends(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return get_analytics_trends(db)


# ---------------------------------------------------------------
# GET /admin/activity — Recent system-generated events
# ---------------------------------------------------------------
@router.get(
    "/activity",
    response_model=List[ActivityItem],
    summary="Recent system activity feed (Admin only)",
)
def activity_feed(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return get_activity_feed(db, limit)


# ---------------------------------------------------------------
# POST /admin/announcements — Targeted broadcast notification
# ---------------------------------------------------------------
@router.post(
    "/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send announcement to all/students/faculty (Admin only)",
)
def send_announcement(
    data: AnnouncementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return create_announcement(db, current_user.id, data)


# ---------------------------------------------------------------
# POST /admin/users — Create a new user with profile
# ---------------------------------------------------------------
@router.post(
    "/users",
    response_model=UserAdminView,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account (Admin only)",
)
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return admin_create_user(db, data)


# ---------------------------------------------------------------
# PUT /admin/users/{id} — Update user name/email
# ---------------------------------------------------------------
@router.put(
    "/users/{user_id}",
    response_model=UserAdminView,
    summary="Update a user's name or email (Admin only)",
)
def update_user(
    user_id: int,
    data: UpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return admin_update_user(db, user_id, data, current_user.id)


# ---------------------------------------------------------------
# POST /admin/users/{id}/reset-password — Admin password reset
# ---------------------------------------------------------------
@router.post(
    "/users/{user_id}/reset-password",
    response_model=UserAdminView,
    summary="Reset a user's password (Admin only)",
)
def reset_password(
    user_id: int,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return admin_reset_password(db, user_id, data.new_password)


# ---------------------------------------------------------------
# DELETE /admin/users/{id} — Soft-delete (deactivate) a user
# ---------------------------------------------------------------
@router.delete(
    "/users/{user_id}",
    response_model=DeleteUserResponse,
    summary="Soft-delete (deactivate) a user (Admin only)",
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return admin_delete_user(db, user_id, current_user.id)


# ---------------------------------------------------------------
# GET /admin/departments — Department + Designation enum lists
# ---------------------------------------------------------------
@router.get(
    "/departments",
    response_model=DepartmentsDataResponse,
    summary="List departments and designations for dropdown forms (Admin only)",
)
def list_departments(
    _: User = Depends(get_current_admin),
):
    return get_departments_data()
