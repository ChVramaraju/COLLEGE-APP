// ============================================================
// components/notifications/NotificationBell.tsx
// ============================================================
// Bell button with animated unread badge.
// Toggles the NotificationDropdown on click.
// Click-outside closes the dropdown.
// ============================================================

import { type JSX, useState, useRef, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

export default function NotificationBell(): JSX.Element {
  const {
    notifications, unreadCount, isLoading,
    wsStatus, markRead, markAllRead, dismiss, refetch,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkRead = useCallback((id: number) => {
    markRead(id);
  }, [markRead]);

  const handleMarkAllRead = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  const handleDismiss = useCallback((id: number) => {
    dismiss(id);
  }, [dismiss]);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  const badgeCount = Math.min(unreadCount, 99);
  const hasUnread  = unreadCount > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        {/* Animated unread badge */}
        {hasUnread && (
          <>
            {/* Pulse ring */}
            <span
              className="absolute right-1 top-1 inline-flex h-3 w-3 animate-ping rounded-full bg-indigo-400 opacity-75"
              aria-hidden="true"
            />
            {/* Count badge */}
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          wsStatus={wsStatus}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onDismiss={handleDismiss}
          onRefetch={handleRefetch}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
