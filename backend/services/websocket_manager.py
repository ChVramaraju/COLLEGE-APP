# =============================================================
# services/websocket_manager.py — WebSocket Connection Manager
# =============================================================
# Manages the lifecycle of all active WebSocket connections and
# provides a bridge between synchronous service code and the
# async WebSocket send API.
#
# DESIGN DECISIONS:
#
#   Multiple connections per user:
#     A user may have the app open in several browser tabs or on
#     multiple devices simultaneously. We store a set of sockets
#     per user_id so every open tab receives the push.
#
#   push_sync() — sync → async bridge:
#     SQLAlchemy services run in ordinary synchronous functions.
#     WebSocket.send_json() is a coroutine and must run on the
#     event loop. push_sync() uses asyncio.run_coroutine_threadsafe
#     (or loop.create_task when called from within the loop) to
#     schedule the async work without blocking the caller.
#
#   Dead socket handling:
#     send_json() raises if the socket is already closed. We catch
#     all exceptions per socket and silently discard dead ones so
#     a broken tab never prevents delivery to healthy connections.
#
#   Thread safety:
#     FastAPI runs on a single-threaded asyncio event loop by
#     default (one Uvicorn worker). The active_connections dict is
#     only mutated from async route handlers (connect/disconnect),
#     which are serialised by the event loop — no lock needed.
#     push_sync() only reads the dict and schedules coroutines;
#     it never mutates the mapping directly.
# =============================================================

import asyncio
import logging
from typing import Dict, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Central registry of active WebSocket connections.

    Attributes:
        active_connections: Maps user_id → set of open WebSocket objects.
        _loop: The running asyncio event loop, set during app startup
               via set_loop(). Required for push_sync() to schedule
               coroutines from synchronous service code.
    """

    def __init__(self) -> None:
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ------------------------------------------------------------------
    # set_loop — called once during lifespan startup
    # ------------------------------------------------------------------
    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """
        Store the running event loop so push_sync() can schedule
        async sends from synchronous service code.

        Called in main.py lifespan startup:
            ws_manager.set_loop(asyncio.get_event_loop())
        """
        self._loop = loop
        logger.debug("WebSocketManager: event loop registered")

    # ------------------------------------------------------------------
    # connect — register a new WebSocket for a user
    # ------------------------------------------------------------------
    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        """
        Accept and register a WebSocket connection for user_id.

        Multiple connections per user are supported — each is added
        to the set so all open tabs receive subsequent pushes.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.debug(
            "WebSocketManager: user %d connected (%d active socket(s))",
            user_id,
            len(self.active_connections[user_id]),
        )

    # ------------------------------------------------------------------
    # disconnect — remove a WebSocket for a user
    # ------------------------------------------------------------------
    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """
        Remove a WebSocket from the registry.

        Called from the finally block of the WS route handler so the
        connection is always cleaned up regardless of how the client
        disconnected (graceful close, network drop, server error).
        """
        sockets = self.active_connections.get(user_id)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                # No more open tabs for this user — remove the key entirely
                del self.active_connections[user_id]
        logger.debug(
            "WebSocketManager: user %d disconnected (%d remaining socket(s))",
            user_id,
            len(self.active_connections.get(user_id, set())),
        )

    # ------------------------------------------------------------------
    # _push_async — internal coroutine that fans out to all sockets
    # ------------------------------------------------------------------
    async def _push_async(self, user_id: int, data: dict) -> None:
        """
        Send data to every open WebSocket for user_id.

        Dead sockets (already closed by the client) raise exceptions
        on send_json(). We catch them individually so one broken tab
        never blocks delivery to the remaining healthy connections.
        The dead socket is silently discarded from the registry.
        """
        sockets = self.active_connections.get(user_id)
        if not sockets:
            return  # User has no open connections — nothing to do

        dead: Set[WebSocket] = set()
        for ws in list(sockets):
            try:
                await ws.send_json(data)
            except Exception as exc:
                logger.debug(
                    "WebSocketManager: send failed for user %d (%s) — marking dead",
                    user_id,
                    exc,
                )
                dead.add(ws)

        # Prune dead sockets discovered during this push
        for ws in dead:
            sockets.discard(ws)
        if not sockets:
            self.active_connections.pop(user_id, None)

    # ------------------------------------------------------------------
    # push_sync — schedule an async push from synchronous service code
    # ------------------------------------------------------------------
    def push_sync(self, user_id: int, data: dict) -> None:
        """
        Schedule a WebSocket push from synchronous (non-async) code.

        SQLAlchemy service functions are plain synchronous functions.
        They cannot await coroutines directly. This method bridges the
        gap by scheduling _push_async() on the stored event loop.

        Two scheduling strategies:
          • If the caller is already running inside the event loop
            (e.g. called from an async context via run_in_executor),
            loop.create_task() is used — fire-and-forget, non-blocking.
          • Otherwise (called from a true sync thread),
            asyncio.run_coroutine_threadsafe() is used to safely hand
            the coroutine to the loop from outside it.

        If no loop has been registered yet (e.g. during unit tests or
        before lifespan startup), the call is silently ignored — push
        failures are always non-critical.
        """
        if self._loop is None or not self.active_connections.get(user_id):
            return  # No loop registered or user has no open connections

        coro = self._push_async(user_id, data)
        try:
            if self._loop.is_running():
                # We are being called from within the event loop thread
                # (e.g. from a sync function invoked via run_in_executor,
                # or directly from a sync route on the same thread).
                # create_task() schedules the coroutine without blocking.
                self._loop.create_task(coro)
            else:
                # Called from a background thread outside the event loop.
                asyncio.run_coroutine_threadsafe(coro, self._loop)
        except Exception as exc:
            logger.debug("WebSocketManager: push_sync scheduling failed: %s", exc)


# ------------------------------------------------------------------
# Module-level singleton — imported by routes and services
# ------------------------------------------------------------------
ws_manager = WebSocketManager()
