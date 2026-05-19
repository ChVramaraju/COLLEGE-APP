// ============================================================
// pages/admin/AdminPlacementsPage.tsx  — /admin/placement
// ============================================================
// Admin placement dashboard:
//   - Analytics row + funnel
//   - Job postings list with management actions
//   - Quick actions: create job, toggle open/close, view apps
// ============================================================

import { useState, useEffect, useCallback, type JSX } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Briefcase, Plus, RefreshCw, Users, MoreVertical,
  Eye, Pencil, ToggleLeft, ToggleRight, Trash2,
  IndianRupee,
} from 'lucide-react';
import {
  getJobPostings, getPlacementAnalytics,
  updateJobPosting, deleteJobPosting,
} from '@/services/placementService';
import PlacementAnalyticsCards from '@/components/placement/PlacementAnalyticsCards';
import type { JobPosting, PlacementAnalytics } from '@/types/placement';

function formatDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminPlacementsPage(): JSX.Element {
  const navigate = useNavigate();

  const [jobs,      setJobs]      = useState<JobPosting[]>([]);
  const [analytics, setAnalytics] = useState<PlacementAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [anaLoading,setAnaLoading]= useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [fetchKey,  setFetchKey]  = useState(0);
  const [activeMenu,setActiveMenu]= useState<number | null>(null);
  const [deleting,  setDeleting]  = useState<number | null>(null);
  const [toggling,  setToggling]  = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getJobPostings(false)  // false = show ALL (including closed)
      .then(data  => { if (!cancelled) setJobs(data); })
      .catch(e    => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  useEffect(() => {
    let cancelled = false;
    setAnaLoading(true);
    getPlacementAnalytics()
      .then(data  => { if (!cancelled) setAnalytics(data); })
      .catch(() => { /* analytics failure is non-critical */ })
      .finally(() => { if (!cancelled) setAnaLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = useCallback(() => { setFetchKey(k => k + 1); setActiveMenu(null); }, []);

  const toggleOpen = useCallback(async (job: JobPosting) => {
    setToggling(job.id);
    setActiveMenu(null);
    try {
      const updated = await updateJobPosting(job.id, { is_open: !job.is_open });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, ...updated } : j));
    } catch {/* show nothing — non-critical */}
    finally { setToggling(null); }
  }, []);

  const handleDelete = useCallback(async (jobId: number) => {
    if (!confirm('Deactivate this job posting? Applications will be preserved.')) return;
    setDeleting(jobId);
    setActiveMenu(null);
    try {
      await deleteJobPosting(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_active: false, is_open: false } : j));
    } catch { /* soft failure */ }
    finally { setDeleting(null); }
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-rose-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Placement Management</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {jobs.filter(j => j.is_active).length} active · {jobs.length} total postings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            to="/admin/placement/create-job"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Job Posting
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Analytics */}
      {analytics && <PlacementAnalyticsCards analytics={analytics} isLoading={anaLoading} />}
      {anaLoading && !analytics && <PlacementAnalyticsCards analytics={null!} isLoading />}

      {/* Job postings table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">All Job Postings</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{jobs.length}</span>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-5 py-3.5">
                <div className="h-3.5 w-32 rounded bg-gray-200" />
                <div className="h-3.5 flex-1 rounded bg-gray-200" />
                <div className="h-5 w-16 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Briefcase className="h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-500">No job postings yet.</p>
            <Link to="/admin/placement/create-job" className="text-sm text-indigo-600 underline">
              Create the first posting
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Company / Role</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Package</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Deadline</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Apps</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobs.map(job => (
                  <tr key={job.id} className={`hover:bg-gray-50/60 transition-colors ${!job.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{job.company_name}</p>
                      <p className="text-xs text-gray-500">{job.role_title}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-center sm:table-cell">
                      {job.package_lpa != null ? (
                        <span className="flex items-center justify-center gap-0.5 text-xs font-semibold text-emerald-700">
                          <IndianRupee className="h-3 w-3" />{job.package_lpa} LPA
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center text-xs text-gray-500 md:table-cell">
                      {formatDate(job.application_deadline)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/admin/placement/${job.id}/applications`)}
                        className="flex items-center justify-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {job.total_applications ?? 0}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        !job.is_active  ? 'bg-gray-100 text-gray-500' :
                        job.is_open     ? 'bg-emerald-100 text-emerald-700' :
                                          'bg-amber-100 text-amber-700'
                      }`}>
                        {!job.is_active ? 'Inactive' : job.is_open ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative flex items-center justify-center">
                        <button
                          onClick={() => setActiveMenu(activeMenu === job.id ? null : job.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 focus:outline-none"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {activeMenu === job.id && (
                          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                            <button
                              onClick={() => { navigate(`/admin/placement/${job.id}/applications`); setActiveMenu(null); }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Applications
                            </button>
                            <button
                              onClick={() => { navigate(`/admin/placement/${job.id}/edit`); setActiveMenu(null); }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit Posting
                            </button>
                            <button
                              onClick={() => toggleOpen(job)}
                              disabled={toggling === job.id || !job.is_active}
                              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {job.is_open
                                ? <><ToggleRight className="h-3.5 w-3.5 text-amber-500" /> Close Applications</>
                                : <><ToggleLeft className="h-3.5 w-3.5 text-emerald-500" /> Reopen Applications</>
                              }
                            </button>
                            <button
                              onClick={() => handleDelete(job.id)}
                              disabled={deleting === job.id || !job.is_active}
                              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {activeMenu !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} aria-hidden="true" />
      )}
    </div>
  );
}
