// ============================================================
// components/tests/exam/QuestionCard.tsx
// ============================================================
// Renders the currently active question with four option buttons.
//
// OPTION STATE VISUAL RULES:
//   selected  → indigo border + indigo bg, letter badge filled
//   unselected → gray border, hover lifts to indigo tint
//
// EXTENSIBILITY NOTE:
//   The OPTIONS constant maps CorrectOption keys to fields.
//   Adding question types (True/False, short-answer) only
//   requires changing this component's rendering logic, not
//   the engine or parent page.
// ============================================================

import { Flag } from 'lucide-react';
import type { JSX } from 'react';
import type { QuestionForStudent, CorrectOption } from '@/types/test';

interface QuestionCardProps {
  question:       QuestionForStudent;
  questionNumber: number;          // 1-based display index
  totalQuestions: number;
  selectedOption: CorrectOption | null;
  isReviewed:     boolean;
  onSelect:       (option: CorrectOption) => void;
  onToggleReview: () => void;
}

const OPTIONS: Array<{ key: CorrectOption; field: keyof QuestionForStudent }> = [
  { key: 'a', field: 'option_a' },
  { key: 'b', field: 'option_b' },
  { key: 'c', field: 'option_c' },
  { key: 'd', field: 'option_d' },
];

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOption,
  isReviewed,
  onSelect,
  onToggleReview,
}: QuestionCardProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {questionNumber}
          </span>
          <span className="text-xs text-gray-400">of {totalQuestions}</span>
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
          </span>
        </div>

        {/* Review flag toggle */}
        <button
          onClick={onToggleReview}
          title={isReviewed ? 'Remove review flag' : 'Flag for review'}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            isReviewed
              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-gray-200 bg-white text-gray-400 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600'
          }`}
        >
          <Flag className="h-3.5 w-3.5" />
          {isReviewed ? 'Flagged' : 'Flag'}
        </button>
      </div>

      {/* ── Question text ── */}
      <p className="text-base font-medium leading-relaxed text-gray-900">
        {question.question_text}
      </p>

      {/* ── Options ── */}
      <div className="flex flex-col gap-2.5">
        {OPTIONS.map(({ key, field }) => {
          const text = question[field] as string;
          const isSelected = selectedOption === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {key.toUpperCase()}
              </span>
              <span className={`flex-1 text-sm leading-relaxed ${isSelected ? 'font-medium text-indigo-900' : 'text-gray-700'}`}>
                {text}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Clear selection hint ── */}
      {selectedOption !== null && (
        <p className="text-right text-xs text-gray-400">
          Click the selected option again to deselect.
        </p>
      )}
    </div>
  );
}
