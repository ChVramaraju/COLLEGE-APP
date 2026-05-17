# =============================================================
# auth/jwt.py — JWT Token Creation & Verification
# =============================================================
# This module handles ALL JWT operations.
#
# JWT = JSON Web Token
# A JWT is a digitally signed string that proves identity.
#
# Structure:  HEADER.PAYLOAD.SIGNATURE
#   Header   → algorithm used (HS256)
#   Payload  → user_id, role, expiry time
#   Signature→ HMAC of header+payload using SECRET_KEY
#
# WHY JWT?
#   → Stateless — server doesn't need to store sessions
#   → Scalable — any server instance can verify a token
#   → Role-aware — we embed "role" inside the token
#   → Self-expiring — tokens automatically expire
#
# TWO functions:
#   create_access_token() → called after successful login
#   verify_access_token() → called on every protected request
# =============================================================

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import HTTPException, status

from backend.config.settings import settings


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a signed JWT token containing user identity data.

    Args:
        data: dict containing at minimum {"sub": user_id, "role": role}
        expires_delta: how long the token is valid (default from settings)

    Returns:
        A signed JWT string to send to the client

    Example payload encoded into token:
        {
            "sub": "42",          ← user ID (subject)
            "role": "student",    ← role for access control
            "exp": 1234567890     ← unix timestamp when token expires
        }
    """
    to_encode = data.copy()

    # Set expiry time
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})

    # Sign the token with our SECRET_KEY using HS256 algorithm
    # If anyone tampers with the payload, this signature breaks
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def verify_access_token(token: str) -> dict:
    """
    Decodes and verifies a JWT token from an incoming request.

    Raises HTTPException 401 if:
        → token is expired
        → token is tampered with
        → token is missing required fields

    Returns:
        The decoded payload dict: {"sub": user_id, "role": role}

    This function is called by get_current_user() dependency
    on every protected route.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode and verify signature + expiry in one step
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        user_id: str = payload.get("sub")
        role: str = payload.get("role")

        # Both fields must exist in a valid token
        if user_id is None or role is None:
            raise credentials_exception

        return {"sub": user_id, "role": role}

    except JWTError:
        # Catches: expired tokens, tampered tokens, invalid format
        raise credentials_exception
