# =============================================================
# middleware/logging.py — Request/Response Logging Middleware
# =============================================================
# WHY IS LOGGING NON-NEGOTIABLE FOR PRODUCTION?
#
# Without logs you cannot answer:
#   - "What endpoint caused the 500 at 2:30 AM?"
#   - "Which student triggered the slow query?"
#   - "How many requests per second is the server handling?"
#   - "Is a specific user being locked out by rate limiting?"
#
# Three layers implemented here:
#
#   1. REQUEST LOGGING   — method, path, status, duration, client IP
#   2. ERROR LOGGING     — full stack traces for unhandled exceptions
#   3. CORRELATION ID    — unique X-Request-ID per request, returned
#                          in response headers, enables tracing a single
#                          request across multiple log lines.
#
# CORRELATION IDs in production:
#   When a user reports "I got an error at 2 PM", you ask them for
#   the X-Request-ID from their browser's network tab. You search
#   logs for that ID and find every log line for that exact request.
#   Without this, finding the right log line in 10K/day is guesswork.
# =============================================================

import time
import uuid
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger("smart_college")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs every HTTP request with:
      - Correlation ID (X-Request-ID header)
      - HTTP method + path
      - Client IP
      - Response status code
      - Request duration in milliseconds
      - Errors with full traceback

    Format example:
      INFO  [req-a3f2] POST /auth/login 200 45ms ip=127.0.0.1
      ERROR [req-b7c1] GET /tests/99/analytics 500 12ms ip=10.0.0.5
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate correlation ID — attach to request state so
        # service functions can log with the same ID if needed.
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
            logger.error(
                f"[req-{request_id}] {request.method} {request.url.path} "
                f"UNHANDLED ERROR {duration_ms}ms ip={client_ip}",
                exc_info=exc,
            )
            raise

        duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
        status_code = response.status_code

        # Use WARNING for 4xx/5xx so errors stand out in log aggregators
        log_fn = logger.warning if status_code >= 400 else logger.info
        log_fn(
            f"[req-{request_id}] {request.method} {request.url.path} "
            f"{status_code} {duration_ms}ms ip={client_ip}"
        )

        # Return the correlation ID in the response so clients can report it
        response.headers["X-Request-ID"] = request_id
        return response
