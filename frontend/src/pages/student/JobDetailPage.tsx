// ============================================================
// pages/student/JobDetailPage.tsx   — /student/placement/:jobId
// ============================================================
// Full detail view for one job posting.
// Shows eligibility breakdown, apply/status panel.
// ============================================================

import { useState, useEffect, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, IndianRupee, CalendarClock,
  CheckCircle2, XCircle, Loader2, Users,
} from 'lucide-react';
import { getJobPosting, applyToJob, getMyApplications } from '@/services/placementService';
import ApplicationStatusBadge from '@/components/placement/ApplicationStatusBadge';
import type { JobPosting, PlacementApplication } from '@/types/placement';

function CriteriaRow({ label, met, value }: { label: string; met: boolean; value: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      {met
        ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" aria-hidden="true" />
        : <XCircle     className="h-4 w-4 flex-shrink-0 text-rose-500"    aria-hidden="true" />
      }
      <span className={`text-sm ${met ? 'text-gray-700' : 'text-rose-700'}`}>
        <span className="font-medium">{label}:</span> {value}
      </span>
    </div>
  );
}

export default function JobDetailPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();
  const id        = Number(jobId);

  const [job,        setJob]        = useState<JobPosting | null>(null);
  const [existingApp,setExistingApp]= useState<PlacementApplication | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [applying,   setApplying]   = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied,    setApplied]    = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getJobPosting(id), getMyApplications()])
      .then(([posting, apps]) => {
        setJob(posting);
        const existing = apps.find(a => a.job_posting_id === id) ?? null;
        setExistingApp(existing);
        if (existing) setApplied(true);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleApply = async () => {
    if (!job) return;
    setApplying(true);
    setApplyError(null);
    try {
      const app = await applyToJob(job.id);
      setExistingApp(app);
      setApplied(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message
        : (typeof e === 'object' && e !== null && 'response' in e)
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Failed to apply.'
          : 'Failed to apply.';
      setApplyError(msg);
    } finally {
      setApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden="true" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-rose-600">{error ?? 'Job not found.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 underline text-sm">Go back</button>
      </div>
    );
  }

  const isClosed   = !job.is_open;
  const isNotElig  = job.is_eligible === false;
  const deptList   = job.allowed_departments
    ? job.allowed_departments.split(',').map(d => d.trim().toUpperCase()).join(', ')
    : 'All departments';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/student/placement')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to placement portal
      </button>

      {/* Company header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
            <Building2 className="h-7 w-7 text-indigo-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">{job.company_name}</h1>
            <p className="text-base text-gray-600">{job.role_title}</p>

            {/* Meta */}
            <div className="mt-3 flex flex-wrap gap-3">
              {job.package_lpa != null && (
                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                  <IndianRupee className="h-4 w-4" /> ₹{job.package_lpa} LPA
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" /> {job.location}
                </span>
              )}
              {job.application_deadline && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <CalendarClock className="h-4 w-4" />
                  Deadline: {new Date(job.application_deadline).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
              )}
              {job.total_applications != null && (
                <span className="flex items-center gap-1 text-sm text-gray-400">
                  <Users className="h-4 w-4" /> {job.total_applications} applicants
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* Left: Description + eligibility */}
        <div className="space-y-4">
          {/* Description */}
          {job.description && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">About the Role</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{job.description}</p>
            </div>
          )}

          {/* Eligibility panel */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-800">Eligibility Criteria</h2>
            <div className="space-y-3">
              <CriteriaRow
                label="Department"
                met={job.is_eligible !== false}
                value={deptList}
              />
              <CriteriaRow
                label="Min CGPA"
                met={job.is_eligible !== false}
                value={job.min_cgpa > 0 ? `${job.min_cgpa} / 10.0` : 'No minimum'}
              />
              <CriteriaRow
                label="Min Attendance"
                met={job.is_eligible !== false}
                value={job.min_attendance_pct > 0 ? `${job.min_attendance_pct}%` : 'No minimum'}
              />
            </div>
          </div>
        </div>

        {/* Right: Apply panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-800">Application</h2>

            {existingApp && applied ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">You have applied to this position.</p>
                <ApplicationStatusBadge status={existingApp.status} />
                {existingApp.remarks && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Admin Note</p>
                    <p className="text-xs text-amber-800">{existingApp.remarks}</p>
                  </div>
                )}
              </div>
            ) : isClosed ? (
              <p className="text-sm text-gray-500">This position is no longer accepting applications.</p>
            ) : isNotElig ? (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-sm font-semibold text-rose-700 mb-1">Not Eligible</p>
                <p className="text-xs text-rose-600">
                  You do not meet the eligibility criteria for this posting. Check your CGPA, attendance, or department requirements.
                </p>
              </div>
            ) : (
              <>
                {applyError && (
                  <p className="mb-3 text-xs text-rose-600">{applyError}</p>
                )}
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  {applying
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                    : 'Apply Now'
                  }
                </button>
                <p className="mt-2 text-center text-xs text-gray-400">
                  You can withdraw before shortlisting
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
