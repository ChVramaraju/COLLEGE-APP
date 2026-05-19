// ============================================================
// hooks/useNotifications.ts — Public Notification Hook
// ============================================================
// Thin re-export of the context value.
// Components call useNotifications() — they never import
// the context directly, keeping the API surface clean.
// ============================================================

import { useNotificationContext } from '@/contexts/NotificationContext';
import type { NotificationContextValue } from '@/types/notification';

export function useNotifications(): NotificationContextValue {
  return useNotificationContext();
}
