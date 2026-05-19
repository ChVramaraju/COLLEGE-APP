// ============================================================
// components/notifications/NotificationDropdown.tsx
// ============================================================
// Dropdown panel rendered below the bell button.
// Shows: connection status, mark-all-read, scrollable list.
// ============================================================

import { type JSX, useRef, useEffect, memo } from 'react';
import { Bell, CheckCheck, RefreshCw, Wifi, WifiOff, Radio } from 'lucide-react';
import NotificationItem from '@/components/notifications/NotificationItem';
import type { AppNotification, WsStatus } from '@/types/notification';

function WsStatusPill({ status }: { status: WsStatus }): JSX.Element {
  if (status === 'connected') return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <Wifi className="h-3 w-3" /> Live
    </span>
  );
  if (status === 'polling') return (
    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Radio className="h-3 w-3" /> Polling
    </span>
  );
  if (status === 'connecting' || status === 'disconnected') return (
    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      <WifiOff className="h-3 w-3" />
      {status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
    </span>
  );
  return <></>;
}

interface Props {
  notifications:  AppNotification[];
  unreadCount:    number;
  isLoading:      boolean;
  wsStatus:       WsStatus;
  onMarkRead:     (id: number) => void;
  onMarkAllRead:  () => void;
  onDismiss:      (id: number) => void;
  onRefetch:      () => void;
  onClose:        () => void;
}

function NotificationDropdownInner({
  notifications, unreadCount, isLoading, wsStatus,
  onMarkRead, onMarkAllRead, onDismiss, onRefetch, onClose,
}: Props): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);

  // Trap focus + close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="
        absolute right-0 top-full z-50 mt-2
        w-[22rem] sm:w-96
        overflow-hidden rounded-2xl border border-gray-200
        bg-white shadow-xl
        animate-in fade-in slide-in-from-top-2 duration-150
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gray-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <WsStatusPill status={wsStatus} />
          <button
            onClick={onRefetch}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 focus:outline-none"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 focus:outline-none"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-[28rem] overflow-y-auto">
        {isLoading && notifications.length === 0 ? (
          // Loading skeletons
          <div className="space-y-0 divide-y divide-gray-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center gap-3 py-12">
            <Bell className="h-10 w-10 text-gray-200" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-500">You're all caught up!</p>
            <p className="text-xs text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={onMarkRead}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2 text-center">
          <p className="text-xs text-gray-400">
            Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export const NotificationDropdown = memo(NotificationDropdownInner);
export default NotificationDropdown;
