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
)
from backend.services.admin_service import (
    get_dashboard,
    list_all_users,
    set_user_active_status,
    get_institution_analytics,
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
