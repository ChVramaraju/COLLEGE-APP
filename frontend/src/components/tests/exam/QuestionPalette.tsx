// ============================================================
// components/tests/exam/QuestionPalette.tsx
// ============================================================
// Compact grid of numbered buttons — one per question.
// Colour-codes question status at a glance:
//
//   blue ring   → currently active question
//   emerald     → answered
//   amber       → flagged for review
//   rose        → visited but unanswered
//   gray        → not yet visited
//
// Clicking any button navigates to that question instantly.
// ============================================================

import type { JSX } from 'react';
import type { QuestionForStudent, QuestionPaletteStatus } from '@/types/test';

interface QuestionPaletteProps {
  questions:        QuestionForStudent[];
  currentIndex:     number;
  getPaletteStatus: (questionId: number, index: number) => QuestionPaletteStatus;
  onJump:           (index: number) => void;
  answeredCount:    number;
  reviewCount:      number;
}

const STATUS_CLASSES: Record<QuestionPaletteStatus, string> = {
  'current':           'ring-2 ring-indigo-500 bg-indigo-600 text-white font-bold',
  'answered':          'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
  'review':            'bg-amber-100   text-amber-800   border-amber-300   font-semibold',
  'visited-unanswered':'bg-rose-100    text-rose-700    border-rose-200',
  'unvisited':         'bg-gray-50     text-gray-500    border-gray-200',
};

export default function QuestionPalette({
  questions,
  currentIndex,
  getPaletteStatus,
  onJump,
  answeredCount,
  reviewCount,
}: QuestionPaletteProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Question Palette
      </h3>

      {/* ── Stats strip ── */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {answeredCount} answered
        </span>
        <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          {questions.length - answeredCount} unanswered
        </span>
        {reviewCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {reviewCount} flagged
          </span>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
        {questions.map((q, idx) => {
          const status = getPaletteStatus(q.id, idx);
          return (
            <button
              key={q.id}
              onClick={() => onJump(idx)}
              title={`Question ${idx + 1}`}
              aria-label={`Go to question ${idx + 1}`}
              aria-current={idx === currentIndex ? 'true' : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-all hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${STATUS_CLASSES[status]}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
        {[
          { cls: 'bg-indigo-600',  label: 'Current' },
          { cls: 'bg-emerald-100 border border-emerald-300', label: 'Answered' },
          { cls: 'bg-amber-100 border border-amber-300',     label: 'Flagged' },
          { cls: 'bg-rose-100 border border-rose-200',       label: 'Unanswered' },
          { cls: 'bg-gray-50 border border-gray-200',        label: 'Not visited' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`h-4 w-4 rounded ${cls}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
