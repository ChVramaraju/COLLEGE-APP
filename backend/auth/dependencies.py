# =============================================================
# auth/dependencies.py — FastAPI Route Protection Dependencies
# =============================================================
# These are FastAPI "dependencies" — functions injected into
# routes via Depends() that run BEFORE the route handler.
#
# Think of them as "security checkpoints" at the route entrance:
#
#   @router.get("/my-dashboard")
#   def dashboard(current_user = Depends(get_current_user)):
#       ...
#
# FastAPI calls get_current_user() automatically, validates the
# JWT, and either passes the user in OR raises 401 — before
# your route code even runs.
#
# ROLE-BASED ACCESS:
#   get_current_student() → only students can access
#   get_current_faculty() → only faculty can access
#   get_current_admin()   → only admins can access
# =============================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.auth.jwt import verify_access_token
from backend.models.user import User, UserRole

# OAuth2PasswordBearer tells FastAPI:
# "Expect a Bearer token in the Authorization header"
# tokenUrl is the login endpoint (used by Swagger UI)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Extracts and validates the JWT from the Authorization header.
    Returns the full User object if valid.
    Raises HTTP 401 if token is missing, expired, or invalid.

    This runs on EVERY protected route automatically.
    """
    # Decode the token — raises 401 if invalid/expired
    payload = verify_access_token(token)
    user_id = int(payload["sub"])

    # Load the full user from DB
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token no longer exists."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )

    return user


def get_current_student(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Extends get_current_user — additionally checks role is 'student'.
    Use on any route that only students should access.
    """
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Students only."
        )
    return current_user


def get_current_faculty(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Extends get_current_user — additionally checks role is 'faculty'.
    Use on any route that only faculty should access.
    """
    if current_user.role != UserRole.faculty:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Faculty only."
        )
    return current_user


def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Extends get_current_user — additionally checks role is 'admin'.
    Use on any route that only admins should access.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admins only."
        )
    return current_user
