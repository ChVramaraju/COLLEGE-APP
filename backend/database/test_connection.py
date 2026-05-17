# =============================================================
# database/test_connection.py — Connection Verification Script
# =============================================================
# Run this file DIRECTLY to verify PostgreSQL connectivity.
# This is NOT part of the main app — it's a diagnostic tool.
#
# Run with:
#   cd "STUDENT APP"
#   .\venv\Scripts\python.exe -m backend.database.test_connection
# =============================================================

import sys
import os

# Add the parent directory to path so imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text
from backend.database.connection import engine, SessionLocal
from backend.config.settings import settings


def test_connection():
    print("\n" + "="*55)
    print("  Smart College Ecosystem - Database Connection Test")
    print("="*55)
    print(f"\n  Connecting to: {settings.DATABASE_URL}\n")

    try:
        # Attempt to open a connection from the pool
        with engine.connect() as connection:
            # Run the simplest possible SQL — ask DB for current time
            result = connection.execute(text("SELECT NOW()"))
            db_time = result.fetchone()[0]

            print("  [OK] Connection successful!")
            print(f"  [OK] PostgreSQL server time: {db_time}")
            print(f"  [OK] Database: smart_college_db is reachable\n")

    except Exception as e:
        print(f"  [FAIL] Connection FAILED!")
        print(f"  [FAIL] Error: {e}")
        print("\n  Possible causes:")
        print("  -> Wrong password in DATABASE_URL (.env)")
        print("  -> PostgreSQL service not running")
        print("  -> Database 'smart_college_db' doesn't exist")
        print("  -> Wrong port (should be 5432)\n")


if __name__ == "__main__":
    test_connection()
