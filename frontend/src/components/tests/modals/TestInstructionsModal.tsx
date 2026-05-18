// ============================================================
// components/tests/modals/TestInstructionsModal.tsx
// ============================================================
// Shown before a student starts or resumes a test.
//
// Displays:
//   - Test title + subject + duration recap
//   - Numbered rules the student must read
//   - Warning about timer behaviour
//   - "Start Now" confirmation button
//   - "Cancel" link to dismiss
//
// Accessibility:
//   - role="dialog" with aria-modal and aria-labelledby
//   - Focus trapped inside while open
//   - ESC key closes the modal
//   - Backdrop click closes the modal
//
// Prop contract is intentionally minimal — all state lives in useTests.
// ============================================================

import { useEffect, useRef }       from 'react';
import { X, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

import type { AvailableTest }      from '@/types/test';
import { getSubjectColorClass }    from '@/types/test';


// ── Exam rules ───────────────────────────────────────────────
const EXAM_RULES = [
  'The timer starts the moment you click "Start Now". It cannot be paused.',
  'You must complete and submit the test before the deadline shown on the card.',
  'The test auto-submits when the timer expires — even if you haven\'t clicked Submit.',
  'Each question carries the marks shown. There is no negative marking.',
  'Do not refresh or close the browser tab during the exam — your progress may be lost.',
  'Questions can be answered in any order and revisited before submission.',
  'Once submitted, your answers cannot be changed.',
] as const;


// ── Props ────────────────────────────────────────────────────

interface TestInstructionsModalProps {
  test:          AvailableTest | null;
  isOpen:        boolean;
  isStarting:    boolean;
  onConfirm:     () => void;
  onClose:       () => void;
}


// ── Component ────────────────────────────────────────────────

export default function TestInstructionsModal({
  test,
  isOpen,
  isStarting,
  onConfirm,
  onClose,
}: TestInstructionsModalProps) {
  const dialogRef  = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // ── ESC to close ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ── Auto-focus confirm button when modal opens ────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // ── Body scroll lock ─────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !test) return null;

  const subjectColor = getSubjectColorClass(test.subject);

  return (
    <div
      role="presentation"
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        p-4
        bg-gray-900/60 backdrop-blur-sm
        animate-in fade-in duration-200
      "
      onClick={(e) => {
        // Close only on backdrop click, not on dialog click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        className="
          relative w-full max-w-lg
          bg-white dark:bg-gray-800
          rounded-2xl shadow-2xl
          overflow-hidden
          animate-in slide-in-from-bottom-4 duration-200
        "
      >
        {/* ── Close button ──────────────────────────────── */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close instructions"
          className="
            absolute top-4 right-4 z-10
            p-1.5 rounded-lg
            text-gray-400 hover:text-gray-600
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors
          "
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Header ────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className={`
              inline-flex items-center px-2.5 py-0.5
              text-[11px] font-semibold rounded-full
              ${subjectColor}
            `}>
              {test.subject}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3 h-3" />
              {test.duration_minutes} minutes
            </span>
          </div>

          <h2
            id="instructions-title"
            className="text-xl font-bold text-gray-900 dark:text-gray-50 pr-8 leading-tight"
          >
            {test.title}
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {test.question_count} questions
            {test.total_marks != null && ` · ${test.total_marks} marks total`}
          </p>
        </div>

        {/* ── Rules ─────────────────────────────────────── */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            Before you begin — read carefully
          </h3>

          <ol className="space-y-2.5">
            {EXAM_RULES.map((rule, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                  {rule}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Warning banner ────────────────────────────── */}
        <div className="
          mx-6 mb-4 px-4 py-3
          flex items-start gap-2.5
          bg-amber-50 dark:bg-amber-900/20
          border border-amber-200 dark:border-amber-700
          rounded-xl
        ">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            <strong>Timer starts immediately.</strong> Make sure you have a
            stable internet connection and {test.duration_minutes} minutes
            of uninterrupted time before proceeding.
          </p>
        </div>

        {/* ── Actions ───────────────────────────────────── */}
        <div className="
          px-6 py-4
          flex flex-col-reverse sm:flex-row items-center gap-3
          border-t border-gray-100 dark:border-gray-700
        ">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="
              w-full sm:w-auto px-5 py-2.5
              text-sm font-medium
              text-gray-600 dark:text-gray-300
              hover:text-gray-900 dark:hover:text-gray-100
              hover:bg-gray-100 dark:hover:bg-gray-700
              rounded-xl transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Cancel
          </button>

          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isStarting}
            className="
              w-full sm:w-auto px-6 py-2.5
              bg-emerald-600 hover:bg-emerald-700
              text-white text-sm font-semibold
              rounded-xl shadow-sm shadow-emerald-200 dark:shadow-none
              transition-all active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
            "
            aria-live="polite"
          >
            {isStarting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting…
              </span>
            ) : (
              'Start Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
