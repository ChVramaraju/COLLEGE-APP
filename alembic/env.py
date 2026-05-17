# =============================================================
# alembic/env.py — Alembic Migration Environment
# =============================================================
# This file runs every time you execute ANY alembic command.
# It is responsible for:
#
#   1. Telling Alembic WHERE to connect (DATABASE_URL)
#   2. Telling Alembic WHAT to compare against (Base.metadata)
#   3. Executing migrations in the correct mode (online vs offline)
#
# TWO MODES:
#
#   ONLINE  — Alembic connects directly to the DB and applies
#              migrations live. This is the normal mode (upgrade,
#              downgrade, autogenerate).
#
#   OFFLINE — Alembic generates a .sql script without connecting.
#              Used when a DBA needs to review SQL before running it,
#              or when the DB is only accessible through a jump host.
#              "alembic upgrade head --sql > migration.sql"
#
# =============================================================

from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# ---------------------------------------------------------------
# ALEMBIC CONFIG OBJECT
# Provides access to values in alembic.ini.
# We use it here to inject the real DATABASE_URL at runtime.
# ---------------------------------------------------------------
config = context.config

# ---------------------------------------------------------------
# LOGGING SETUP
# Reads the [loggers] / [handlers] / [formatters] sections from
# alembic.ini to configure Python's logging system. This gives
# you clean output when running migration commands.
# ---------------------------------------------------------------
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------
# DATABASE URL — Read from settings, NOT from alembic.ini
#
# WHY: alembic.ini is committed to Git. Real credentials must
# never live in a committed file. Instead we read DATABASE_URL
# from settings.py, which reads it from the .env file.
#
# config.set_main_option() injects the value into Alembic's
# config at runtime, overwriting the dummy placeholder in
# alembic.ini. The .ini file stays safe for Git.
# ---------------------------------------------------------------
from backend.config.settings import settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# ---------------------------------------------------------------
# MODEL IMPORTS — The Registration Trick
#
# CRITICAL: Base.metadata is populated LAZILY.
# A table only registers into Base.metadata when its model
# class is executed — i.e., when its module is imported.
#
# If we only imported Base and left these out, Base.metadata
# would be empty. Alembic would see "no tables" and generate
# migrations that DROP all your existing tables.
#
# These imports look unused but they are NOT — they are
# registration triggers. Each import causes the model class
# body to run, which calls Base.__init_subclass__ and registers
# the table into Base.metadata.
#
# Every time you add a new model file, add it here.
# ---------------------------------------------------------------
from backend.database.connection import Base

from backend.models import user               # users table
from backend.models import faculty            # faculty table
from backend.models import section            # sections table
from backend.models import student            # students table
from backend.models import attendance         # attendance_records table
from backend.models import notes              # notes table
from backend.models import test               # tests table
from backend.models import question           # questions table
from backend.models import test_attempt       # test_attempts table
from backend.models import test_answer        # test_answers table
from backend.models import notification       # notifications table
from backend.models import subject            # subjects table
from backend.models import result             # results table
from backend.models import semester_result    # semester_results table
from backend.models import grade_scale        # grade_scale table
from backend.models import job_posting        # job_postings table
from backend.models import placement_application  # placement_applications table

# ---------------------------------------------------------------
# TARGET METADATA
#
# This is the object Alembic compares your live database against
# when generating migrations. It contains the full schema
# definition of every model imported above.
#
# When you run: alembic revision --autogenerate
# Alembic does:
#   1. Reads target_metadata  → "what your code says the DB should look like"
#   2. Inspects the live DB   → "what the DB actually looks like right now"
#   3. Diffs them             → "here's what SQL is needed to reconcile"
#   4. Writes that SQL into upgrade() and downgrade() functions
# ---------------------------------------------------------------
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in OFFLINE mode.

    Offline mode does NOT connect to the database.
    Instead it generates a .sql script that a DBA can review
    and run manually. Useful for:
      - Production environments where the app server cannot
        directly connect to the DB (firewall rules)
      - Regulatory requirements where a DBA must approve SQL
        before it touches production data
      - Generating migration scripts for PostgreSQL Cloud proxies

    Usage:
        alembic upgrade head --sql > migration_to_review.sql

    The generated SQL can be inspected, tested in staging,
    then run against production by a DBA.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # compare_type=True tells Alembic to also detect column
        # type changes (e.g. VARCHAR(50) → VARCHAR(200))
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in ONLINE mode.

    Online mode opens a real database connection and applies
    migrations directly. This is the normal mode used during:
      - Local development
      - CI/CD pipelines that can reach the DB
      - Railway/Render deploy hooks

    Uses NullPool instead of a connection pool because:
      - Migration scripts are short-lived CLI processes
      - They run once and exit — no benefit to pooling
      - NullPool closes the connection immediately after use,
        preventing any risk of leaving open connections on exit
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # compare_type=True: detect column type changes.
            # Without this, Alembic ignores VARCHAR(50)→VARCHAR(200).
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
