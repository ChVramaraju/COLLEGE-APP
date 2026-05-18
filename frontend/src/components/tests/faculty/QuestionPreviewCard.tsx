// ============================================================
// QuestionPreviewCard.tsx — Read-only collapsed question row
// ============================================================

import { ChevronUp, ChevronDown, Copy, Trash2, Pencil } from 'lucide-react';
import type { JSX } from 'react';
import type { QuestionFormState } from '@/types/test';

interface QuestionPreviewCardProps {
  question:    QuestionFormState;
  index:       number;
  isFirst:     boolean;
  isLast:      boolean;
  onEdit:      () => void;
  onDelete:    () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
  onDuplicate: () => void;
}

const CORRECT_LABEL: Record<string, string> = {
  a: 'A', b: 'B', c: 'C', d: 'D',
};

export default function QuestionPreviewCard({
  question,
  index,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: QuestionPreviewCardProps): JSX.Element {
  const preview = question.question_text.trim() || '(no question text yet)';
  const correctLabel = CORRECT_LABEL[question.correct_option] ?? '?';
  const isEmpty = !question.question_text.trim();

  return (
    <div className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
      isEmpty ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
    }`}>
      {/* ── Order badge ── */}
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {index + 1}
      </span>

      {/* ── Content ── */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isEmpty ? 'text-amber-600 italic' : 'text-gray-800'}`}>
          {preview}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
            Ans: {correctLabel}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
            {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
          </span>
          {isEmpty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-600">
              Incomplete
            </span>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          title="Move up"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          title="Move down"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          onClick={onDuplicate}
          title="Duplicate"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
