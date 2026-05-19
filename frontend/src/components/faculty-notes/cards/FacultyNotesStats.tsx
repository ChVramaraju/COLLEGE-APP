import { BookOpen, FileEdit, FileText, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { JSX } from 'react';
import type { FacultyNotesStats } from '@/types/facultyNotes';
import { formatBytes } from '@/types/facultyNotes';

interface Props {
  stats: FacultyNotesStats;
}

interface StatCardProps {
  label:      string;
  value:      number;
  sublabel:   string;
  Icon:       LucideIcon;
  iconBg:     string;
  iconColor:  string;
}

function StatCard({ label, value, sublabel, Icon, iconBg, iconColor }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">{sublabel}</p>
        </div>
        <div
          className={`flex-shrink-0 rounded-xl p-2.5 ${iconBg}`}
          aria-hidden="true"
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function FacultyNotesStats({ stats }: Props): JSX.Element {
  const publishedPct =
    stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;

  const subjectPreview =
    stats.subjects.length === 0
      ? 'none yet'
      : stats.subjects.slice(0, 2).join(', ') +
        (stats.subjects.length > 2 ? ` +${stats.subjects.length - 2}` : '');

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        label="Total Notes"
        value={stats.total}
        sublabel={formatBytes(stats.totalSizeBytes) + ' total'}
        Icon={FileText}
        iconBg="bg-indigo-50"
        iconColor="text-indigo-600"
      />
      <StatCard
        label="Published"
        value={stats.published}
        sublabel={`${publishedPct}% of total`}
        Icon={Globe}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />
      <StatCard
        label="Drafts"
        value={stats.drafts}
        sublabel="not visible to students"
        Icon={FileEdit}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
      />
      <StatCard
        label="Subjects"
        value={stats.subjects.length}
        sublabel={subjectPreview}
        Icon={BookOpen}
        iconBg="bg-violet-50"
        iconColor="text-violet-600"
      />
    </div>
  );
}
