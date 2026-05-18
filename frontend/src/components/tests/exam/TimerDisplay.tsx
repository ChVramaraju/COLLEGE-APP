// ============================================================
// components/tests/exam/TimerDisplay.tsx
// ============================================================
// Countdown timer badge with three colour states:
//   emerald  → normal (≥ 10 min)
//   amber    → warning (< 10 min)
//   red+pulse → danger (< 2 min)
//
// Receives pre-formatted string + colour class from
// useExamEngine so this component stays purely presentational.
// ============================================================

import { Timer } from 'lucide-react';
import type { JSX } from 'react';

interface TimerDisplayProps {
  formattedTime:   string;    // "MM:SS" or "H:MM:SS" from useExamEngine
  timerColorClass: string;    // Tailwind text colour class
  isExpired:       boolean;
}

export default function TimerDisplay({
  formattedTime,
  timerColorClass,
  isExpired,
}: TimerDisplayProps): JSX.Element {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums transition-colors ${
        isExpired
          ? 'border-red-300 bg-red-50 text-red-700'
          : timerColorClass.includes('red')
          ? 'border-red-200 bg-red-50'
          : timerColorClass.includes('amber')
          ? 'border-amber-200 bg-amber-50'
          : 'border-emerald-200 bg-emerald-50'
      } ${timerColorClass}`}
      aria-live="polite"
      aria-label={isExpired ? 'Time expired' : `Time remaining: ${formattedTime}`}
    >
      <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{isExpired ? '00:00' : formattedTime}</span>
    </div>
  );
}
