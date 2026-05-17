// ============================================================
// components/dashboard/widgets/PlacementWidget.tsx
// ============================================================
// Shows: active job postings (with eligibility flag) + student's
// application statuses.
//
// is_eligible is computed by the backend per-student:
//   → checks student's cgpa >= min_cgpa
//   → checks student's attendance >= min_attendance_pct
//   The frontend just renders it — no re-computation needed.
//
// The status pill colors match the ApplicationStatus enum:
//   applied → blue, under_review → amber, shortlisted → purple,
//   selected → green, rejected → red, withdrawn → gray
// ============================================================

import { useNavigate } from 'react-router-dom';
import { Briefcase, CheckCircle2, XCircle, AlertCircle, ArrowRight, Building2 } from 'lucide-react';
import type { JobPosting, PlacementApplication, ApplicationStatus } from '@/types/dashboard';
import { SkeletonRow } from '@/components/common/SkeletonCard';
import type { JSX } from 'react';

const appStatusConfig: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  applied:      { label: 'Applied',      color: 'text-blue-700',    bg: 'bg-blue-100'    },
  under_review: { label: 'In Review',    color: 'text-amber-700',   bg: 'bg-amber-100'   },
  shortlisted:  { label: 'Shortlisted',  color: 'text-purple-700',  bg: 'bg-purple-100'  },
  selected:     { label: 'Selected 🎉',  color: 'text-emerald-700', bg: 'bg-emerald-100' },
  rejected:     { label: 'Rejected',     color: 'text-rose-700',    bg: 'bg-rose-100'    },
  withdrawn:    { label: 'Withdrawn',    color: 'text-gray-600',    bg: 'bg-gray-100'    },
};

function PostingRow({ job, onApply }: { job: JobPosting; onApply: () => void }): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-50">
        <Building2 className="h-4 w-4 text-rose-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{job.company_name}</p>
        <p className="truncate text-xs text-gray-500">{job.role_title}</p>
        <div className="mt-1 flex items-center gap-2">
          {job.package_lpa && (
            <span className="text-xs font-semibold text-emerald-600">₹{job.package_lpa} LPA</span>
          )}
          {job.is_eligible === false && (
            <span className="flex items-center gap-0.5 text-xs text-rose-500">
              <XCircle className="h-3 w-3" /> Not eligible
            </span>
          )}
          {job.is_eligible === true && (
            <span className="flex items-center gap-0.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Eligible
            </span>
          )}
        </div>
      </div>
      {job.is_eligible && job.is_open && (
        <button
          onClick={onApply}
          className="flex-shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Apply
        </button>
      )}
    </div>
  );
}

function AppRow({ app }: { app: PlacementApplication }): JSX.Element {
  const cfg = appStatusConfig[app.status];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{app.company_name ?? 'Company'}</p>
        <p className="truncate text-xs text-gray-500">{app.role_title ?? 'Role'}</p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color} ${cfg.bg}`}>
        {cfg.label}
      </span>
    </div>
  );
}

interface PlacementWidgetProps {
  postings:     JobPosting[]            | undefined;
  applications: PlacementApplication[]  | undefined;
  isLoading:    boolean;
  error:        string | undefined;
}

export default function PlacementWidget({
  postings,
  applications,
  isLoading,
  error,
}: PlacementWidgetProps): JSX.Element {
  const navigate = useNavigate();

  const selectedCount = applications?.filter(a => a.status === 'selected').length ?? 0;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
            <Briefcase className="h-4 w-4 text-rose-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Placement</h3>
        </div>
        {selectedCount > 0 && (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
            {selectedCount} offer{selectedCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <SkeletonRow count={3} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-xs text-gray-400">Placement data unavailable</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active postings */}
            {postings && postings.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Open Positions
                </p>
                <div className="space-y-2">
                  {postings.slice(0, 3).map(job => (
                    <PostingRow
                      key={job.id}
                      job={job}
                      onApply={() => navigate(`/student/placement`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* My applications */}
            {applications && applications.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  My Applications
                </p>
                <div className="space-y-2">
                  {applications.slice(0, 3).map(app => (
                    <AppRow key={app.id} app={app} />
                  ))}
                </div>
              </div>
            )}

            {(!postings || postings.length === 0) && (!applications || applications.length === 0) && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Briefcase className="mb-2 h-8 w-8 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">No placements yet</p>
                <p className="text-xs text-gray-400">Job postings will appear when available</p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/student/placement')}
        className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-xs font-medium text-indigo-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        View placement portal <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
