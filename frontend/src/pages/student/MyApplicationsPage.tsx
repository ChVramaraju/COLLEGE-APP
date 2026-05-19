// ============================================================
// pages/student/MyApplicationsPage.tsx
// route: /student/placement/applications
// ============================================================
// Student application tracker — status funnel cards + list.
// ============================================================

import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, ArrowLeft, RefreshCw,
  Building2, IndianRupee, Loader2, RotateCcw,
} from 'lucide-react';
import { useApplications } from '@/hooks/useApplications';
import ApplicationStatusBadge from '@/components/placement/ApplicationStatusBadge';
import type { ApplicationStatus } from '@/types/placement';

const FUNNEL: { status: ApplicationStatus | ''; label: string; bg: string; text: string }[] = [
  { status: '',            label: 'All',         bg: 'bg-gray-100',    text: 'text-gray-700'    },
  { status: 'applied',     label: 'Applied',     bg: 'bg-blue-100',    text: 'text-blue-700'    },
  { status: 'under_review',label: 'In Review',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  { status: 'shortlisted', label: 'Shortlisted', bg: 'bg-purple-100',  text: 'text-purple-700'  },
  { status: 'selected',    label: 'Selected',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { status: 'rejected',    label: 'Rejected',    bg: 'bg-rose-100',    text: 'text-rose-700'    },
];

function formatDate(dt: string | null): string {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MyApplicationsPage(): JSX.Element {
  const {
    filteredApplications, isLoading, error, stats,
    statusFilter, setStatusFilter,
    withdrawingId, withdrawError, withdraw,
    refetch,
  } = useApplications();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {stats.total} application{stats.total !== 1 ? 's' : ''} · {stats.selected} offer{stats.selected !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/student/placement"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Link>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {(error || withdrawError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error ?? withdrawError}
        </div>
      )}

      {/* Funnel filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FUNNEL.map(f => {
          const count =
            f.status === '' ? stats.total :
            f.status === 'applied'      ? stats.applied :
            f.status === 'shortlisted'  ? stats.shortlisted :
            f.status === 'selected'     ? stats.selected :
            f.status === 'rejected'     ? stats.rejected :
            0;
          const active = statusFilter === f.status;
          return (
            <button
              key={f.status}
              onClick={() => setStatusFilter(f.status as ApplicationStatus | '')}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none ${
                active
                  ? `${f.bg} ${f.text} border-transparent`
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? 'bg-white/60' : 'bg-gray-100'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Applications list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <ClipboardList className="h-12 w-12 text-gray-200" aria-hidden="true" />
          <p className="text-lg font-semibold text-gray-500">
            {statusFilter ? 'No applications with this status' : 'No applications yet'}
          </p>
          <Link to="/student/placement" className="text-sm text-indigo-600 underline">
            Browse open positions
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map(app => {
            const canWithdraw = app.status === 'applied' || app.status === 'under_review';
            return (
              <div
                key={app.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${
                  app.status === 'selected' ? 'border-emerald-200 bg-emerald-50/20' :
                  app.status === 'rejected' ? 'border-gray-200 opacity-75' :
                  'border-gray-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                      <Building2 className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{app.company_name ?? 'Company'}</p>
                      <p className="truncate text-sm text-gray-500">{app.role_title ?? 'Role'}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        {app.package_lpa != null && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <IndianRupee className="h-3.5 w-3.5" /> {app.package_lpa} LPA
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          Applied {formatDate(app.applied_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <ApplicationStatusBadge status={app.status} />
                    {canWithdraw && (
                      <button
                        onClick={() => withdraw(app.id)}
                        disabled={withdrawingId === app.id}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-600 transition-colors disabled:opacity-50 focus:outline-none"
                      >
                        {withdrawingId === app.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RotateCcw className="h-3.5 w-3.5" />
                        }
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>

                {/* Remarks */}
                {app.remarks && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700">Admin Note</p>
                    <p className="mt-0.5 text-xs text-amber-800">{app.remarks}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
