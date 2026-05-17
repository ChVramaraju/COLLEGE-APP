// ============================================================
// components/dashboard/widgets/NotificationsWidget.tsx
// ============================================================
// Shows: latest 5 notifications + unread badge count.
// Each notification has a type-specific icon + read/unread styling.
//
// Type-to-icon mapping lives HERE (presentation layer), not in
// the hook or service. The hook returns raw types as strings;
// the UI decides what icon to show for each type.
// ============================================================

import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Megaphone,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  Briefcase,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { NotificationItem, NotificationList, NotificationType } from '@/types/dashboard';
import { SkeletonRow } from '@/components/common/SkeletonCard';
import type { JSX } from 'react';

// Map notification type → icon + color
const typeConfig: Record<NotificationType, { Icon: ComponentType<{className?: string}>; color: string; bg: string }> = {
  announcement:     { Icon: Megaphone,      color: 'text-indigo-600', bg: 'bg-indigo-50'   },
  test_result:      { Icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  low_attendance:   { Icon: AlertTriangle,  color: 'text-rose-600',    bg: 'bg-rose-50'    },
  notes_uploaded:   { Icon: FileText,       color: 'text-amber-600',   bg: 'bg-amber-50'   },
  placement_update: { Icon: Briefcase,      color: 'text-purple-600',  bg: 'bg-purple-50'  },
  general:          { Icon: MessageCircle,  color: 'text-blue-600',    bg: 'bg-blue-50'    },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationRow({ item }: { item: NotificationItem }): JSX.Element {
  const cfg = typeConfig[item.notification_type] ?? typeConfig.general;
  const { Icon } = cfg;

  return (
    <div className={`flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-gray-50 ${!item.is_read ? 'bg-indigo-50/30' : ''}`}>
      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${!item.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {item.title}
          </p>
          {!item.is_read && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-600" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.message}</p>
        <p className="mt-0.5 text-xs text-gray-400">{timeAgo(item.created_at)}</p>
      </div>
    </div>
  );
}

interface NotificationsWidgetProps {
  data:      NotificationList | undefined;
  isLoading: boolean;
  error:     string | undefined;
}

export default function NotificationsWidget({
  data,
  isLoading,
  error,
}: NotificationsWidgetProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <Bell className="h-4 w-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
        </div>
        {data && data.unread_count > 0 && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
            {data.unread_count}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-3">
        {isLoading ? (
          <SkeletonRow count={4} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-xs text-gray-400">Notifications unavailable</p>
          </div>
        ) : !data || data.notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">All caught up!</p>
            <p className="text-xs text-gray-400">No new notifications</p>
          </div>
        ) : (
          <div className="space-y-1">
            {data.notifications.map(n => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => navigate('/student/notifications')}
        className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-xs font-medium text-indigo-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        View all notifications <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
