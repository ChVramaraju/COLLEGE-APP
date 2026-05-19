# =============================================================
# main.py — The Entry Point of the Smart College Ecosystem API
# =============================================================
# This file is the "front door" of our backend.
# When the server starts, Python runs this file first.
# It creates the FastAPI application instance and registers
# all route modules (like plugging in feature boards).
# =============================================================

import asyncio
import logging
import logging.config
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.database.connection import engine, Base, SessionLocal
from backend.config.settings import settings
from backend.utils.limiter import limiter
from backend.middleware.logging import RequestLoggingMiddleware

# ---------------------------------------------------------------
# LOGGING CONFIGURATION
# ---------------------------------------------------------------
# Structured logging: every line has timestamp, level, logger name.
# In production, point this at a log aggregator (Papertrail, Logtail)
# by swapping StreamHandler for a service-specific handler.
# ---------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Import ALL models here — ORDER MATTERS for FK resolution:
#   1. user     → no FK dependencies
#   2. faculty  → FK to users
#   3. section  → FK to faculty
#   4. student  → FK to users + sections
# SQLAlchemy reads these imports to build the full metadata map
# before create_all() runs.
from backend.models import user as user_model
from backend.models import faculty as faculty_model
from backend.models import section as section_model
from backend.models import student as student_model
from backend.models import attendance as attendance_model
from backend.models import notes as notes_model
from backend.models import test as test_model
from backend.models import question as question_model
from backend.models import test_attempt as test_attempt_model
from backend.models import test_answer as test_answer_model
from backend.models import notification as notification_model
from backend.models import grade_scale as grade_scale_model
from backend.models import subject as subject_model
from backend.models import result as result_model
from backend.models import semester_result as semester_result_model
from backend.models import job_posting as job_posting_model
from backend.models import placement_application as placement_application_model

from backend.routes import auth as auth_router
from backend.routes import placement as placement_router
from backend.routes import result as result_router
from backend.routes import admin as admin_router
from backend.routes import notification as notification_router
from backend.routes import test as test_router
from backend.routes import notes as notes_router
from backend.utils.file_utils import ensure_upload_dir
from backend.services.result_service import seed_grade_scale
from backend.routes import attendance as attendance_router
from backend.routes import student as student_router
from backend.routes import faculty as faculty_router
from backend.routes import section as section_router
from backend.services.websocket_manager import ws_manager

# ---------------------------------------------------------------
# LIFESPAN — Controlled startup and shutdown
# ---------------------------------------------------------------
# WHY lifespan instead of module-level code?
#
# PROBLEM with module-level side effects (old code):
#   Base.metadata.create_all() ran at Python import time.
#   If the DB was unreachable at startup, the process crashed
#   with a bare OperationalError before FastAPI even existed —
#   no middleware, no error handlers, no retry logic could run.
#
# PROBLEM with multiple workers:
#   Railway/Render/Gunicorn spawn several worker processes.
#   Each worker imported main.py and ran create_all() simultaneously.
#   Race conditions in table creation are possible.
#
# PROBLEM with testing:
#   Import-time side effects make unit testing nearly impossible.
#   You cannot import the app module without touching the real DB.
#
# SOLUTION — asynccontextmanager lifespan:
#   Code before `yield` runs ONCE on startup, after the app object
#   exists and all middleware is registered.
#   Code after `yield` runs ONCE on graceful shutdown (cleanup).
#   FastAPI guarantees this runs in the correct lifecycle order.
# ---------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    # Register the running event loop so ws_manager.push_sync() can
    # schedule async WebSocket sends from synchronous service code.
    ws_manager.set_loop(asyncio.get_event_loop())

    # SCHEMA MANAGEMENT — Alembic owns this now.
    #
    # create_all() has been intentionally removed.
    #
    # WHY: create_all() is a one-way, non-reversible operation.
    # It creates missing tables but NEVER modifies existing ones.
    # It cannot add columns, rename columns, change types, or add
    # indexes. It gives a false sense of safety in production.
    #
    # Alembic is now the single source of truth for schema.
    #
    # LOCAL DEVELOPMENT:
    #   On first run against a fresh DB, run once manually:
    #     alembic upgrade head
    #   This creates all tables from the migration history.
    #
    # PRODUCTION DEPLOY (Railway / Render / any platform):
    #   Add to your deploy command / release phase:
    #     alembic upgrade head && uvicorn backend.main:app ...
    #   Alembic checks the alembic_version table, applies only
    #   new migrations, and exits. Then the server starts.
    #   Zero downtime. Zero data loss. Fully reversible.
    #
    # WHAT RUNS ON STARTUP NOW:
    #   Only application-level init (uploads dir, seed data).
    #   Schema is managed outside the app process entirely.

    # Ensure the uploads directory exists before the first request.
    ensure_upload_dir()

    # Seed the grade scale once. seed_grade_scale() is idempotent:
    # it checks if rows exist before inserting, so this is safe
    # to call on every startup with zero performance cost.
    db = SessionLocal()
    try:
        seed_grade_scale(db)
    finally:
        db.close()

    yield   # Application runs here — handling requests normally

    # --- SHUTDOWN ---
    # Nothing to clean up yet. Add connection pool disposal here
    # if you ever switch to async SQLAlchemy (asyncpg).


