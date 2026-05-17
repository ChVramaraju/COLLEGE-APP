# =============================================================
# routes/auth.py — Authentication API Endpoints
# =============================================================
# Routes are intentionally THIN.
# They only:
#   1. Receive the request
#   2. Call the service
#   3. Return the response
#
# NO business logic here — it all lives in auth_service.py
# This separation makes routes easy to read and services easy to test.
# =============================================================

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse
from backend.services.auth_service import authenticate_user, create_user, get_user_by_id
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.models.user import User
from backend.utils.limiter import limiter
from backend.config.settings import settings

# APIRouter is like a "mini FastAPI app" for a specific feature.
# All routes here will be prefixed with /auth (set in main.py)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Universal login endpoint for ALL user types.

    Works for:
        Student: username = roll number
        Faculty: username = employee ID
        Admin:   username = admin ID

    Returns JWT token + role on success.
    React uses the role to redirect to the correct dashboard.

    RATE LIMITED: 5 attempts per minute per IP address.
    Exceeding the limit returns HTTP 429 Too Many Requests.
    This prevents brute-force and credential stuffing attacks.

    Request body:
        { "username": "21CSE001", "password": "mypassword" }

    Response:
        { "access_token": "eyJ...", "token_type": "bearer", "role": "student" }
    """
    return authenticate_user(db, login_data)


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the logged-in user's profile.
    Requires a valid JWT in the Authorization header.

    Used by React to:
        → show username on dashboard
        → verify token is still valid on page load
        → determine which features to show

    Request header:
        Authorization: Bearer eyJ...
    """
    return current_user


@router.post("/register", response_model=UserResponse)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin)   # Only admins can create users
):
    """
    Creates a new student, faculty, or admin account.
    PROTECTED — only admins can call this endpoint.

    In a real college system, the admin bulk-imports students
    from a CSV or creates them individually. Students don't
    self-register — they receive credentials from admin.

    Request body:
        {
            "username": "21CSE001",
            "full_name": "Ravi Kumar",
            "email": "ravi@college.edu",
            "password": "initialpassword",
            "role": "student"
        }
    """
    return create_user(db, user_data)
