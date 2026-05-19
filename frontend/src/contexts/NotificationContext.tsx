// ============================================================
// contexts/NotificationContext.tsx — Unified Notification State
// ============================================================
// Provider hierarchy:  AuthProvider > NotificationProvider > RouterProvider
//
// RESPONSIBILITIES:
//   • Fetch initial notifications + unread count on login
//   • Maintain a WebSocket connection for real-time push
//   • Exponential-backoff reconnect strategy
//   • Polling fallback (every 30 s) after max retries
//   • Optimistic updates for markRead / markAllRead / dismiss
//   • Per-tab deduplication via notification ID Set
//   • Full cleanup on logout (token cleared)
//
// RECONNECT STRATEGY:
//   Attempt: 1   2   3   4    5    6+    > MAX_RETRIES → polling
//   Delay:   1s  2s  4s  8s  16s  30s   every 30 s
// ============================================================

import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback, type ReactNode,
} from 'react';
import { useAuth } from '@/store/authStore';
import {
  getNotifications, getUnreadCount,
  markOneRead as apiMarkOneRead,
  markAllRead as apiMarkAllRead,
  dismissNotification as apiDismiss,
} from '@/services/notificationService';
import type {
  AppNotification, WsStatus, WsIncomingMessage,
  NotificationContextValue,
} from '@/types/notification';

// ── Context ───────────────────────────────────────────────────
const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Constants ─────────────────────────────────────────────────
const BACKOFF_MS     = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const MAX_RETRIES    = 8;
const POLL_INTERVAL  = 30_000;   // 30 s polling fallback
const PING_INTERVAL  = 25_000;   // 25 s keep-alive ping
const MAX_STORED     = 50;       // cap in-memory list to avoid memory leak

