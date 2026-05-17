# =============================================================
# config/settings.py — Central Configuration Hub
# =============================================================
# All environment-sensitive settings live here.
# We read from a .env file so secrets are NEVER hardcoded.
# This is a non-negotiable production rule:
#   → Never put passwords or secret keys directly in code.
#   → .env files are added to .gitignore so they never reach GitHub.
# =============================================================

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Build absolute path to .env so it's found no matter where the app is launched from
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")

# override=True ensures .env values always win over any stale system env vars
load_dotenv(_env_path, override=True)


class Settings(BaseSettings):
    # Pydantic v2 style — replaces the old inner `class Config`
    model_config = SettingsConfigDict(
        env_file=_env_path,
        env_file_encoding="utf-8",
        extra="allow",
    )

    # --- Database ---
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/smart_college_db"

    # --- JWT Authentication ---
    # No default — if SECRET_KEY is missing from .env the app refuses to start.
    # A weak or missing secret key means any token can be forged.
    SECRET_KEY: str = "change-this-to-a-long-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # --- CORS ---
    # Comma-separated list of allowed frontend origins.
    #
    # WHY NOT "*"?
    #   The browser CORS spec forbids wildcard origins when the request is
    #   credentialed (carries an Authorization header or cookie).
    #   FastAPI sends back "Access-Control-Allow-Origin: *" which the browser
    #   REJECTS for credentialed requests — your JWT never reaches the API.
    #
    # Development defaults: CRA (3000) + Vite (5173)
    # Production: set ALLOWED_ORIGINS in Railway/Render env vars to your domain.
    #
    # Example .env value:
    #   ALLOWED_ORIGINS=http://localhost:3000,https://myapp.netlify.app
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # --- Rate Limiting ---
    # Login attempts allowed per minute per IP address.
    # Campus systems sit behind NAT: one IP can represent 50+ students.
    # 20/minute = 1200 attempts/hour — still impractical to brute-force
    # a password with uppercase + numbers, but allows normal usage.
    # Override in production .env: LOGIN_RATE_LIMIT=10/minute
    LOGIN_RATE_LIMIT: str = "20/minute"

    # --- App Info ---
    APP_NAME: str = "Smart College Ecosystem"
    # Default False — never expose debug info in production.
    # Override to True in your local .env only.
    DEBUG: bool = False

    @property
    def allowed_origins_list(self) -> list[str]:
        """
        Parses ALLOWED_ORIGINS into a list FastAPI CORSMiddleware can consume.
        Strips whitespace so "http://a.com, http://b.com" works correctly.
        """
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


# Single instance used throughout the entire app.
# Import this wherever you need settings, e.g.:
#   from config.settings import settings
settings = Settings()
