// ============================================================
// components/tests/exam/ExamNavigation.tsx
// ============================================================
// Prev / Next navigation bar shown below the QuestionCard.
// Previous is disabled on the first question;
// Next is disabled on the last question.
// Shows "Question N of Total" in the centre for context.
// ============================================================

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { JSX } from 'react';

interface ExamNavigationProps {
  currentIndex:   number;
  totalQuestions: number;
  onPrev:         () => void;
  onNext:         () => void;
}

export default function ExamNavigation({
  currentIndex,
  totalQuestions,
  onPrev,
  onNext,
}: ExamNavigationProps): JSX.Element {
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === totalQuestions - 1;

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>

      <span className="text-sm font-medium text-gray-500">
        Question{' '}
        <span className="font-bold text-gray-900">{currentIndex + 1}</span>
        {' '}of{' '}
        <span className="font-bold text-gray-900">{totalQuestions}</span>
      </span>

      <button
        onClick={onNext}
        disabled={isLast}
        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