# Create the FastAPI application instance.
# The lifespan parameter replaces the deprecated @app.on_event("startup").
app = FastAPI(
    title="Smart College Ecosystem API",
    description="Backend API for managing students, faculty, attendance, tests, results, and more.",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach limiter to app state so route decorators can resolve it
app.state.limiter = limiter

# Register the built-in slowapi 429 response handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# SlowAPIMiddleware intercepts requests and enforces limits
app.add_middleware(SlowAPIMiddleware)

# Request logging + correlation ID middleware
# MUST be added after SlowAPIMiddleware so rate-limit 429s are also logged.
app.add_middleware(RequestLoggingMiddleware)


# ---------------------------------------------------------------
# GLOBAL EXCEPTION HANDLER
# ---------------------------------------------------------------
# Catches any unhandled exception that escaped all service/route
# try-except blocks. Without this, FastAPI returns a raw 500 with
# a full Python traceback to the client — leaking table names,
# file paths, and internal state to potential attackers.
# ---------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger = logging.getLogger("smart_college")
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        f"[req-{request_id}] Unhandled exception on {request.method} {request.url.path}",
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact the administrator."},
    )

# ---------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------
# CORS = Cross-Origin Resource Sharing.
# Without this, the React frontend (running on localhost:3000)
# would be BLOCKED from calling our API (running on localhost:8000).
# Browsers enforce this security rule. We must explicitly allow it.
#
# WHY NOT allow_origins=["*"]?
#   The CORS spec forbids wildcard origins for credentialed requests.
#   Our React app sends Authorization: Bearer <token> on every request.
#   That makes every request "credentialed". Browsers see "*" and
#   immediately block the response — the JWT never reaches the API.
#
#   The fix: enumerate exact origins from the environment.
#   Dev → http://localhost:3000, http://localhost:5173
#   Prod → set ALLOWED_ORIGINS in Railway/Render env vars
# ---------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],       # Allow GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],       # Allow all headers including Authorization
)


# ---------------------------------------------------------------
# Health Check Route
# ---------------------------------------------------------------
# This is the simplest possible route.
# It confirms the server is alive and responding.
# Used by deployment platforms (Railway/Render) to verify health.
# ---------------------------------------------------------------
@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "online",
        "message": "Smart College Ecosystem API is running.",
        "version": "1.0.0"
    }


# ---------------------------------------------------------------
# Register Route Modules
# ---------------------------------------------------------------
# Each module is plugged in here. As we build more phases,
# we'll add: students, faculty, attendance, tests, etc.
# ---------------------------------------------------------------
app.include_router(auth_router.router)
app.include_router(student_router.router)
app.include_router(faculty_router.router)
app.include_router(section_router.router)
app.include_router(attendance_router.router)
app.include_router(notes_router.router)
app.include_router(test_router.router)
app.include_router(notification_router.router)
app.include_router(result_router.router)
app.include_router(admin_router.router)
app.include_router(placement_router.router)
