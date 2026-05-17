# =============================================================
# utils/seed_admin.py — First Admin Account Bootstrap Script
# =============================================================
# This script solves the "chicken-and-egg" problem:
#   → /auth/register requires an admin token
#   → You can't GET an admin token without an admin user
#   → You can't CREATE an admin user without an admin token
#
# SOLUTION: Run this ONCE directly against the database to
# create the first admin, bypassing all HTTP auth checks.
#
# Run with:
#   .\venv\Scripts\python.exe -m backend.utils.seed_admin
#
# IMPORTANT: Run this only ONCE. Running twice will skip
# creation (duplicate check is built in).
# =============================================================

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database.connection import SessionLocal
from backend.models.user import User, UserRole
from backend.auth.hashing import hash_password


def seed_admin():
    db = SessionLocal()

    try:
        print("\n" + "="*50)
        print("  Smart College Ecosystem - Admin Seeder")
        print("="*50)

        # Check if admin already exists — never create duplicates
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print("\n  [SKIP] Admin user already exists.")
            print(f"  [INFO] Username: admin")
            print(f"  [INFO] Role: {existing.role.value}")
            print(f"  [INFO] ID: {existing.id}\n")
            return

        # Create admin user directly — bypasses HTTP auth entirely
        admin_user = User(
            username="admin",
            full_name="System Administrator",
            email="admin@college.edu",
            hashed_password=hash_password("Admin@1234"),
            role=UserRole.admin,
            is_active=True,
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("\n  [OK] Admin user created successfully!")
        print(f"  [OK] ID       : {admin_user.id}")
        print(f"  [OK] Username : admin")
        print(f"  [OK] Password : Admin@1234")
        print(f"  [OK] Role     : {admin_user.role.value}")
        print("\n  IMPORTANT: Change this password after first login!")
        print("="*50 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n  [FAIL] Seeding failed: {e}\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
