// ============================================================
// QuestionEditor.tsx — Inline question form (expanded state)
// ============================================================
// Renders when a question is in "edit mode" in the question list.
// Contains: question text, OptionEditor, marks slider, type selector.
// ============================================================

import type { JSX, ChangeEvent } from 'react';
import type { QuestionFormState, CorrectOption } from '@/types/test';
import OptionEditor from './OptionEditor';
import QuestionTypeSelector from './QuestionTypeSelector';

interface QuestionEditorProps {
  question: QuestionFormState;
  index:    number;
  onUpdate: (updates: Partial<QuestionFormState>) => void;
  onClose:  () => void;
}

export default function QuestionEditor({
  question,
  index,
  onUpdate,
  onClose,
}: QuestionEditorProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-md">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-700">
          Editing Question {index + 1}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Collapse
        </button>
      </div>

      {/* ── Question Type ── */}
      <QuestionTypeSelector
        value="mcq"
        onChange={() => {/* extend when more types supported */}}
      />

      {/* ── Question text ── */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-600">
          Question Text <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={3}
          value={question.question_text}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onUpdate({ question_text: e.target.value })
          }
          placeholder="Enter the question text…"
          maxLength={2000}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        />
      </div>

      {/* ── Options ── */}
      <OptionEditor
        option_a={question.option_a}
        option_b={question.option_b}
        option_c={question.option_c}
        option_d={question.option_d}
        correct_option={question.correct_option}
        onChange={(field, value) => onUpdate({ [field]: value })}
        onCorrectChange={(key: CorrectOption) => onUpdate({ correct_option: key })}
      />

      {/* ── Marks ── */}
      <div className="flex items-center gap-4">
        <label className="text-xs font-semibold text-gray-600">Marks</label>
        <input
          type="number"
          min={1}
          max={10}
          value={question.marks}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onUpdate({ marks: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)) })
          }
          className="w-20 rounded-xl border border-gray-200 px-3 py-1.5 text-center text-sm font-semibold text-gray-800 focus:border-indigo-400 focus:outline-none"
        />
        <span className="text-xs text-gray-400">(1 – 10 per question)</span>
      </div>

      {/* ── Done button ── */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Done
        </button>
      </div>
    </div>
  );
}
