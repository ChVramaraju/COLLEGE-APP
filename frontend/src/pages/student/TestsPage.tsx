// ============================================================
// pages/student/TestsPage.tsx — Online Tests (Phase 1)
// ============================================================
// Composition root for the Online Tests module.
//
// Responsibilities:
//   - Render page header + summary stats
//   - Render status filter tabs
//   - Delegate to TestsLoadingSkeleton / EmptyTestsState / TestCard grid
//   - Mount TestInstructionsModal (single instance, portal-less)
//   - Surface fetch errors with retry option
//
// ALL state lives in useTests. This page has zero local state.
// ============================================================

import { useMemo, useState }                  from 'react';

import { useTests }                            from '@/hooks/useTests';
import TestCard                                from '@/components/tests/cards/TestCard';
import TestInstructionsModal                   from '@/components/tests/modals/TestInstructionsModal';
import TestsLoadingSkeleton                    from '@/components/tests/states/TestsLoadingSkeleton';
import EmptyTestsState                         from '@/components/tests/states/EmptyTestsState';
import type { TestStatus, TestWithStatus }     from '@/types/test';


// ── Filter tab config ────────────────────────────────────────

type FilterTab = 'all' | TestStatus;

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all',         label: 'All'         },
  { key: 'available',   label: 'Available'   },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'submitted',   label: 'Submitted'   },
];


// ── Sub-component: error banner ──────────────────────────────

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="
      flex items-start gap-3 p-4 rounded-xl
      bg-rose-50 dark:bg-rose-900/20
      border border-rose-200 dark:border-rose-700
    ">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
          Failed to load tests
        </p>
        <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="
          shrink-0 px-3 py-1.5 rounded-lg
          text-xs font-medium
          bg-rose-600 hover:bg-rose-700 text-white
          transition-colors
        "
      >
        Retry
      </button>
    </div>
  );
}


// ── Sub-component: summary stat pill ────────────────────────

interface StatPillProps {
  count:  number;
  label:  string;
  color:  string;
}

function StatPill({ count, label, color }: StatPillProps) {
  return (
    <div className="
      flex items-center gap-2
      px-4 py-2.5 rounded-xl
      bg-white dark:bg-gray-800
      border border-gray-200 dark:border-gray-700
      shadow-sm
    ">
      <span className={`text-2xl font-bold ${color}`}>{count}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</span>
    </div>
  );
}


// ── Main page ────────────────────────────────────────────────

export default function TestsPage() {
  const {
    tests,
    isLoading,
    isError,
    errorMessage,
    selectedTest,
    isInstructionsOpen,
    startingTestId,
    openInstructions,
    closeInstructions,
    confirmStart,
    retry,
  } = useTests();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Derive summary counts from full test list
  const stats = useMemo(() => ({
    available:   tests.filter(t => t.status === 'available').length,
    in_progress: tests.filter(t => t.status === 'in_progress').length,
    submitted:   tests.filter(t => t.status === 'submitted').length,
  }), [tests]);

  // Apply filter tab
  const filteredTests = useMemo<TestWithStatus[]>(
    () =>
      activeFilter === 'all'
        ? tests
        : tests.filter(t => t.status === activeFilter),
    [tests, activeFilter],
  );

  // Primary action handler — decides between openInstructions vs navigate
  const handlePrimaryAction = (test: TestWithStatus) => {
    if (test.status === 'submitted') {
      // Phase 2 builds the result page. For now, open instructions
      // so the API call returns 409 and redirects to the result route.
      openInstructions(test);
      return;
    }
    openInstructions(test);
  };

  return (
    <>
      {/* ── Page ──────────────────────────────────────────── */}
      <div className="min-h-full p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Page header ───────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Online Tests
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tests assigned to your section. Click a card to read instructions before starting.
          </p>
        </div>

        {/* ── Summary stats ─────────────────────────────── */}
        {!isLoading && !isError && tests.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <StatPill
              count={stats.available}
              label="Available"
              color="text-emerald-600 dark:text-emerald-400"
            />
            <StatPill
              count={stats.in_progress}
              label="In Progress"
              color="text-amber-500 dark:text-amber-400"
            />
            <StatPill
              count={stats.submitted}
              label="Submitted"
              color="text-blue-600 dark:text-blue-400"
            />
          </div>
        )}

        {/* ── Error banner ──────────────────────────────── */}
        {isError && errorMessage && (
          <ErrorBanner message={errorMessage} onRetry={retry} />
        )}

        {/* ── Filter tabs ───────────────────────────────── */}
        {!isLoading && !isError && tests.length > 0 && (
          <div
            role="tablist"
            aria-label="Filter tests by status"
            className="
              flex gap-1
              bg-gray-100 dark:bg-gray-800
              p-1 rounded-xl
              w-full sm:w-auto sm:inline-flex
            "
          >
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={activeFilter === tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`
                  flex-1 sm:flex-none
                  px-3 py-1.5 rounded-lg
                  text-xs font-medium
                  transition-all duration-150
                  ${activeFilter === tab.key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }
                `}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className={`
                    ml-1.5 text-[10px]
                    ${activeFilter === tab.key
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-400 dark:text-gray-500'
                    }
                  `}>
                    {stats[tab.key as keyof typeof stats] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Content area ──────────────────────────────── */}
        {isLoading ? (
          <TestsLoadingSkeleton count={6} />
        ) : isError && tests.length === 0 ? (
          <EmptyTestsState onRetry={retry} />
        ) : filteredTests.length === 0 ? (
          <EmptyTestsState
            onRetry={activeFilter !== 'all' ? () => setActiveFilter('all') : retry}
          />
        ) : (
          <div
            className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
            aria-label="Available tests"
          >
            {filteredTests.map(test => (
              <div key={test.id} role="listitem">
                <TestCard
                  test={test}
                  isLaunching={startingTestId === test.id}
                  onPrimaryAction={handlePrimaryAction}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Instructions modal (single global instance) ─── */}
      <TestInstructionsModal
        test={selectedTest}
        isOpen={isInstructionsOpen}
        isStarting={startingTestId !== null}
        onConfirm={confirmStart}
        onClose={closeInstructions}
      />
    </>
  );
}
