// ============================================================
// types/notification.ts — Notification Module Type Contracts
// ============================================================
// Mirrors backend schemas/notification.py exactly.
// These are the canonical types used by NotificationContext,
// useNotifications, and all notification components.
// ============================================================

// ── Enum ─────────────────────────────────────────────────────
export type NotificationType =
  | 'announcement'
  | 'test_result'
  | 'low_attendance'
  | 'notes_uploaded'
  | 'placement_update'
  | 'general';

// ── Single notification (mirrors NotificationResponse) ───────
export interface AppNotification {
  id:                number;
  title:             string;
  message:           string;
  notification_type: NotificationType;
  is_read:           boolean;
  is_broadcast:      boolean;
  read_at:           string | null;  // ISO datetime
  created_at:        string | null;
  sender_name:       string | null;
}

// ── Paginated inbox (mirrors NotificationListResponse) ───────
export interface NotificationListResponse {
  total:         number;
  unread_count:  number;
  notifications: AppNotification[];
}

// ── WebSocket message shapes ──────────────────────────────────
export type WsIncomingMessage =
  | { type: 'connected'; user_id: number }
  | { type: 'pong' }
  | { type: 'notification'; data: AppNotification };

export type WsOutgoingMessage =
  | { type: 'ping' };

// ── WebSocket connection status ───────────────────────────────
export type WsStatus =
  | 'idle'          // not yet attempted
  | 'connecting'    // new WebSocket() called, not yet open
  | 'connected'     // onopen fired
  | 'disconnected'  // onclose fired, reconnect scheduled
  | 'polling';      // max retries exceeded, using REST poll

// ── Context value surface ─────────────────────────────────────
export interface NotificationContextValue {
  notifications:  AppNotification[];
  unreadCount:    number;
  isLoading:      boolean;
  wsStatus:       WsStatus;
  markRead:       (id: number) => void;
  markAllRead:    () => void;
  dismiss:        (id: number) => void;
  refetch:        () => void;
}
