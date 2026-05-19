import { FileText, PlusCircle, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { JSX } from 'react';

interface Props {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export default function FacultyNotesEmptyState({ hasActiveFilters, onClearFilters }: Props): JSX.Element {
  const navigate = useNavigate();

  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <SearchX className="h-7 w-7 text-gray-400" aria-hidden="true" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-gray-900">
          No notes match your filters
        </h3>
        <p className="mb-5 text-sm text-gray-500">
          Try adjusting your search or clearing the active filters.
        </p>
        <button
          onClick={onClearFilters}
          className="text-sm font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <FileText className="h-8 w-8 text-indigo-400" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-gray-900">
        No notes uploaded yet
      </h3>
      <p className="mb-6 max-w-xs text-sm text-gray-500">
        Upload your first note to share study materials with your students.
      </p>
      <button
        onClick={() => navigate('/faculty/notes/upload')}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      >
        <PlusCircle className="h-4 w-4" aria-hidden="true" />
        Upload First Note
      </button>
    </div>
  );
}
