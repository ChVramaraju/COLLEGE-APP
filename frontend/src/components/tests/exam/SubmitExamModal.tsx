// ============================================================
// components/tests/exam/SubmitExamModal.tsx
// ============================================================
// Pre-submission confirmation modal that shows a summary of:
//   - answered / unanswered / flagged question counts
//   - a warning when unanswered questions remain
//   - a final confirm ("Submit Now") + cancel button
//
// The modal is always rendered in a portal-like fixed overlay
// so it works regardless of the parent scroll position.
// ============================================================

import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
import type { JSX } from 'react';

interface SubmitExamModalProps {
  isOpen:          boolean;
  totalQuestions:  number;
  answeredCount:   number;
  unansweredCount: number;
  reviewCount:     number;
  isSubmitting:    boolean;
  submitError:     string | null;
  onConfirm:       () => void;
  onCancel:        () => void;
}

export default function SubmitExamModal({
  isOpen,
  totalQuestions,
  answeredCount,
  unansweredCount,
  reviewCount,
  isSubmitting,
  submitError,
  onConfirm,
  onCancel,
}: SubmitExamModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* ── Header ── */}
        <div className="border-b border-gray-100 px-6 py-4">
          <h2
            id="submit-modal-title"
            className="text-base font-bold text-gray-900"
          >
            Submit Exam?
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            This action cannot be undone. Your answers will be graded immediately.
          </p>
        </div>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-3 gap-3 p-6">
          <div className="flex flex-col items-center rounded-xl bg-emerald-50 p-3">
            <span className="text-2xl font-bold text-emerald-700">{answeredCount}</span>
            <span className="mt-0.5 text-xs text-emerald-600">Answered</span>
          </div>
          <div className={`flex flex-col items-center rounded-xl p-3 ${unansweredCount > 0 ? 'bg-rose-50' : 'bg-gray-50'}`}>
            <span className={`text-2xl font-bold ${unansweredCount > 0 ? 'text-rose-700' : 'text-gray-500'}`}>
              {unansweredCount}
            </span>
            <span className={`mt-0.5 text-xs ${unansweredCount > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
              Unanswered
            </span>
          </div>
          <div className={`flex flex-col items-center rounded-xl p-3 ${reviewCount > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <span className={`text-2xl font-bold ${reviewCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
              {reviewCount}
            </span>
            <span className={`mt-0.5 text-xs ${reviewCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              Flagged
            </span>
          </div>
        </div>

        {/* ── Warnings ── */}
        <div className="px-6 pb-4 space-y-2">
          {unansweredCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700">
                <strong>{unansweredCount}</strong> question{unansweredCount > 1 ? 's' : ''} left unanswered. Skipped questions count as 0 marks.
              </p>
            </div>
          )}
          {unansweredCount === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-medium">All {totalQuestions} questions answered!</p>
            </div>
          )}
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {submitError}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Continue Exam
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              <><Send className="h-4 w-4" /> Submit Now</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
