// ============================================================
// components/tests/cards/TestCard.tsx
// ============================================================
// Displays a single available test with:
//   - Subject badge (colour-coded by subject hash)
//   - Test title
//   - Stat row: questions / duration / marks
//   - Deadline info: time remaining (if < 2 hours) or end time
//   - Status badge (Available / In Progress / Submitted / Expired)
//   - CTA button: Start Test / Resume Test / View Results / Expired
//
// Props are intentionally narrow — only what the card renders.
// Business logic (starting, navigating) lives in useTests.
// ============================================================

import type { ComponentType }            from 'react';
import { Clock, BookOpen, Award, Hash }  from 'lucide-react';

import type { TestWithStatus }           from '@/types/test';
import { getSubjectColorClass, TEST_STATUS_CONFIG } from '@/types/test';


// ── Helpers ─────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Returns a human-readable deadline string.
// If less than 2 hours remain → "Ends in Xh Ym"
// Otherwise → "Ends HH:MM AM/PM"
function formatDeadline(endTimeIso: string): { text: string; urgent: boolean } {
  const end  = new Date(endTimeIso);
  const now  = new Date();
  const msLeft = end.getTime() - now.getTime();
  const minLeft = Math.floor(msLeft / 60_000);

  if (minLeft <= 0) return { text: 'Ended', urgent: true };

  if (minLeft < 120) {
    const h = Math.floor(minLeft / 60);
    const m = minLeft % 60;
    const parts = [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : ''].filter(Boolean).join(' ');
    return { text: `Ends in ${parts}`, urgent: true };
  }

  return {
    text: `Ends ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    urgent: false,
  };
}


// ── Sub-component: stat item ─────────────────────────────────

interface StatItemProps {
  icon:  ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
}

function StatItem({ icon: Icon, value, label }: StatItemProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {value}
      </span>
      <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-none">
        {label}
      </span>
    </div>
  );
}


// ── CTA button config ────────────────────────────────────────

type CTAConfig = {
  label:     string;
  className: string;
  disabled:  boolean;
};

function getCTA(
  status:       TestWithStatus['status'],
  isLaunching:  boolean,
): CTAConfig {
  if (isLaunching) {
    return {
      label:     'Starting…',
      className: 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed',
      disabled:  true,
    };
  }

  switch (status) {
    case 'available':
      return {
        label:     'Start Test',
        className: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 dark:shadow-none',
        disabled:  false,
      };
    case 'in_progress':
      return {
        label:     'Resume Test',
        className: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200 dark:shadow-none',
        disabled:  false,
      };
    case 'submitted':
      return {
        label:     'View Results',
        className: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 dark:shadow-none',
        disabled:  false,
      };
    case 'upcoming':
      return {
        label:     'Not Started Yet',
        className: 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
        disabled:  true,
      };
    case 'expired':
    default:
      return {
        label:     'Test Ended',
        className: 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
        disabled:  true,
      };
  }
}


// ── Main component ───────────────────────────────────────────

export interface TestCardProps {
  test:           TestWithStatus;
  isLaunching:    boolean;
  onPrimaryAction: (test: TestWithStatus) => void;
}

export default function TestCard({
  test,
  isLaunching,
  onPrimaryAction,
}: TestCardProps) {
  const subjectColor   = getSubjectColorClass(test.subject);
  const statusCfg      = TEST_STATUS_CONFIG[test.status];
  const deadline       = formatDeadline(test.end_time);
  const cta            = getCTA(test.status, isLaunching);

  const handleClick = () => {
    if (!cta.disabled) onPrimaryAction(test);
  };

  return (
    <article
      className="
        group relative flex flex-col
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-2xl shadow-sm
        hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
        transition-all duration-200
        overflow-hidden
      "
      aria-label={`Test: ${test.title}`}
    >
      {/* ── Top colour strip (subject) ──────────────────── */}
      <div className={`h-1 w-full ${
        test.status === 'available'   ? 'bg-emerald-500' :
        test.status === 'in_progress' ? 'bg-amber-500'   :
        test.status === 'submitted'   ? 'bg-blue-500'    :
                                        'bg-gray-300 dark:bg-gray-600'
      }`} />

      <div className="flex flex-col gap-4 p-5 flex-1">

        {/* ── Header row ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          {/* Subject badge */}
          <span className={`
            inline-flex items-center px-2.5 py-0.5
            text-[11px] font-semibold rounded-full
            ${subjectColor}
          `}>
            {test.subject}
          </span>

          {/* Status badge */}
          <span className={`
            inline-flex items-center px-2.5 py-0.5
            text-[11px] font-semibold rounded-full whitespace-nowrap
            ${statusCfg.badgeClass}
          `}>
            {statusCfg.label}
          </span>
        </div>

        {/* ── Title ───────────────────────────────────────── */}
        <h3 className="
          text-base font-semibold leading-snug
          text-gray-900 dark:text-gray-50
          group-hover:text-emerald-600 dark:group-hover:text-emerald-400
          transition-colors line-clamp-2
        ">
          {test.title}
        </h3>

        {/* ── Stats row ───────────────────────────────────── */}
        <div className="
          flex items-center justify-around
          bg-gray-50 dark:bg-gray-700/50
          rounded-xl py-3 px-2
        ">
          <StatItem
            icon={Hash}
            value={test.question_count}
            label="Questions"
          />
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
          <StatItem
            icon={Clock}
            value={formatDuration(test.duration_minutes)}
            label="Duration"
          />
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
          <StatItem
            icon={Award}
            value={test.total_marks ?? '—'}
            label="Marks"
          />
        </div>

        {/* ── Spacer (pushes deadline + CTA to bottom) ────── */}
        <div className="flex-1" />

        {/* ── Deadline ────────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className={`text-xs font-medium ${
            deadline.urgent
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {deadline.text}
          </span>
        </div>

        {/* ── CTA button ──────────────────────────────────── */}
        <button
          type="button"
          onClick={handleClick}
          disabled={cta.disabled}
          aria-label={`${cta.label} — ${test.title}`}
          className={`
            w-full py-2.5 px-4 rounded-xl
            text-sm font-semibold
            transition-all duration-150 active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500
            ${cta.className}
          `}
        >
          {isLaunching ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Starting…
            </span>
          ) : (
            cta.label
          )}
        </button>
      </div>
    </article>
  );
}
