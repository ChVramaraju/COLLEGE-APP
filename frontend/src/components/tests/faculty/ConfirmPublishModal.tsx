// ============================================================
// ConfirmPublishModal.tsx — Pre-publish confirmation dialog
// ============================================================

import { AlertTriangle, Rocket, X } from 'lucide-react';
import type { JSX } from 'react';

interface ConfirmPublishModalProps {
  title:           string;
  questionCount:   number;
  totalMarks:      number;
  onConfirm:       () => void;
  onCancel:        () => void;
  isPublishing:    boolean;
}

export default function ConfirmPublishModal({
  title,
  questionCount,
  totalMarks,
  onConfirm,
  onCancel,
  isPublishing,
}: ConfirmPublishModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + title */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Publish Test?</h2>
            <p className="text-xs text-gray-500">This action has important consequences.</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
          <p className="mb-2 font-semibold text-gray-800 line-clamp-1">{title}</p>
          <div className="flex gap-6 text-xs text-gray-500">
            <span><span className="font-semibold text-gray-700">{questionCount}</span> questions</span>
            <span><span className="font-semibold text-gray-700">{totalMarks}</span> total marks</span>
          </div>
        </div>

        {/* Warning list */}
        <ul className="mb-6 space-y-1.5 text-sm text-gray-600">
          {[
            'Questions will be locked — you cannot edit or add more.',
            'Students in the assigned section will see this test.',
            'You can unpublish only if no students have attempted it.',
          ].map(w => (
            <li key={w} className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-500">•</span>
              {w}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPublishing}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPublishing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPublishing ? (
              <span className="animate-pulse">Publishing…</span>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Publish Test
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
