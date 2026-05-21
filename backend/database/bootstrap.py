#!/usr/bin/env python
# ============================================================
# bootstrap.py — Production-safe database initialization
# ============================================================
# This script runs BEFORE uvicorn starts (via railway.json).
# It ensures all tables exist before the FastAPI app serves requests.
#
# TWO PATHS:
#   1. Fresh DB (no tables) → create_all() + alembic stamp head
#   2. Existing DB → alembic upgrade head (incremental migrations)
#
# This is idempotent — safe to run on every deploy.
# ============================================================

import logging
import sys
import urllib.parse

from sqlalchemy import inspect as sa_inspect, text as sa_text
from alembic.config import Config
from alembic import command

# Import database connection and Base
from backend.database.connection import engine, Base
from backend.config.settings import settings

# CRITICAL: Import ALL models BEFORE create_all()
# Order matters for FK resolution (no-FK first, then FK-dependent)
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
from backend.models import faculty_assignment as faculty_assignment_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bootstrap")


def main():
    """Main bootstrap logic — idempotent, production-safe."""
    logger.info("=" * 60)
    logger.info("DATABASE BOOTSTRAP STARTING")
    logger.info("=" * 60)

    # DB connection diagnostics
    db_url = settings.DATABASE_URL
    parsed = urllib.parse.urlparse(db_url)
    logger.info("DB Dialect  : %s", parsed.scheme or "MISSING")
    logger.info("DB Host     : %s", parsed.hostname or "MISSING")
    logger.info("DB Port     : %s", parsed.port or "MISSING")
    logger.info("DB Database : %s", (parsed.path or "").lstrip("/") or "MISSING")
    logger.info("Is local    : %s", settings.is_local)
    logger.info("-" * 60)

    # Check if tables exist
    inspector = sa_inspect(engine)
    existing_tables = set(inspector.get_table_names())
    logger.info("Existing tables detected: %d", len(existing_tables))

    if existing_tables:
        logger.info("Tables: %s", sorted(existing_tables))
    else:
        logger.info("No tables detected → FRESH DATABASE")

    # Check for alembic_version table
    has_alembic = "alembic_version" in existing_tables
    logger.info("alembic_version table: %s", "EXISTS" if has_alembic else "MISSING")

    # Check for grade_scales table
    has_grade_scales = "grade_scales" in existing_tables
    logger.info("grade_scales table: %s", "EXISTS" if has_grade_scales else "MISSING")
    logger.info("-" * 60)

    # CRITICAL: Verify Base.metadata has tables registered
    metadata_tables = set(Base.metadata.tables.keys())
    logger.info("SQLAlchemy metadata tables registered: %d", len(metadata_tables))
    if metadata_tables:
        logger.info("Metadata tables: %s", sorted(metadata_tables))
    else:
        logger.error("✗ CRITICAL: Base.metadata is EMPTY - no models imported!")
        logger.error("✗ This means create_all() will do nothing.")
        logger.error("✗ Check that all model imports are working correctly.")
        sys.exit(1)

    if "grade_scales" not in metadata_tables:
        logger.error("✗ CRITICAL: grade_scales not in Base.metadata!")
        logger.error("✗ Check that backend.models.grade_scale is imported.")
        sys.exit(1)

    logger.info("✓ All required models are registered in metadata")
    logger.info("-" * 60)

    # DECISION: Fresh DB vs Existing DB
    # Treat DB as "fresh" if no application tables exist.
    # alembic_version alone means a previous deploy stamped Alembic
    # but never created the actual schema — use create_all().
    app_tables = existing_tables - {"alembic_version"}
    if not app_tables:
        # FRESH DATABASE (or only alembic_version exists)
        logger.info("PATH: Fresh database → creating all tables via Base.metadata.create_all()")
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("✓ Base.metadata.create_all() completed")
            
            # Verify tables were actually created
            inspector = sa_inspect(engine)
            created_tables = set(inspector.get_table_names())
            logger.info("Tables after create_all(): %d", len(created_tables))
            logger.info("Created tables: %s", sorted(created_tables))
            
            if "grade_scales" not in created_tables:
                logger.error("✗ CRITICAL: grade_scales table was NOT created!")
                logger.error("✗ This should never happen if the model is imported correctly.")
                sys.exit(1)
            
            logger.info("✓ grade_scales table verified")
        except Exception as e:
            logger.error("✗ FAILED to create tables: %s", e)
            logger.error("✗ Full traceback:", exc_info=True)
            sys.exit(1)

        # Stamp alembic version so future migrations know we're at head
        logger.info("Stamping alembic version to 'head'...")
        try:
            alembic_cfg = Config("alembic.ini")
            command.stamp(alembic_cfg, "head")
            logger.info("✓ Alembic stamped to 'head'")
        except Exception as e:
            logger.warning("⚠ Failed to stamp alembic: %s (non-critical)", e)

    else:
        # EXISTING DATABASE (with application tables)
        logger.info("PATH: Existing database → running alembic upgrade head")
        try:
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
            logger.info("✓ Alembic upgrade completed")
            
            # Verify grade_scales still exists after migration
            inspector = sa_inspect(engine)
            final_tables = set(inspector.get_table_names())
            if "grade_scales" not in final_tables:
                logger.error("✗ CRITICAL: grade_scales table MISSING after alembic upgrade!")
                logger.error("✗ Tables present: %s", sorted(final_tables))
                sys.exit(1)
            logger.info("✓ grade_scales table verified after migration")
        except Exception as e:
            logger.error("✗ FAILED to run alembic upgrade: %s", e)
            logger.error("✗ Full traceback:", exc_info=True)
            sys.exit(1)

    # FINAL VERIFICATION
    logger.info("-" * 60)
    logger.info("FINAL VERIFICATION")
    inspector = sa_inspect(engine)
    final_tables = set(inspector.get_table_names())
    logger.info("Total tables after bootstrap: %d", len(final_tables))
    logger.info("All tables: %s", sorted(final_tables))
    
    # Critical table checks
    critical_tables = ["grade_scales", "users", "students", "faculty", "sections", "alembic_version"]
    missing_critical = [t for t in critical_tables if t not in final_tables]
    
    if missing_critical:
        logger.error("✗ CRITICAL: Missing required tables: %s", missing_critical)
        sys.exit(1)
    
    logger.info("✓ All critical tables present")
    logger.info("✓ grade_scales present: YES")
    logger.info("=" * 60)
    logger.info("BOOTSTRAP COMPLETE — starting uvicorn...")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
