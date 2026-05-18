// ============================================================
// components/tests/states/EmptyTestsState.tsx
// ============================================================

import { ClipboardList } from 'lucide-react';


interface EmptyTestsStateProps {
  onRetry?: () => void;
}

export default function EmptyTestsState({ onRetry }: EmptyTestsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="
        w-16 h-16 mb-5 rounded-2xl
        bg-gray-100 dark:bg-gray-700/50
        flex items-center justify-center
      ">
        <ClipboardList className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>

      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
        No tests available right now
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
        Your faculty hasn't scheduled any tests for your section at this time.
        Check back later or refresh the page.
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="
            mt-6 px-5 py-2 rounded-xl
            text-sm font-medium
            text-emerald-600 dark:text-emerald-400
            border border-emerald-300 dark:border-emerald-700
            hover:bg-emerald-50 dark:hover:bg-emerald-900/20
            transition-colors
          "
        >
          Refresh
        </button>
      )}
    </div>
  );
}
