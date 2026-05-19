import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { JSX } from 'react';
import type { FacultyNoteItem } from '@/types/facultyNotes';

interface Props {
  note: FacultyNoteItem;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteNoteConfirmModal({
  note,
  isDeleting,
  onConfirm,
  onCancel,
}: Props): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button on open (safer default than confirm)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Dismiss on Escape key (disabled while deletion is in-flight)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDeleting, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={!isDeleting ? onCancel : undefined}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Warning icon */}
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50"
          aria-hidden="true"
        >
          <AlertTriangle className="h-6 w-6 text-rose-500" />
        </div>

        {/* Heading */}
        <h2
          id="delete-modal-title"
          className="mb-1 text-base font-semibold text-gray-900"
        >
          Delete this note?
        </h2>

        {/* Note preview */}
        <p className="mb-1 line-clamp-1 text-sm font-medium text-gray-700">
          "{note.title}"
        </p>

        {/* Warning copy */}
        <p
          id="delete-modal-desc"
          className="mb-6 text-sm text-gray-500 leading-relaxed"
        >
          The file and all metadata will be permanently removed. Students lose
          access immediately. This action{' '}
          <span className="font-semibold text-gray-700">cannot be undone</span>.
        </p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            {isDeleting ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
