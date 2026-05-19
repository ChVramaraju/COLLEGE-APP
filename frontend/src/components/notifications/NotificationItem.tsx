// ============================================================
// components/notifications/NotificationItem.tsx
// ============================================================
// Single notification row inside the dropdown.
// Handles: type icon, read/unread styling, time-ago, dismiss.
// ============================================================

import { type JSX, type ComponentType, memo } from 'react';
import {
  Megaphone, ClipboardCheck, AlertTriangle,
  FileText, Briefcase, MessageCircle, X,
} from 'lucide-react';
import type { AppNotification, NotificationType } from '@/types/notification';

// ── Type → visual mapping ────────────────────────────────────
const TYPE_CFG: Record<
  NotificationType,
  { Icon: ComponentType<{ className?: string }>; iconBg: string; iconColor: string }
> = {
  announcement:     { Icon: Megaphone,      iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600'  },
  test_result:      { Icon: ClipboardCheck, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  low_attendance:   { Icon: AlertTriangle,  iconBg: 'bg-rose-100',    iconColor: 'text-rose-600'    },
  notes_uploaded:   { Icon: FileText,       iconBg: 'bg-amber-100',   iconColor: 'text-amber-600'   },
  placement_update: { Icon: Briefcase,      iconBg: 'bg-purple-100',  iconColor: 'text-purple-600'  },
  general:          { Icon: MessageCircle,  iconBg: 'bg-blue-100',    iconColor: 'text-blue-600'    },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface Props {
  notification: AppNotification;
  onMarkRead:   (id: number) => void;
  onDismiss:    (id: number) => void;
}

function NotificationItemInner({ notification: n, onMarkRead, onDismiss }: Props): JSX.Element {
  const cfg = TYPE_CFG[n.notification_type] ?? TYPE_CFG.general;
  const { Icon } = cfg;

  const handleClick = () => {
    if (!n.is_read) onMarkRead(n.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      className={`group relative flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 ${
        !n.is_read ? 'bg-indigo-50/40' : ''
      }`}
    >
      {/* Unread dot */}
      {!n.is_read && (
        <span
          className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-indigo-500"
          aria-label="Unread"
        />
      )}

      {/* Type icon */}
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}>
        <Icon className={`h-4 w-4 ${cfg.iconColor}`} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 leading-snug">
          {n.message}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
          {n.sender_name && (
            <span className="text-xs text-gray-400">· from {n.sender_name}</span>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(n.id); }}
        className="flex-shrink-0 rounded-lg p-1 text-gray-300 opacity-0 transition-opacity hover:text-gray-500 group-hover:opacity-100 focus:outline-none focus-visible:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export const NotificationItem = memo(NotificationItemInner);
export default NotificationItem;
