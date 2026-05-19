import { Globe, Save, X, ArrowLeft, RotateCcw } from 'lucide-react';
import type { JSX } from 'react';
import type { UploadPhase } from '@/types/facultyNotes';

interface Props {
  canSubmit:     boolean;
  phase:         UploadPhase;
  onSaveDraft:   () => void;
  onPublishNow:  () => void;
  onCancel:      () => void;
  onReset:       () => void;
  onViewNotes:   () => void;
}

const BASE_BTN =
  'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function UploadActions({
  canSubmit,
  phase,
  onSaveDraft,
  onPublishNow,
  onCancel,
  onReset,
  onViewNotes,
}: Props): JSX.Element {

  // ── Uploading ────────────────────────────────────────────
  if (phase === 'uploading') {
    return (
      <div className="flex flex-col gap-3">
        <button
          disabled
          className={`${BASE_BTN} cursor-not-allowed bg-indigo-100 text-indigo-400`}
          aria-disabled="true"
        >
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600"
            aria-hidden="true"
          />
          Uploading…
        </button>
        <button
          onClick={onCancel}
          className={`${BASE_BTN} border border-gray-200 text-gray-600 hover:bg-gray-50 focus-visible:ring-gray-300`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel Upload
        </button>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={onViewNotes}
          className={`${BASE_BTN} bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-400`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          View My Notes
        </button>
        <button
          onClick={onReset}
          className={`${BASE_BTN} border border-gray-200 text-gray-600 hover:bg-gray-50 focus-visible:ring-gray-300`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Upload Another Note
        </button>
      </div>
    );
  }

  // ── Idle / error (ready to submit or retry) ───────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Publish Now — primary CTA */}
      <button
        onClick={onPublishNow}
        disabled={!canSubmit}
        className={`${BASE_BTN} bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-400`}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        Publish Now
      </button>

      {/* Save as Draft — secondary */}
      <button
        onClick={onSaveDraft}
        disabled={!canSubmit}
        className={`${BASE_BTN} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-300`}
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        Save as Draft
      </button>

      {/* Helper when not ready */}
      {!canSubmit && phase !== 'error' && (
        <p className="text-center text-xs text-gray-400">
          Select a valid file and fill all required fields to upload.
        </p>
      )}

      {/* Retry hint on error */}
      {phase === 'error' && (
        <p className="text-center text-xs text-rose-500">
          Fix the issue above and try again.
        </p>
      )}
    </div>
  );
}
