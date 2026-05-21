"""
WebSocket connection manager for real-time notification delivery.

Maintains a mapping of user_id → set of active WebSocket connections.
Multiple tabs/devices per user are supported (one user can have many sockets).

push_sync() bridges sync service code → async WebSocket sends by scheduling
coroutines on the event loop captured during FastAPI lifespan startup.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages per-user WebSocket connections for real-time push."""

    def __init__(self) -> None:
        # user_id → set of active WebSocket connections
        self._connections: Dict[int, Set[WebSocket]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    # -- lifecycle ------------------------------------------------

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Store the running event loop so push_sync() can schedule sends."""
        self._loop = loop

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        """Accept and register a WebSocket connection for a user."""
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.debug("WS connected: user=%s (total=%d)", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket connection for a user."""
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]

    # -- push -----------------------------------------------------

    async def _send(self, user_id: int, data: dict) -> None:
        """Send JSON payload to all connections for a user."""
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            sockets.discard(ws)
        if not sockets:
            self._connections.pop(user_id, None)

    def push_sync(self, user_id: int, data: dict) -> None:
        """
        Fire-and-forget push from synchronous code.

        Schedules the async _send() on the event loop captured at startup.
        Safe to call from SQLAlchemy service functions.
        """
        if self._loop is None or self._loop.is_closed():
            return
        try:
            self._loop.create_task(self._send(user_id, data))
        except RuntimeError:
            pass  # loop not running — ignore silently


# Module-level singleton imported by routes and services
ws_manager = WebSocketManager()
