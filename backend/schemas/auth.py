# =============================================================
# schemas/auth.py — Pydantic Validation Schemas
# =============================================================
# Schemas are the "contract" between frontend and backend.
#
# WHY schemas separate from models?
#   → Models define what's IN the database
#   → Schemas define what comes IN from requests
#     and what goes OUT in responses
#   → You NEVER expose hashed_password in a response
#   → Schemas let you control exactly what data travels
#
# Rule: Always use schemas in routes, never raw models.
# =============================================================

from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    student = "student"
    faculty = "faculty"
    admin   = "admin"


# ---------------------------------------------------------------
# LOGIN — What the frontend sends to /auth/login
# ---------------------------------------------------------------
class LoginRequest(BaseModel):
    """
    Frontend sends this JSON body to log in:
    {
        "username": "21CSE001",   ← roll number / employee ID
        "password": "mypassword"
    }
    FastAPI validates this automatically before the route runs.
    If either field is missing → 422 Unprocessable Entity (auto).
    """
    username: str
    password: str


# ---------------------------------------------------------------
# TOKEN RESPONSE — What we send BACK after successful login
# ---------------------------------------------------------------
class TokenResponse(BaseModel):
    """
    After login succeeds, we return:
    {
        "access_token": "eyJhbGci...",
        "token_type": "bearer",
        "role": "student"
    }
    React stores access_token and sends it in every future request.
    "role" tells React which dashboard to redirect to.
    """
    access_token: str
    token_type: str = "bearer"
    role: UserRole


# ---------------------------------------------------------------
# USER CREATION — What admin sends to create a user
# ---------------------------------------------------------------
class UserCreate(BaseModel):
    """
    Used by admin to register a new student or faculty.
    password here is plain text — the service will hash it.
    """
    username: str
    full_name: str
    email: Optional[EmailStr] = None
    password: str
    role: UserRole


# ---------------------------------------------------------------
# USER RESPONSE — Safe user data returned to frontend
# ---------------------------------------------------------------
class UserResponse(BaseModel):
    """
    Public-safe user info — notice: NO hashed_password field.
    This is intentional. We NEVER expose password hashes.
    """
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True   # Allows converting SQLAlchemy model → schema
