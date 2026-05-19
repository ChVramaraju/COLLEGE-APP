"""
backend/database/bootstrap.py — Production-safe schema bootstrapper.

WHY this exists:
  The Alembic migration chain has an empty initial baseline migration
  (570123d198fe) that was created after the original developer already
  had all tables from a manual create_all() run. Incremental migrations
  like "add column to notes" assume those base tables already exist.

  On a FRESH Railway PostgreSQL instance, no tables exist.  Alembic's
  second migration immediately fails with:
      psycopg2.errors.UndefinedTable: relation "notes" does not exist

  Even if alembic_version was somehow stamped at HEAD without creating
  tables, the app crashes at startup with:
      psycopg2.errors.UndefinedTable: relation "grade_scales" does not exist

HOW it works:
  1. Import ALL ORM models to populate Base.metadata completely.
  2. Inspect which tables currently exist in the live database.
  3. Compare against every table defined in Base.metadata.
  4a. If ANY required table is MISSING:
        → Run Base.metadata.create_all() — creates the full schema at once.
        → Stamp alembic_version to HEAD — tells Alembic "already current".
        This is idempotent: create_all() skips tables that already exist.
  4b. If ALL required tables exist:
        → Run alembic upgrade head — applies only new incremental migrations.
        Safe for rolling updates to a live database with data.
  5. Print full diagnostics so Railway logs are self-documenting.

USAGE (from project root):
  python backend/database/bootstrap.py

Called automatically by railway.json startCommand before uvicorn starts.
"""

import logging
import os
import sys
from pathlib import Path

# -----------------------------------------------------------------------
# Ensure the project root is on sys.path so "backend.*" imports work
# regardless of which directory Railway sets as CWD.
# -----------------------------------------------------------------------
_root = str(Path(__file__).resolve().parent.parent.parent)
if _root not in sys.path:
    sys.path.insert(0, _root)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("bootstrap")

# -----------------------------------------------------------------------
# Import every ORM model BEFORE touching Base or engine.
#
# SQLAlchemy's declarative base populates Base.metadata LAZILY — a table
# only registers when its model class is executed (i.e., its module is
# imported).  If we skipped even one import, create_all() and autogenerate
# would be blind to that table.
#
# These look like unused imports but they are registration side-effects.
# -----------------------------------------------------------------------
from backend.database.connection import Base, engine          # noqa: E402

from backend.models import user                               # noqa: F401
from backend.models import faculty                            # noqa: F401
from backend.models import section                            # noqa: F401
from backend.models import student                            # noqa: F401
from backend.models import attendance                         # noqa: F401
from backend.models import notes                              # noqa: F401
from backend.models import test                               # noqa: F401
from backend.models import question                           # noqa: F401
from backend.models import test_attempt                       # noqa: F401
from backend.models import test_answer                        # noqa: F401
from backend.models import notification                       # noqa: F401
from backend.models import subject                            # noqa: F401
from backend.models import result                             # noqa: F401
from backend.models import semester_result                    # noqa: F401
from backend.models import grade_scale                        # noqa: F401
from backend.models import job_posting                        # noqa: F401
from backend.models import placement_application              # noqa: F401
from backend.models import faculty_assignment                 # noqa: F401

from sqlalchemy import inspect, text                          # noqa: E402
from alembic.config import Config                             # noqa: E402
from alembic import command as alembic_command               # noqa: E402


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _alembic_cfg() -> Config:
    """Build an Alembic Config object with the live DATABASE_URL injected."""
    ini_path = os.path.join(_root, "alembic.ini")
    cfg = Config(ini_path)
    from backend.config.settings import settings
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    return cfg


def _current_revision() -> str | None:
    """Return the current alembic_version value, or None on a fresh DB."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).fetchone()
            return row[0] if row else None
    except Exception:
        return None


# -----------------------------------------------------------------------
# Main bootstrap logic
# -----------------------------------------------------------------------

def run_bootstrap() -> None:
    log.info("=" * 60)
    log.info("SCHEMA BOOTSTRAP — starting")
    log.info("=" * 60)

    # ── 1. Discover current DB state ────────────────────────────────────
    inspector = inspect(engine)
    existing_tables: set[str] = set(inspector.get_table_names())
    required_tables: set[str] = {t.name for t in Base.metadata.sorted_tables}
    missing_tables:  set[str] = required_tables - existing_tables
    current_rev = _current_revision()

    # ── 2. Diagnostics ──────────────────────────────────────────────────
    log.info("Alembic revision : %s", current_rev or "none (fresh DB)")
    log.info(
        "Existing tables  : %d → %s",
        len(existing_tables),
        sorted(existing_tables) if existing_tables else "NONE",
    )
    log.info(
        "Required tables  : %d → %s",
        len(required_tables),
        sorted(required_tables),
    )
    log.info(
        "Missing tables   : %d → %s",
        len(missing_tables),
        sorted(missing_tables) if missing_tables else "none",
    )
    log.info("grade_scales exists : %s", "grade_scales" in existing_tables)

    cfg = _alembic_cfg()

    if missing_tables:
        # ────────────────────────────────────────────────────────────────
        # CASE A — Fresh or partially-bootstrapped database.
        #
        # WHY create_all instead of alembic upgrade head?
        #   The initial Alembic migration (570123d198fe) is intentionally
        #   empty — it was created as a baseline AFTER the local dev DB
        #   already had all tables from a manual create_all() call.
        #   Subsequent migrations like "add column to notes" rely on base
        #   tables existing. On a fresh DB they fail immediately.
        #
        # WHY stamp head afterward?
        #   create_all() produces the identical schema that applying every
        #   migration in sequence would produce. Stamping head tells
        #   Alembic "this DB is already current" so future deploys run
        #   only NEW incremental migrations — not the ones we just handled.
        #
        # WHY is create_all safe here?
        #   It is fully idempotent: it only creates tables that are absent.
        #   It will never DROP or ALTER existing tables or data.
        # ────────────────────────────────────────────────────────────────
        log.info("-" * 60)
        log.info("ACTION: %d table(s) missing — running Base.metadata.create_all()", len(missing_tables))

        Base.metadata.create_all(bind=engine)

        # Verify every table was actually created
        inspector2 = inspect(engine)
        after_tables = set(inspector2.get_table_names())
        still_missing = required_tables - after_tables
        if still_missing:
            log.error("FATAL: create_all() finished but tables still missing: %s", sorted(still_missing))
            sys.exit(1)

        log.info("All %d tables created successfully.", len(required_tables))
        log.info("ACTION: stamping Alembic to HEAD")
        alembic_command.stamp(cfg, "head")
        log.info("Bootstrap complete — schema created and Alembic at HEAD.")

    else:
        # ────────────────────────────────────────────────────────────────
        # CASE B — All tables already exist (normal rolling deployment).
        #
        # Run alembic upgrade head to apply any NEW incremental migrations
        # added since the last deployment.  Alembic compares the version
        # in alembic_version against the migration files and only applies
        # what is missing.  Zero-downtime. Fully reversible.
        # ────────────────────────────────────────────────────────────────
        log.info("-" * 60)
        log.info("ACTION: all tables present — running alembic upgrade head")
        alembic_command.upgrade(cfg, "head")
        log.info("Incremental migrations applied.")

    log.info("=" * 60)
    log.info("SCHEMA BOOTSTRAP — complete, handing off to uvicorn")
    log.info("=" * 60)


if __name__ == "__main__":
    run_bootstrap()
