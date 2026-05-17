# =============================================================
# utils/limiter.py — Application-wide Rate Limiter Instance
# =============================================================
# Defined here (not in main.py) to avoid circular imports.
# main.py imports this to register middleware.
# Route files import this to apply @limiter.limit() decorators.
#
# HOW SLOWAPI WORKS:
#   1. SlowAPIMiddleware (in main.py) intercepts every request.
#   2. For routes decorated with @limiter.limit("N/period"),
#      it checks a counter keyed by (route, client_ip).
#   3. If the counter exceeds N in the period, it raises
#      RateLimitExceeded → app returns HTTP 429.
#   4. Counters are stored in-memory by default (resets on restart).
#      For multi-worker deployments, swap the storage backend to
#      Redis: Limiter(key_func=..., storage_uri="redis://localhost")
# =============================================================

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
