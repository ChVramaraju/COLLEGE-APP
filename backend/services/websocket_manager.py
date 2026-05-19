# =============================================================
# services/websocket_manager.py — WebSocket Connection Registry
# =============================================================
# Manages the in-memory pool of active WebSocket connections.
# Supports multi-tab: one user can have N connections open.
#
# THREAD-SAFETY:
#   send_to_user() is an async coroutine → runs in the event loop.
#   push_sync() bridges from synchronous service code (thread pool)
#   to the async event loop using run_coroutine_threadsafe().
#
# MULTI-WORKER NOTE:
#   This in-memory dict is per-process.
#   In a multi-worker (Gunicorn) deployment, each worker has its
#   own dict. A WS connection established to Worker-1 is invisible
#   to Worker-2. For production multi-worker setups, replace
#   push_sync/send_to_user with a Redis Pub/Sub layer.
#   For single-worker deployments (Railway, Render default), this
#   works perfectly.
# =============================================================

import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    In-memory registry of active WebSocket connections.

    STRUCTURE:
        _connections: { user_id: [WebSocket, WebSocket, ...] }

    One user_id can have multiple WebSockets (multiple browser tabs).
    Each tab's WebSocket is stored separately in the list.
    Dead connections are pruned lazily on the next send attempt.
    """

    def __init__(self) -> None:
        self._connections: Dict[int, List[WebSocket]] = defaultdict(list)
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ---------------------------------------------------------------
    # LIFECYCLE SETUP
    # ---------------------------------------------------------------

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """
        Store a reference to the main event loop.
        Called once from the FastAPI lifespan on startup.
        Required for push_sync() to work from thread-pool code.
        """
        self._loop = loop
        logger.info("WebSocketManager: event loop registered.")

    # ---------------------------------------------------------------
    # CONNECTION MANAGEMENT
    # ---------------------------------------------------------------

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        """Accept and register a WebSocket for a user."""
        await websocket.accept()
        self._connections[user_id].append(websocket)
        logger.info(
            f"WS connected: user_id={user_id} | "
            f"tabs={len(self._connections[user_id])} | "
            f"total_connections={self.connection_count()}"
        )

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket from the registry (called on close/error)."""
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)
        logger.info(
            f"WS disconnected: user_id={user_id} | "
            f"total_connections={self.connection_count()}"
        )

    def connection_count(self) -> int:
        """Total open WebSocket connections across all users."""
        return sum(len(c) for c in self._connections.values())

    def is_user_connected(self, user_id: int) -> bool:
        """True if the user has at least one active WebSocket."""
        return bool(self._connections.get(user_id))

    # ---------------------------------------------------------------
    # ASYNC SEND (called from async routes/handlers)
    # ---------------------------------------------------------------

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        """
        Push a JSON payload to ALL open tabs for a user.
        Dead connections are removed from the registry automatically.
        """
        conns = list(self._connections.get(user_id, []))
        if not conns:
            return

        dead: List[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast_to_all(self, payload: dict) -> None:
        """Push a payload to every connected user (admin broadcasts)."""
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, payload)

    # ---------------------------------------------------------------
    # SYNC PUSH (called from synchronous service/route code)
    # ---------------------------------------------------------------

    def push_sync(self, user_id: int, payload: dict) -> None:
        """
        Schedule a WebSocket push from SYNCHRONOUS code.

        FastAPI runs synchronous route handlers in a thread pool.
        That thread has no event loop, so we can't await coroutines.
        run_coroutine_threadsafe() safely bridges the two worlds:
        it submits the coroutine to the main event loop's queue and
        returns a Future. We don't await it — fire and forget.

        SAFETY: if the event loop hasn't been set (shouldn't happen),
        or if the user has no open connections, we skip silently.
        """
        if self._loop is None:
            return
        if not self.is_user_connected(user_id):
            return
        try:
            asyncio.run_coroutine_threadsafe(
                self.send_to_user(user_id, payload),
                self._loop,
            )
        except Exception as exc:
            logger.debug(f"WS push_sync failed for user {user_id}: {exc}")


# ---------------------------------------------------------------
# SINGLETON — shared across ALL requests in this process
# ---------------------------------------------------------------
ws_manager = WebSocketManager()
