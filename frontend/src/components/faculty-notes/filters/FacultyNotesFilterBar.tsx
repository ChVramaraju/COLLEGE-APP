import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { FacultyNotesFilters, FacultyNotesStats } from '@/types/facultyNotes';
import type { FileTypeGroup } from '@/types/facultyNotes';

interface Props {
  filter:         FacultyNotesFilters;
  stats:          FacultyNotesStats;
  onFilterChange: (partial: Partial<FacultyNotesFilters>) => void;
  onClearFilters: () => void;
}

const PUBLISH_PILLS: Array<{ value: FacultyNotesFilters['publishState']; label: string }> = [
  { value: 'all',       label: 'All'       },
  { value: 'published', label: 'Published' },
  { value: 'draft',     label: 'Drafts'    },
];

const FILE_TYPE_OPTS: Array<{ value: FileTypeGroup | ''; label: string }> = [
  { value: '',         label: 'All Types' },
  { value: 'pdf',      label: 'PDF'       },
  { value: 'document', label: 'Document'  },
  { value: 'image',    label: 'Image'     },
  { value: 'other',    label: 'Other'     },
];

const selectClass =
  'rounded-xl border border-gray-200 bg-gray-50 py-2 pl-3 pr-8 text-sm text-gray-700 ' +
  'focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 ' +
  'transition-colors cursor-pointer';

export default function FacultyNotesFilterBar({
  filter,
  stats,
  onFilterChange,
  onClearFilters,
}: Props): JSX.Element {
  // Local search value drives the input; debounced propagation to filter state
  const [localSearch, setLocalSearch] = useState(filter.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync back when external clearFilters() resets filter.search to ''
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFilterChange({ search: value }), 300);
  };

  const hasActive =
    filter.search !== '' ||
    filter.subject !== '' ||
    filter.fileType !== '' ||
    filter.publishState !== 'all';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">

        {/* ── Search ──────────────────────────────────────────── */}
        <div className="relative min-w-48 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={localSearch}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search title or subject…"
            aria-label="Search notes"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        {/* ── Subject dropdown ─────────────────────────────────── */}
        {stats.subjects.length > 0 && (
          <select
            value={filter.subject}
            onChange={e => onFilterChange({ subject: e.target.value })}
            aria-label="Filter by subject"
            className={selectClass}
          >
            <option value="">All Subjects</option>
            {stats.subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* ── File type dropdown ───────────────────────────────── */}
        <select
          value={filter.fileType}
          onChange={e => onFilterChange({ fileType: e.target.value as (FileTypeGroup | '') })}
          aria-label="Filter by file type"
          className={selectClass}
        >
          {FILE_TYPE_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* ── Publish state pills ──────────────────────────────── */}
        <div
          className="flex gap-1.5"
          role="group"
          aria-label="Filter by publish state"
        >
          {PUBLISH_PILLS.map(pill => (
            <button
              key={pill.value}
              onClick={() => onFilterChange({ publishState: pill.value })}
              aria-pressed={filter.publishState === pill.value}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                filter.publishState === pill.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* ── Clear button ─────────────────────────────────────── */}
        {hasActive && (
          <button
            onClick={onClearFilters}
            aria-label="Clear all filters"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
