// ============================================================
// components/tests/exam/ExamHeader.tsx
// ============================================================
// Sticky top bar for the exam engine. Three zones:
//
//   LEFT   — subject badge + test title (truncated)
//   CENTER — question progress "Q N / Total" + mini progress bar
//   RIGHT  — TimerDisplay + Submit button
//
// Stays visible during scrolling so the student always sees
// the timer and can submit at any point.
// ============================================================

import { Send } from 'lucide-react';
import type { JSX } from 'react';
import TimerDisplay from './TimerDisplay';
import { getSubjectColorClass } from '@/types/test';

interface ExamHeaderProps {
  title:           string;
  subject:         string;
  questionNumber:  number;   // 1-based
  totalQuestions:  number;
  formattedTime:   string;
  timerColorClass: string;
  isExpired:       boolean;
  isSubmitting:    boolean;
  onSubmitClick:   () => void;
}

export default function ExamHeader({
  title,
  subject,
  questionNumber,
  totalQuestions,
  formattedTime,
  timerColorClass,
  isExpired,
  isSubmitting,
  onSubmitClick,
}: ExamHeaderProps): JSX.Element {
  const progress = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm shadow-sm">
      {/* ── Left: subject + title ── */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold ${getSubjectColorClass(subject)}`}>
          {subject}
        </span>
        <h1
          className="max-w-[200px] truncate text-sm font-bold text-gray-900 sm:max-w-xs"
          title={title}
        >
          {title}
        </h1>
      </div>

      {/* ── Center: progress ── */}
      <div className="hidden flex-col items-center gap-1 md:flex">
        <span className="text-xs font-medium text-gray-600">
          Q {questionNumber} / {totalQuestions}
        </span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Right: timer + submit ── */}
      <div className="flex items-center gap-2">
        <TimerDisplay
          formattedTime={formattedTime}
          timerColorClass={timerColorClass}
          isExpired={isExpired}
        />
        <button
          onClick={onSubmitClick}
          disabled={isSubmitting}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
            isSubmitting
              ? 'cursor-wait bg-indigo-400'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </span>
        </button>
      </div>
    </header>
  );
}
