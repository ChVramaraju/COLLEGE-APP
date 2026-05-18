// ============================================================
// components/notes/cards/NotesStatsPanel.tsx
// ============================================================
// Summary strip at the top of the notes page.
// Shows: total notes, unique subjects, file type breakdown,
// and the most recently uploaded note.
//
// WHY show stats on a notes portal?
//   Students want to know at a glance: "How many notes are here?"
//   "Is there something new?" "Are there mostly PDFs or docs?"
//   Stats panels surface this without requiring the user to
//   manually count cards — the same principle that makes
//   dashboards valuable over raw lists.
// ============================================================

import type { ComponentType } from 'react';
import { FileText, BookOpen, Clock, Files } from 'lucide-react';
import type { NotesStats } from '@/hooks/useNotes';
import { formatUploadDate } from '@/types/notes';
import type { JSX } from 'react';

interface NoteStatBoxProps {
  label: string;
  value: string | number;
  Icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

function NoteStatBox({ label, value, Icon, iconBg, iconColor }: NoteStatBoxProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

interface NoteStatsPanelProps {
  stats:     NotesStats;
  isLoading: boolean;
}

export default function NotesStatsPanel({ stats, isLoading }: NoteStatsPanelProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-pulse">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-9 w-9 rounded-lg bg-gray-200 flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="h-4 w-8 rounded bg-gray-200" />
              <div className="h-3 w-16 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const fileTypeLabel =
    stats.pdfCount > 0 && stats.docCount === 0 && stats.imageCount === 0
      ? `${stats.pdfCount} PDFs`
      : `${stats.pdfCount}P · ${stats.docCount}D · ${stats.imageCount}I`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NoteStatBox
        label="Total Notes"
        value={stats.total}
        Icon={Files}
        iconBg="bg-indigo-50"
        iconColor="text-indigo-600"
      />
      <NoteStatBox
        label="Subjects"
        value={stats.subjects.length}
        Icon={BookOpen}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
      />
      <NoteStatBox
        label="File Types"
        value={fileTypeLabel}
        Icon={FileText}
        iconBg="bg-rose-50"
        iconColor="text-rose-600"
      />
      <NoteStatBox
        label="Latest Upload"
        value={stats.latestNote ? formatUploadDate(stats.latestNote.uploaded_at) : '—'}
        Icon={Clock}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />
    </div>
  );
}
