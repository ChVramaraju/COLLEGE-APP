import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

interface Props {
  message: string | null;
  onRetry: () => void;
}

export default function FacultyNotesErrorState({ message, onRetry }: Props): JSX.Element {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
        <AlertTriangle className="h-8 w-8 text-rose-500" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-gray-900">
        Failed to load notes
      </h3>
      <p className="mb-6 max-w-xs text-sm text-gray-500">
        {message ?? 'Something went wrong. Please check your connection and try again.'}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
