// ============================================================
// services/notificationService.ts — Notification REST API Layer
// ============================================================
// Uses the shared Axios instance at @/api/client.
// All endpoints map to backend/routes/notification.py.
// ============================================================

import apiClient from '@/api/client';
import type {
  AppNotification,
  NotificationListResponse,
} from '@/types/notification';

// ── Read ──────────────────────────────────────────────────────

export async function getNotifications(
  skip    = 0,
  limit   = 25,
  unreadOnly = false,
): Promise<NotificationListResponse> {
  const res = await apiClient.get<NotificationListResponse>('/notifications/', {
    params: { skip, limit, unread_only: unreadOnly },
  });
  return res.data;
}

export async function getUnreadCount(): Promise<{ unread_count: number }> {
  const res = await apiClient.get<{ unread_count: number }>('/notifications/unread-count');
  return res.data;
}

// ── State mutations ───────────────────────────────────────────

export async function markOneRead(id: number): Promise<AppNotification> {
  const res = await apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllRead(): Promise<{ updated_count: number }> {
  const res = await apiClient.patch<{ updated_count: number }>('/notifications/read-all');
  return res.data;
}

export async function dismissNotification(id: number): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
