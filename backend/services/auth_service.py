# =============================================================
# services/auth_service.py — Authentication Business Logic
# =============================================================
# Services contain ALL business logic.
# Routes are thin — they only call service functions.
#
# WHY separate services from routes?
#   → You can test service logic without HTTP
#   → You can reuse service functions across routes
#   → Logic stays clean and maintainable
#   → Follows Single Responsibility Principle
# =============================================================

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.models.user import User, UserRole
from backend.schemas.auth import UserCreate, LoginRequest, TokenResponse
from backend.auth.hashing import hash_password, verify_password
from backend.auth.jwt import create_access_token


def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Registers a new user (student/faculty/admin).
    Called by admin when adding a student or faculty member.

    Steps:
    1. Check username isn't already taken
    2. Check email isn't already taken
    3. Hash the password
    4. Save to DB
    5. Return the created user
    """
    # Check for duplicate username
    existing_username = db.query(User).filter(
        User.username == user_data.username
    ).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{user_data.username}' is already registered."
        )

    # Check for duplicate email
    if user_data.email:
        existing_email = db.query(User).filter(
            User.email == user_data.email
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_data.email}' is already registered."
            )

    # Hash the plain password before storing
    hashed = hash_password(user_data.password)

    # Create the SQLAlchemy model instance
    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hashed,
        role=user_data.role,
    )

    db.add(new_user)       # Stage the INSERT
    db.commit()            # Execute the INSERT and commit transaction
    db.refresh(new_user)   # Reload from DB to get auto-generated fields (id, created_at)

    return new_user


def authenticate_user(db: Session, login_data: LoginRequest) -> TokenResponse:
    """
    Validates credentials and returns a JWT token on success.

    Steps:
    1. Find user by username
    2. Verify the password against the stored hash
    3. Check account is active
    4. Generate JWT token with user_id and role
    5. Return token + role to frontend

    Security note:
    Both "user not found" and "wrong password" return the same
    error message intentionally — we don't reveal which is wrong.
    This prevents "username enumeration" attacks.
    """
    # Look up user by username (roll number / employee ID)
    user = db.query(User).filter(User.username == login_data.username).first()

    # Same error for "not found" and "wrong password" — security by design
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your ID and password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Block deactivated accounts
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact admin.",
        )

    # Generate JWT — embed user ID and role into the token
    token = create_access_token(data={
        "sub": str(user.id),     # "sub" = subject (standard JWT claim)
        "role": user.role.value  # "student" / "faculty" / "admin"
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role
    )


def get_user_by_id(db: Session, user_id: int) -> User:
    """
    Fetches a user by their ID.
    Used by get_current_user() to load full user info from token.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user
