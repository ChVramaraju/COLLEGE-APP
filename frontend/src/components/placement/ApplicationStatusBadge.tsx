// ============================================================
// components/placement/ApplicationStatusBadge.tsx
// ============================================================
import type { JSX } from 'react';
import type { ApplicationStatus } from '@/types/placement';

const CFG: Record<ApplicationStatus, { label: string; bg: string; text: string; dot: string }> = {
  applied:      { label: 'Applied',      bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500'    },
  under_review: { label: 'In Review',    bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  shortlisted:  { label: 'Shortlisted',  bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500'  },
  selected:     { label: 'Selected 🎉',  bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  rejected:     { label: 'Rejected',     bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-500'    },
  withdrawn:    { label: 'Withdrawn',    bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
};

interface Props { status: ApplicationStatus; size?: 'sm' | 'md' }

export default function ApplicationStatusBadge({ status, size = 'md' }: Props): JSX.Element {
  const c = CFG[status];
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${px} ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
      {c.label}
    </span>
  );
}
