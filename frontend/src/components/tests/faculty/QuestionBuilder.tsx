// ============================================================
// QuestionBuilder.tsx — Ordered list of questions with CRUD
// ============================================================
// Manages which question (if any) is currently in "edit" mode.
// Only one question can be expanded at a time.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { PlusCircle } from 'lucide-react';
import type { JSX } from 'react';
import type { QuestionFormState } from '@/types/test';

import QuestionPreviewCard from './QuestionPreviewCard';
import QuestionEditor from './QuestionEditor';
import EmptyQuestionsState from './EmptyQuestionsState';

interface QuestionBuilderProps {
  questions:         QuestionFormState[];
  onAdd:             () => void;
  onUpdate:          (tempId: string, updates: Partial<QuestionFormState>) => void;
  onDelete:          (tempId: string) => void;
  onMoveUp:          (tempId: string) => void;
  onMoveDown:        (tempId: string) => void;
  onDuplicate:       (tempId: string) => void;
}

export default function QuestionBuilder({
  questions,
  onAdd,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: QuestionBuilderProps): JSX.Element {
  const [expandedTempId, setExpandedTempId] = useState<string | null>(null);
  const prevLengthRef = useRef(questions.length);

  // Auto-expand the newly added question when the list grows.
  useEffect(() => {
    if (questions.length > prevLengthRef.current) {
      const newest = questions[questions.length - 1];
      if (newest) setExpandedTempId(newest.tempId);
    }
    prevLengthRef.current = questions.length;
  }, [questions.length]);

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Questions
          <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            {questions.length}
          </span>
        </h2>
        {questions.length > 0 && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Question
          </button>
        )}
      </div>

      {/* ── Empty state ── */}
      {questions.length === 0 && (
        <EmptyQuestionsState onAdd={onAdd} />
      )}

      {/* ── Question list ── */}
      <div className="flex flex-col gap-2.5">
        {questions.map((q, i) =>
          expandedTempId === q.tempId ? (
            <QuestionEditor
              key={q.tempId}
              question={q}
              index={i}
              onUpdate={updates => onUpdate(q.tempId, updates)}
              onClose={() => setExpandedTempId(null)}
            />
          ) : (
            <QuestionPreviewCard
              key={q.tempId}
              question={q}
              index={i}
              isFirst={i === 0}
              isLast={i === questions.length - 1}
              onEdit={() => setExpandedTempId(q.tempId)}
              onDelete={() => {
                if (expandedTempId === q.tempId) setExpandedTempId(null);
                onDelete(q.tempId);
              }}
              onMoveUp={() => onMoveUp(q.tempId)}
              onMoveDown={() => onMoveDown(q.tempId)}
              onDuplicate={() => {
                onDuplicate(q.tempId);
                setTimeout(() => setExpandedTempId(null), 50);
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}
