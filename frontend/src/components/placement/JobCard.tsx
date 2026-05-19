// ============================================================
// components/placement/JobCard.tsx
// ============================================================
// Card for a single job posting in the student browse view.
// Shows: company, role, package, location, deadline, eligibility.
// Handles applied / applying / not-eligible states.
// ============================================================

import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, IndianRupee, CalendarClock,
  Users, ExternalLink, Loader2,
} from 'lucide-react';
import EligibilityBadge from '@/components/placement/EligibilityBadge';
import ApplicationStatusBadge from '@/components/placement/ApplicationStatusBadge';
import type { JobPosting } from '@/types/placement';

function formatDeadline(dl: string | null): string {
  if (!dl) return 'Open';
  const d = new Date(dl);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays < 0)  return 'Closed';
  if (diffDays === 0) return 'Closes today';
  if (diffDays === 1) return '1 day left';
  if (diffDays <= 7) return `${diffDays} days left`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface JobCardProps {
  job:        JobPosting;
  applied:    boolean;
  applying:   boolean;
  onApply:    (jobId: number) => void;
  showAdmin?: boolean;  // show total_applications (admin mode)
}

export default function JobCard({
  job, applied, applying, onApply, showAdmin = false,
}: JobCardProps): JSX.Element {
  const navigate  = useNavigate();
  const deadline  = formatDeadline(job.application_deadline);
  const isClosed  = !job.is_open || deadline === 'Closed';

  const deadlineColor =
    deadline === 'Closes today' ? 'text-rose-600' :
    deadline.includes('day')    ? 'text-amber-600' :
    'text-gray-500';

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
        applied ? 'border-emerald-200 bg-emerald-50/20'
        : job.is_eligible === false ? 'border-gray-200 opacity-80'
        : 'border-gray-200 hover:border-indigo-200'
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
            <Building2 className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{job.company_name}</p>
            <p className="truncate text-xs text-gray-500">{job.role_title}</p>
          </div>
        </div>
        <EligibilityBadge eligible={job.is_eligible} />
      </div>

      {/* Meta chips */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {job.package_lpa != null && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden="true" />
            {job.package_lpa} LPA
          </span>
        )}
        {job.location && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {job.location}
          </span>
        )}
        <span className={`flex items-center gap-1 text-xs font-medium ${deadlineColor}`}>
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {deadline}
        </span>
        {showAdmin && job.total_applications != null && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {job.total_applications} applied
          </span>
        )}
      </div>

      {/* Eligibility criteria pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {job.min_cgpa > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            CGPA ≥ {job.min_cgpa}
          </span>
        )}
        {job.min_attendance_pct > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            Attendance ≥ {job.min_attendance_pct}%
          </span>
        )}
        {job.allowed_departments && (
          job.allowed_departments.split(',').map(d => (
            <span key={d} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 uppercase">
              {d.trim()}
            </span>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-2">
        <button
          onClick={() => navigate(`/student/placement/${job.id}`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          View Details
        </button>

        {applied ? (
          <ApplicationStatusBadge status="applied" size="sm" />
        ) : (
          <button
            onClick={() => onApply(job.id)}
            disabled={applying || isClosed || job.is_eligible === false}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {applying
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…</>
              : isClosed ? 'Closed'
              : 'Apply'
            }
          </button>
        )}
      </div>
    </div>
  );
}
