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

import os
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
        Normalise the connection URL so SQLAlchemy always receives a
        valid dialect string.

        WHY: Railway (and legacy Heroku) issue URLs that start with
        "postgres://" — the short form that psycopg2 accepts but
        SQLAlchemy 2.x's engine factory rejects with:
            "Could not parse rfc1738 URL from string 'postgres://...'"
        Replacing the prefix with "postgresql://" fixes this silently.
        """
        if isinstance(v, str) and v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
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
