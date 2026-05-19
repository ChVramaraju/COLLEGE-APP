// ============================================================
// pages/admin/SystemHealthPage.tsx — Live Infrastructure Monitor
// ============================================================

import { type JSX } from 'react';
import {
  Wifi, Database, FileUp, Bell, CalendarCheck, ClipboardList,
  RefreshCw, Building2, Users, Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { SystemHealth } from '@/types/admin';

interface MetricRowProps {
  label:   string;
  value:   string | number;
  sub?:    string;
  Icon:    LucideIcon;
  status?: 'ok' | 'warn' | 'error';
}

function MetricRow({ label, value, sub, Icon, status = 'ok' }: MetricRowProps): JSX.Element {
  const dot = status === 'ok'    ? 'bg-emerald-500' :
              status === 'warn'  ? 'bg-amber-500'   : 'bg-rose-500';
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4.5 w-4.5 text-gray-400 h-[18px] w-[18px]" />
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-bold text-gray-900 tabular-nums">{value}</span>
      </div>
    </div>
  );
}

function wsStatus(n: number): 'ok' | 'warn' | 'error' {
  if (n === 0) return 'warn';
  return 'ok';
}

function derivedRows(h: SystemHealth): MetricRowProps[] {
  return [
    {
      label:  'WebSocket Connections',
      value:  h.ws_connections,
      sub:    'Live browser tabs connected',
      Icon:   Wifi,
      status: wsStatus(h.ws_connections),
    },
    {
      label:  'Total Users',
      value:  h.total_users,
      sub:    `${h.active_students} students · ${h.active_faculty} faculty`,
      Icon:   Users,
      status: 'ok',
    },
    {
      label:  'Active Students',
      value:  h.active_students,
      sub:    'Non-deactivated student accounts',
      Icon:   Users,
      status: 'ok',
    },
    {
      label:  'Active Faculty',
      value:  h.active_faculty,
      sub:    'Non-deactivated faculty accounts',
      Icon:   Users,
      status: 'ok',
    },
    {
      label:  'Total Sections',
      value:  h.total_sections,
      sub:    'Academic sections in the system',
      Icon:   Building2,
      status: h.total_sections > 0 ? 'ok' : 'warn',
    },
    {
      label:  'Files Uploaded',
      value:  h.total_files_uploaded,
      sub:    'Total notes & documents stored',
      Icon:   FileUp,
      status: 'ok',
    },
    {
      label:  'Attendance Records',
      value:  h.total_attendance_records,
      sub:    'All-time attendance entries',
      Icon:   CalendarCheck,
      status: 'ok',
    },
    {
      label:  'Test Attempts',
      value:  h.total_test_attempts,
      sub:    'Submitted exam attempts',
      Icon:   ClipboardList,
      status: 'ok',
    },
    {
      label:  'Notifications Sent',
      value:  h.total_notifications_sent,
      sub:    'All-time (non-deleted)',
      Icon:   Bell,
      status: 'ok',
    },
  ];
}

export default function SystemHealthPage(): JSX.Element {
  const { health, isLoading, lastUpdated, error } = useSystemHealth();

  const overallStatus =
    !health        ? 'unknown'   :
    health.ws_connections > 0  ? 'healthy'   : 'degraded';

  const statusBadge = {
    healthy:  'bg-emerald-100 text-emerald-700',
    degraded: 'bg-amber-100 text-amber-700',
    unknown:  'bg-gray-100 text-gray-500',
  }[overallStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
          <p className="mt-1 text-sm text-gray-500">
            Live infrastructure snapshot · auto-refreshes every 15 s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadge}`}>
            <span className={`h-2 w-2 rounded-full ${
              overallStatus === 'healthy' ? 'bg-emerald-500 animate-pulse' :
              overallStatus === 'degraded' ? 'bg-amber-500' : 'bg-gray-400'
            }`} />
            {overallStatus === 'healthy' ? 'All Systems Operational' :
             overallStatus === 'degraded' ? 'Degraded' : 'Unknown'}
          </span>
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
      </div>

      {lastUpdated && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Metric grid */}
      {isLoading && !health ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : health ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <Wifi className="mb-2 h-6 w-6 text-emerald-600" />
              <p className="text-3xl font-bold text-emerald-700">{health.ws_connections}</p>
              <p className="text-sm font-semibold text-emerald-600">Live Connections</p>
              <p className="mt-0.5 text-xs text-emerald-500">Active WebSocket sessions</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <Database className="mb-2 h-6 w-6 text-indigo-600" />
              <p className="text-3xl font-bold text-indigo-700">{health.total_users}</p>
              <p className="text-sm font-semibold text-indigo-600">Total Users</p>
              <p className="mt-0.5 text-xs text-indigo-400">Registered accounts</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <Bell className="mb-2 h-6 w-6 text-amber-600" />
              <p className="text-3xl font-bold text-amber-700">{health.total_notifications_sent}</p>
              <p className="text-sm font-semibold text-amber-600">Notifications</p>
              <p className="mt-0.5 text-xs text-amber-400">Total sent (all time)</p>
            </div>
          </div>

          {/* Detail rows */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-800">Infrastructure Metrics</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {derivedRows(health).map(row => (
                <MetricRow key={row.label} {...row} />
              ))}
            </div>
          </div>

          {/* Generated at */}
          <p className="text-right text-xs text-gray-400">
            Snapshot generated: {new Date(health.generated_at).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  );
}
