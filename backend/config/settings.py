# =============================================================
# config/settings.py — Central Configuration Hub
# =============================================================
# All environment-sensitive settings live here.
# We read from a .env file so secrets are NEVER hardcoded.
# This is a non-negotiable production rule:
#   → Never put passwords or secret keys directly in code.
#   → .env files are added to .gitignore so they never reach GitHub.
#
# PRIORITY ORDER (highest → lowest):
#   1. Real system environment variables  ← Railway / Render set these
#   2. .env file values                   ← local development only
#   3. Field default values               ← safe non-secret defaults only
#
# WHY no manual load_dotenv() call?
#   pydantic-settings handles .env loading internally and ALWAYS lets
#   real system env vars win over .env file values. A manual
#   load_dotenv(override=True) would do the opposite — it would
#   overwrite Railway's DATABASE_URL with the local .env value,
#   causing the "connection refused on localhost" crash in production.
# =============================================================

import logging
import os
import urllib.parse
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to .env — resolved at import time so it's found
# regardless of the working directory the server is launched from.
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


class Settings(BaseSettings):
    # ----------------------------------------------------------------
    # pydantic-settings v2 config
    # ----------------------------------------------------------------
    # env_file          → read local .env for development convenience
    # env_ignore_empty  → treat empty strings the same as missing vars
    # extra="allow"     → don't crash on unknown env vars (Railway injects many)
    #
    # CRITICAL: pydantic-settings gives real os.environ vars priority
    # over .env file values by default — no override flag needed.
    # ----------------------------------------------------------------
    model_config = SettingsConfigDict(
        env_file=_env_path,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="allow",
    )

    # ----------------------------------------------------------------
    # DATABASE
    # ----------------------------------------------------------------
    # NO default value — the app refuses to start if DATABASE_URL is
    # absent. A missing connection string is a deployment error, not a
    # recoverable runtime state. Failing fast here prevents a confusing
    # "connection refused on localhost" error deep inside a route handler.
    #
    # Railway: set DATABASE_URL in your service's Variables tab.
    #          Use the "postgres.DATABASE_URL" reference variable so
    #          Railway automatically rotates it when credentials change.
    # Local:   set DATABASE_URL in backend/.env (gitignored).
    # ----------------------------------------------------------------
    DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """
        1. Normalize postgres:// → postgresql:// (Railway/Heroku format).
        2. Hard-guard: reject localhost URLs when running on Railway.
           This surfaces the real problem immediately instead of crashing
           deep inside SQLAlchemy with a confusing OperationalError.
        """
        if not isinstance(v, str):
            return v

        # Normalize the dialect prefix
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]

        # ----------------------------------------------------------------
        # RAILWAY HARD GUARD
        # Railway sets RAILWAY_ENVIRONMENT (and several other vars).
        # If we detect Railway AND the URL still points to localhost,
        # fail immediately with a clear, actionable error message.
        #
        # This means the Railway Variables tab has DATABASE_URL set
        # to a localhost value (e.g., copied from local .env by mistake).
        # FIX: In Railway → your backend service → Variables:
        #   DATABASE_URL = ${{Postgres.DATABASE_URL}}
        # ----------------------------------------------------------------
        _railway_keys = (
            "RAILWAY_ENVIRONMENT",
            "RAILWAY_SERVICE_ID",
            "RAILWAY_PROJECT_ID",
            "RAILWAY_STATIC_URL",
        )
        _on_railway = any(os.environ.get(k) for k in _railway_keys)
        if _on_railway:
            _parsed = urllib.parse.urlparse(v)
            if _parsed.hostname in ("localhost", "127.0.0.1"):
                raise ValueError(
                    "\n"
                    "=" * 60 + "\n"
                    "FATAL: DATABASE_URL points to localhost on Railway!\n"
                    "=" * 60 + "\n"
                    f"  Received URL host : {_parsed.hostname}\n"
                    f"  Received URL port : {_parsed.port}\n"
                    "\n"
                    "  FIX — In Railway dashboard:\n"
                    "    1. Go to your backend service\n"
                    "    2. Open the Variables tab\n"
                    "    3. Set:  DATABASE_URL = ${{Postgres.DATABASE_URL}}\n"
                    "       (Use the reference variable, not a hardcoded URL)\n"
                    "    4. Redeploy\n"
                    "=" * 60
                )

        return v

    # ----------------------------------------------------------------
    # JWT AUTHENTICATION
    # ----------------------------------------------------------------
    # Secret used to sign every JWT token.
    # Override this in Railway Variables / local .env — never commit a
    # real secret here.  The placeholder below is intentionally weak so
    # a deployment that forgot to set SECRET_KEY is obviously broken.
    # ----------------------------------------------------------------
    SECRET_KEY: str = "change-this-to-a-long-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ----------------------------------------------------------------
    # CORS
    # ----------------------------------------------------------------
    # Comma-separated list of allowed frontend origins.
    #
    # WHY NOT "*"?
    #   The browser CORS spec forbids wildcard origins for credentialed
    #   requests (ones that carry Authorization headers).  FastAPI's
    #   CORSMiddleware returns "Access-Control-Allow-Origin: *" which
    #   the browser immediately REJECTS — your JWT never reaches the API.
    #
    # Development defaults: Vite (5173) + CRA (3000)
    # Production: override ALLOWED_ORIGINS in Railway Variables.
    #   Example: https://myapp.netlify.app,https://myapp.vercel.app
    # ----------------------------------------------------------------
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # ----------------------------------------------------------------
    # RATE LIMITING
    # ----------------------------------------------------------------
    # Login attempts per minute per IP address.
    # Campus systems sit behind NAT — one IP can represent 50+ students.
    # Override in Railway Variables: LOGIN_RATE_LIMIT=10/minute
    # ----------------------------------------------------------------
    LOGIN_RATE_LIMIT: str = "20/minute"

    # ----------------------------------------------------------------
    # APP INFO
    # ----------------------------------------------------------------
    APP_NAME: str = "Smart College Ecosystem"
    DEBUG: bool = False  # Never True in production

    # ----------------------------------------------------------------
    # COMPUTED PROPERTIES
    # ----------------------------------------------------------------
    @property
    def allowed_origins_list(self) -> list[str]:
        """
        Parses ALLOWED_ORIGINS into a list CORSMiddleware can consume.
        Strips whitespace so "http://a.com, http://b.com" works.
        """
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_local(self) -> bool:
        """True when the database host is localhost — used to skip SSL."""
        url = self.DATABASE_URL
        return "localhost" in url or "127.0.0.1" in url


