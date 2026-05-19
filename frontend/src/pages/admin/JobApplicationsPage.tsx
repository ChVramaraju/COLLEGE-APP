// ============================================================
// pages/admin/JobApplicationsPage.tsx
// route: /admin/placement/:jobId/applications
// ============================================================
// Manage all applications for a single job posting.
// Features: filter by status, inline status update with remarks,
// bulk shortlist/reject, student details.
// ============================================================

import { useState, useEffect, useCallback, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, RefreshCw, ChevronDown, Loader2,
  CheckCircle2, XCircle, Star, Clock, Eye,
} from 'lucide-react';
import {
  getJobApplications, getJobPosting,
  updateApplicationStatus, deleteApplication,
} from '@/services/placementService';
import ApplicationStatusBadge from '@/components/placement/ApplicationStatusBadge';
import type { PlacementApplication, JobPosting, ApplicationStatus } from '@/types/placement';

const STATUSES: { value: ApplicationStatus | ''; label: string }[] = [
  { value: '',            label: 'All'         },
  { value: 'applied',     label: 'Applied'     },
  { value: 'under_review',label: 'In Review'   },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'selected',    label: 'Selected'    },
  { value: 'rejected',    label: 'Rejected'    },
];

const NEXT_STATUSES: { value: ApplicationStatus; label: string; color: string; icon: typeof CheckCircle2 }[] = [
  { value: 'under_review', label: 'Mark In Review',  color: 'text-amber-600',   icon: Clock        },
  { value: 'shortlisted',  label: 'Shortlist',       color: 'text-purple-600',  icon: Star         },
  { value: 'selected',     label: 'Select (Offer)',  color: 'text-emerald-600', icon: CheckCircle2 },
  { value: 'rejected',     label: 'Reject',          color: 'text-rose-600',    icon: XCircle      },
];

function formatDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface InlineRemarksProps {
  onConfirm: (remarks: string) => void;
  onCancel: () => void;
  statusLabel: string;
}
function InlineRemarks({ onConfirm, onCancel, statusLabel }: InlineRemarksProps): JSX.Element {
  const [remarks, setRemarks] = useState('');
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-xs font-semibold text-indigo-700">Add note for "{statusLabel}" (optional)</p>
      <textarea
        rows={2}
        value={remarks}
        onChange={e => setRemarks(e.target.value)}
        placeholder="e.g. Interview scheduled for 15-Jun"
        className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(remarks)}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function JobApplicationsPage(): JSX.Element {
  const { jobId }  = useParams<{ jobId: string }>();
  const navigate   = useNavigate();
  const id         = Number(jobId);

  const [job,         setJob]          = useState<JobPosting | null>(null);
  const [apps,        setApps]         = useState<PlacementApplication[]>([]);
  const [isLoading,   setIsLoading]    = useState(true);
  const [error,       setError]        = useState<string | null>(null);
  const [fetchKey,    setFetchKey]     = useState(0);
  const [statusFilter,setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [updating,    setUpdating]     = useState<number | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    appId: number; status: ApplicationStatus; label: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([
      getJobPosting(id),
      getJobApplications(id, statusFilter || undefined),
    ])
      .then(([posting, applications]) => {
        if (cancelled) return;
        setJob(posting);
        setApps(applications);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id, statusFilter, fetchKey]);

  const refetch = useCallback(() => { setFetchKey(k => k + 1); setPendingChange(null); }, []);

  const confirmStatusChange = useCallback(async (remarks: string) => {
    if (!pendingChange) return;
    const { appId, status } = pendingChange;
    setPendingChange(null);
    setUpdating(appId);
    try {
      const updated = await updateApplicationStatus(appId, status, remarks || null);
      setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updated } : a));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setUpdating(null);
    }
  }, [pendingChange]);

  const handleDelete = useCallback(async (appId: number) => {
    if (!confirm('Delete this application permanently?')) return;
    setUpdating(appId);
    try {
      await deleteApplication(appId);
      setApps(prev => prev.filter(a => a.id !== appId));
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  }, []);

  const selectedCount    = apps.filter(a => a.status === 'selected').length;
  const shortlistedCount = apps.filter(a => a.status === 'shortlisted').length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/placement')}
            className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Applications{job ? ` — ${job.company_name}` : ''}
              </h1>
              {job && <p className="text-xs text-gray-500">{job.role_title}</p>}
            </div>
          </div>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Mini stats */}
      {!isLoading && (
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Total', value: apps.length, color: 'text-gray-700' },
            { label: 'Shortlisted', value: shortlistedCount, color: 'text-purple-700' },
            { label: 'Selected', value: selectedCount, color: 'text-emerald-700' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <p className={`text-xl font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value as ApplicationStatus | '')}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none ${
              statusFilter === s.value
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Applications list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-500">No applications yet for this posting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map(app => (
            <div key={app.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Student info */}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {app.student_name ?? `Student #${app.student_id}`}
                  </p>
                  {app.roll_number && (
                    <p className="text-xs text-gray-500">Roll: {app.roll_number}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Applied {formatDate(app.applied_at)}</p>
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <ApplicationStatusBadge status={app.status} />
                  {updating === app.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  )}
                </div>
              </div>

              {/* Remarks */}
              {app.remarks && (
                <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-600 italic">"{app.remarks}"</p>
                </div>
              )}

              {/* Pending confirmation */}
              {pendingChange?.appId === app.id && (
                <InlineRemarks
                  statusLabel={NEXT_STATUSES.find(s => s.value === pendingChange.status)?.label ?? ''}
                  onConfirm={confirmStatusChange}
                  onCancel={() => setPendingChange(null)}
                />
              )}

              {/* Status action buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                {NEXT_STATUSES.map(ns => (
                  ns.value === app.status ? null : (
                    <button
                      key={ns.value}
                      onClick={() => setPendingChange({ appId: app.id, status: ns.value, label: ns.label })}
                      disabled={updating === app.id}
                      className={`flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-50 focus:outline-none ${ns.color}`}
                    >
                      <ns.icon className="h-3.5 w-3.5" />
                      {ns.label}
                    </button>
                  )
                ))}
                <button
                  onClick={() => handleDelete(app.id)}
                  disabled={updating === app.id}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-300 hover:text-rose-500 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
