# =============================================================
# auth/hashing.py — Password Hashing & Verification
# =============================================================
# This module handles ALL password security in the system.
#
# WHY bcrypt?
#   → It is a slow-by-design hashing algorithm.
#   → "Slow" is intentional — it makes brute-force attacks
#     take years instead of seconds.
#   → Even if your database is stolen, hashed passwords
#     cannot be reversed back to the original.
#
# TWO functions only:
#   hash_password()   → used at registration / password creation
#   verify_password() → used at login
# =============================================================

from passlib.context import CryptContext

# CryptContext defines WHICH hashing algorithm to use.
# "bcrypt" is the industry standard for password hashing.
# deprecated="auto" means if we ever upgrade algorithms,
# old hashes are automatically detected and handled.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """
    Takes a plain text password and returns a bcrypt hash.
    Used when: creating a student/faculty/admin account.

    Example:
        hash_password("mypassword123")
        → "$2b$12$KIHnfY7xQz..."  (stored in DB)
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares a plain password against a stored bcrypt hash.
    Returns True if they match, False if they don't.
    Used when: student/faculty logs in.

    Example:
        verify_password("mypassword123", "$2b$12$KIHnfY7xQz...")
        → True
        verify_password("wrongpassword", "$2b$12$KIHnfY7xQz...")
        → False
    """
    return pwd_context.verify(plain_password, hashed_password)