// ── WebSocket URL helper ──────────────────────────────────────
function buildWsUrl(token: string): string {
  const apiBase = import.meta.env.VITE_API_URL as string | undefined;
  if (apiBase) {
    return (
      `${apiBase.replace(/^http/, 'ws')}/notifications/ws` +
      `?token=${encodeURIComponent(token)}`
    );
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return (
    `${proto}://${window.location.host}/api/notifications/ws` +
    `?token=${encodeURIComponent(token)}`
  );
}

// ── Provider ──────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(false);
  const [wsStatus,      setWsStatus]      = useState<WsStatus>('idle');

  // Refs: avoid stale-closure issues in callbacks
  const wsRef          = useRef<WebSocket | null>(null);
  const retryCount     = useRef(0);
  const reconnectTimer = useRef<number>(0);
  const pollTimer      = useRef<number>(0);
  const pingTimer      = useRef<number>(0);
  const seenIds        = useRef<Set<number>>(new Set());
  const isUnmounted    = useRef(false);
  const currentToken   = useRef<string | null>(null);

  // ── Fetch initial data via REST ─────────────────────────────
  const fetchInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNotifications(0, MAX_STORED);
      if (isUnmounted.current) return;
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
      seenIds.current = new Set(res.notifications.map(n => n.id));
    } catch {
      // Non-critical — silent fail
    } finally {
      if (!isUnmounted.current) setIsLoading(false);
    }
  }, []);

  const fetchUnreadCountOnly = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      if (!isUnmounted.current) setUnreadCount(res.unread_count);
    } catch {/* silent */}
  }, []);

  // ── Polling fallback ────────────────────────────────────────
  const stopPolling = useCallback(() => {
    window.clearInterval(pollTimer.current);
    pollTimer.current = 0;
  }, []);

  const startPolling = useCallback(() => {
    setWsStatus('polling');
    fetchInitial();   // immediate refresh
    stopPolling();
    pollTimer.current = window.setInterval(fetchUnreadCountOnly, POLL_INTERVAL);
  }, [fetchInitial, fetchUnreadCountOnly, stopPolling]);

  // ── Handle incoming WS notification ────────────────────────
  const handleNewNotification = useCallback((notif: AppNotification) => {
    if (seenIds.current.has(notif.id)) return;  // deduplicate
    seenIds.current.add(notif.id);
    setNotifications(prev => [notif, ...prev].slice(0, MAX_STORED));
    if (!notif.is_read) setUnreadCount(c => c + 1);
  }, []);

  // ── WebSocket connect ───────────────────────────────────────
  const connectWs = useCallback((tkn: string) => {
    if (isUnmounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('connecting');
    const url = buildWsUrl(tkn);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect(tkn);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmounted.current) { ws.close(); return; }
      retryCount.current = 0;
      setWsStatus('connected');

      // Heartbeat ping every 25 s
      window.clearInterval(pingTimer.current);
      pingTimer.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (ev: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(ev.data) as WsIncomingMessage;
        if (msg.type === 'notification') handleNewNotification(msg.data);
      } catch {/* ignore malformed */}
    };

    ws.onclose = () => {
      window.clearInterval(pingTimer.current);
      if (isUnmounted.current) return;
      setWsStatus('disconnected');
      scheduleReconnect(tkn);
    };

    ws.onerror = () => {
      ws.close();  // onclose handles reconnect
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNewNotification]);

  // ── Reconnect scheduler ─────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function scheduleReconnect(tkn: string) {
    if (isUnmounted.current) return;
    if (retryCount.current >= MAX_RETRIES) {
      startPolling();
      return;
    }
    const delay = BACKOFF_MS[Math.min(retryCount.current, BACKOFF_MS.length - 1)];
    window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = window.setTimeout(() => {
      if (!isUnmounted.current) {
        retryCount.current++;
        connectWs(tkn);
      }
    }, delay);
  }

  // ── Full cleanup ────────────────────────────────────────────
  const cleanup = useCallback(() => {
    window.clearTimeout(reconnectTimer.current);
    window.clearInterval(pollTimer.current);
    window.clearInterval(pingTimer.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;  // Prevent reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
    retryCount.current = 0;
    setWsStatus('idle');
  }, []);

  // ── Auth-driven effect (mount / login / logout) ─────────────
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !token) {
      cleanup();
      setNotifications([]);
      setUnreadCount(0);
      seenIds.current.clear();
      return;
    }

    currentToken.current = token;
    fetchInitial();
    connectWs(token);

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, authLoading]);

  // ── Unmount cleanup ─────────────────────────────────────────
  useEffect(() => {
    isUnmounted.current = false;
    return () => { isUnmounted.current = true; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public actions (all optimistic) ─────────────────────────
  const markRead = useCallback((id: number) => {
    setNotifications(prev =>
      prev.map(n => n.id === id && !n.is_read ? { ...n, is_read: true } : n),
    );
    setUnreadCount(c => Math.max(0, c - 1));
    apiMarkOneRead(id).catch(() => {
      // Rollback on failure
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: false } : n),
      );
      setUnreadCount(c => c + 1);
    });
  }, []);

  const markAllRead = useCallback(() => {
    const prevNotifs = notifications;
    const prevCount  = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    apiMarkAllRead().catch(() => {
      setNotifications(prevNotifs);
      setUnreadCount(prevCount);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, unreadCount]);

  const dismiss = useCallback((id: number) => {
    const prev = notifications;
    const dismissed = notifications.find(n => n.id === id);
    setNotifications(p => p.filter(n => n.id !== id));
    if (dismissed && !dismissed.is_read) setUnreadCount(c => Math.max(0, c - 1));
    apiDismiss(id).catch(() => {
      setNotifications(prev);
      if (dismissed && !dismissed.is_read) setUnreadCount(c => c + 1);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const refetch = useCallback(() => {
    seenIds.current.clear();
    fetchInitial();
  }, [fetchInitial]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, isLoading, wsStatus,
      markRead, markAllRead, dismiss, refetch,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Internal hook (used by useNotifications.ts) ───────────────
export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used inside NotificationProvider');
  return ctx;
}
