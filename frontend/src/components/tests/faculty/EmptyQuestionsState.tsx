import { PlusCircle, FileQuestion } from 'lucide-react';
import type { JSX } from 'react';

interface EmptyQuestionsStateProps {
  onAdd: () => void;
}

export default function EmptyQuestionsState({ onAdd }: EmptyQuestionsStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-8 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <FileQuestion className="h-8 w-8 text-indigo-400" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-gray-800">No questions yet</h3>
      <p className="mb-6 max-w-xs text-sm text-gray-500">
        Add MCQ questions with options and mark the correct answer for each.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <PlusCircle className="h-4 w-4" />
        Add First Question
      </button>
    </div>
  );
}
