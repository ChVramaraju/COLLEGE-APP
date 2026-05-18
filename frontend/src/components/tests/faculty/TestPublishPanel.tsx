// ============================================================
// TestPublishPanel.tsx — Sticky right-column status + actions panel
// ============================================================

import { Rocket, BookOpen, Save, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import type { JSX } from 'react';
import type { FacultyTestStatus } from '@/types/test';
import { FACULTY_STATUS_CONFIG } from '@/types/test';

interface TestPublishPanelProps {
  savedTestId:   number | null;
  isPublished:   boolean;
  status:        FacultyTestStatus;
  questionCount: number;
  totalMarks:    number;
  pageStatus:    'idle' | 'loading' | 'saving' | 'publishing' | 'error';
  isDirty:       boolean;
  error:         string | null;
  successMessage: string | null;
  onSave:        () => void;
  onPublish:     () => void;
  onClearSuccess: () => void;
}

export default function TestPublishPanel({
  savedTestId,
  isPublished,
  status,
  questionCount,
  totalMarks,
  pageStatus,
  isDirty,
  error,
  successMessage,
  onSave,
  onPublish,
  onClearSuccess,
}: TestPublishPanelProps): JSX.Element {
  const cfg        = FACULTY_STATUS_CONFIG[status];
  const isBusy     = pageStatus === 'saving' || pageStatus === 'publishing';
  const isReadonly = isPublished;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* ── Status ── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Test Status
        </p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Questions" value={questionCount} />
        <Stat label="Total Marks" value={totalMarks} />
        {savedTestId && <Stat label="Test ID" value={`#${savedTestId}`} />}
      </div>

      {/* ── Messages ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div
          className="flex cursor-pointer items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"
          onClick={onClearSuccess}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── Actions ── */}
      {isReadonly ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Published — questions are locked. Unpublish to edit.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={onSave}
            disabled={isBusy || !isDirty}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {pageStatus === 'saving' ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            onClick={onPublish}
            disabled={isBusy || questionCount === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pageStatus === 'publishing' ? (
              <span className="animate-pulse">Publishing…</span>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Publish Test
              </>
            )}
          </button>
          {questionCount === 0 && (
            <p className="text-center text-xs text-gray-400">
              Add at least 1 question to publish.
            </p>
          )}
        </div>
      )}

      {/* ── Readonly hint ── */}
      {!isReadonly && (
        <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>
            Save as draft any time. Publish only when the test is final —
            questions lock on publish.
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
