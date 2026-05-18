// ============================================================
// components/notes/filters/NotesFilterBar.tsx
// ============================================================
// Search + filter controls for the notes grid.
//
// KEY UX DECISION: search is DEBOUNCE-FREE.
//   We filter client-side in <1ms. Instant feedback on every
//   keystroke is better than a 300ms debounced server call.
//   The CPU cost is negligible for 100 notes.
//
// THREE FILTER TYPES:
//   1. Text search  → matches note title OR subject
//   2. Subject      → exact match from unique subjects list
//   3. File type    → "PDF", "Image", "Document", "Other"
//      (groups multiple MIME types under one UI concept)
//
// FULLY CONTROLLED: zero internal state.
//   All state lives in useNotes(). This component is a
//   pure input panel — receives values, emits changes.
// ============================================================

import { Search, X } from 'lucide-react';
import type { NotesFilters, FileTypeGroup } from '@/types/notes';
import type { JSX } from 'react';

const FILE_TYPE_OPTIONS: { value: FileTypeGroup; label: string }[] = [
  { value: 'pdf',      label: 'PDF' },
  { value: 'image',    label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'other',    label: 'Other' },
];

interface NotesFilterBarProps {
  filters:       NotesFilters;
  allSubjects:   string[];
  totalNotes:    number;
  totalFiltered: number;
  setFilter:     <K extends keyof NotesFilters>(key: K, value: NotesFilters[K]) => void;
  resetFilters:  () => void;
}

export default function NotesFilterBar({
  filters,
  allSubjects,
  totalNotes,
  totalFiltered,
  setFilter,
  resetFilters,
}: NotesFilterBarProps): JSX.Element {
  const hasActive =
    filters.search !== '' ||
    filters.subject !== '' ||
    filters.fileType !== '';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {/* Search input */}
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Search Notes</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title or subject…"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-9 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
            />
            {filters.search && (
              <button
                onClick={() => setFilter('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subject filter */}
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
          <select
            value={filters.subject}
            onChange={e => setFilter('subject', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
          >
            <option value="">All Subjects</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* File type filter */}
        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-gray-500">File Type</label>
          <select
            value={filters.fileType}
            onChange={e => setFilter('fileType', e.target.value as FileTypeGroup | '')}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
          >
            <option value="">All Types</option>
            {FILE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Result count + clear */}
        <div className="flex items-center gap-2 sm:pb-0.5">
          <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
            {totalFiltered} / {totalNotes}
          </span>
          {hasActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors whitespace-nowrap"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Active filter tags */}
      {hasActive && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {filters.search && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              "{filters.search}"
              <button onClick={() => setFilter('search', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.subject && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {filters.subject}
              <button onClick={() => setFilter('subject', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.fileType && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">
              {filters.fileType}
              <button onClick={() => setFilter('fileType', '')}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
