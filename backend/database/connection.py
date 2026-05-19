# =============================================================
# database/connection.py — The Database Layer
# =============================================================
# This file is the HEART of how FastAPI communicates with
# PostgreSQL. It does three things:
#
#   1. Creates the ENGINE  → manages the connection pool
#   2. Creates SessionLocal → factory for per-request sessions
#   3. Creates Base        → parent class for all ORM models
#
# NOTHING database-related should be in main.py.
# This module is imported wherever DB access is needed.
# =============================================================

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from backend.config.settings import settings

# ---------------------------------------------------------------
# 1. THE ENGINE — Connection Pool Manager
# ---------------------------------------------------------------
# The engine is your app's "connection factory."
# It reads the DATABASE_URL from settings (which reads Railway's
# environment variables first, then falls back to .env).
#
# SSL HANDLING:
#   Railway and Render managed PostgreSQL require TLS/SSL for all
#   external connections. Local development PostgreSQL instances
#   (localhost/127.0.0.1) do NOT have SSL configured by default.
#   We detect local vs. cloud and set sslmode accordingly.
#
#   WHY connect_args instead of URL parameter?
#     Adding ?sslmode=require to the URL works too, but
#     connect_args keeps the URL clean and avoids double-setting
#     if the URL already contains an sslmode query parameter.
# ---------------------------------------------------------------

# Cloud PostgreSQL requires SSL; skip it for local development.
_connect_args: dict = {} if settings.is_local else {"sslmode": "require"}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,

    # pool_size: connections kept alive in the pool at all times.
    # 5 is the SQLAlchemy default and appropriate for a single-dyno app.
    # Raise to 10-20 for multi-worker Gunicorn deployments.
    pool_size=5,

    # max_overflow: extra connections allowed BEYOND pool_size during
    # traffic spikes. Total max connections = pool_size + max_overflow = 15.
    # After the spike, overflow connections are closed and not returned to pool.
    max_overflow=10,

    # pool_pre_ping: before handing a connection from the pool to a route,
    # send a lightweight "SELECT 1" to verify it's still alive.
    # Without this: if the DB restarts (Railway maintenance, network blip),
    # the pool holds stale connections that throw OperationalError on first use.
    # With this: the stale connection is silently discarded and a fresh one opened.
    pool_pre_ping=True,

    # pool_recycle: force-retire connections older than this many seconds.
    # Railway/Render PostgreSQL closes idle connections after ~30 minutes.
    # Setting this to 1800s (30 min) ensures we never hold a connection
    # past the server's own timeout, preventing "SSL connection has been closed"
    # errors on long-running or low-traffic deployments.
    pool_recycle=1800,
)

# ---------------------------------------------------------------
# 2. SESSION FACTORY — Per-Request Database Session
# ---------------------------------------------------------------
# sessionmaker() creates a SESSION CLASS (not a session itself).
# Think of it like a "cookie cutter" — every time you call
# SessionLocal(), you get a fresh session object.
#
# autocommit=False → we control when data is saved (explicit commit)
# autoflush=False  → don't auto-send SQL to DB before commit
# bind=engine      → connect sessions to our PostgreSQL engine
# ---------------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ---------------------------------------------------------------
# 3. BASE — The ORM Model Registry
# ---------------------------------------------------------------
# All database model classes will inherit from this Base.
# SQLAlchemy uses it to track which Python classes map to
# which database tables.
#
# Example usage in models/student.py:
#   from database.connection import Base
#   class Student(Base):
#       __tablename__ = "students"
#       ...
# ---------------------------------------------------------------
Base = declarative_base()


# ---------------------------------------------------------------
# 4. DEPENDENCY INJECTION FUNCTION — get_db()
# ---------------------------------------------------------------
# This is a FastAPI "dependency" — a function that FastAPI
# automatically calls before each route handler.
#
# It:
#   → Opens a fresh session for this specific request
#   → Passes it to the route handler via "yield"
#   → Guarantees the session is ALWAYS closed after, even on errors
#
# The "try/finally" pattern is critical:
#   → "try" gives the session to the route
#   → "finally" ALWAYS runs — even if an exception crashes the route
#   → This prevents connection leaks (sessions stuck open forever)
#
# Usage in a route:
#   from database.connection import get_db
#   from sqlalchemy.orm import Session
#   from fastapi import Depends
#
#   @router.get("/students")
#   def get_students(db: Session = Depends(get_db)):
#       return db.query(Student).all()
# ---------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db          # hand the session to the route handler
    finally:
        db.close()        # ALWAYS close — prevents connection leaks
