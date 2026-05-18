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

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger("smart_college")


class RequestLoggingMiddleware:
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

    IMPLEMENTATION NOTE — WHY NOT BaseHTTPMiddleware:
    ─────────────────────────────────────────────────
    BaseHTTPMiddleware (Starlette) wraps the ASGI `receive` channel
    inside an anyio TaskGroup and delivers the request body through
    an internal asyncio Queue.

    For multipart/form-data file uploads the queue fills with the
    text fields first (title, subject, etc.), then the binary file
    data arrives in subsequent chunks. If the file is large enough
    to exceed the queue's internal buffer, trailing body chunks are
    SILENTLY DROPPED. The route handler then calls `await file.read()`
    and receives only the buffered portion — corrupting or truncating
    the uploaded file.

    This middleware does NOT need to inspect the request body at all,
    so pure ASGI is the correct and safe choice:

      Pure ASGI:            scope/receive/send passed through as-is
      BaseHTTPMiddleware:   wraps receive in a Queue (body truncation risk)

    The only thing we wrap is `send`, and only to capture the HTTP
    status code from the `http.response.start` ASGI message and to
    append the X-Request-ID response header — both zero-copy operations.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only instrument HTTP requests. Pass WebSocket/lifespan through unchanged.
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())[:8]

        # Attach to scope state so route handlers and exception handlers can
        # access via `request.state["request_id"]`.
        # In pure ASGI, scope["state"] is a plain dict (not a State object).
        # setdefault is safe: it only writes if the key is absent, preserving
        # any dict already placed by an outer middleware or Starlette's Router.
        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id

        start_time  = time.perf_counter()
        client_info = scope.get("client")
        client_ip   = client_info[0] if client_info else "unknown"
        method      = scope.get("method", "UNKNOWN")
        path        = scope.get("path", "/")

        status_code = 500   # defensive default — overwritten by send_wrapper

        async def send_wrapper(message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                # Append X-Request-ID to the response headers.
                # MutableHeaders(scope=message) mutates the headers list
                # inside the ASGI message dict in-place — zero-copy.
                headers = MutableHeaders(scope=message)
                headers.append("X-Request-ID", request_id)
            await send(message)

        try:
            # receive is passed through UNMODIFIED — the body stream is
            # never buffered, queued, or touched by this middleware.
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
            logger.error(
                f"[req-{request_id}] {method} {path} "
                f"UNHANDLED ERROR {duration_ms}ms ip={client_ip}",
                exc_info=exc,
            )
            raise

        duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
        log_fn = logger.warning if status_code >= 400 else logger.info
        log_fn(
            f"[req-{request_id}] {method} {path} "
            f"{status_code} {duration_ms}ms ip={client_ip}"
        )