# Single global instance — import this everywhere:
#   from backend.config.settings import settings
settings = Settings()

# ---------------------------------------------------------------
# MODULE-LEVEL DIAGNOSTICS
# These lines run the instant settings.py is first imported —
# before any engine is created, before lifespan runs.
# They appear at the TOP of Railway deploy logs, making it trivial
# to see which database host the app is targeting.
# ---------------------------------------------------------------
_diag_logger = logging.getLogger("db.config")
_diag_parsed = urllib.parse.urlparse(settings.DATABASE_URL)
_diag_logger.info("=" * 50)
_diag_logger.info("[DB CONFIG] Dialect  : %s", _diag_parsed.scheme or "MISSING")
_diag_logger.info("[DB CONFIG] Host     : %s", _diag_parsed.hostname or "MISSING")
_diag_logger.info("[DB CONFIG] Port     : %s", _diag_parsed.port or "MISSING")
_diag_logger.info("[DB CONFIG] Database : %s", (_diag_parsed.path or "").lstrip("/") or "MISSING")
_diag_logger.info("[DB CONFIG] Is local : %s", settings.is_local)
_diag_logger.info("[DB CONFIG] SSL      : %s", "disabled (local)" if settings.is_local else "sslmode=require")
_diag_logger.info("=" * 50)
