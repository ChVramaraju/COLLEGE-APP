// ============================================================
// hooks/useTests.ts — Online Tests State Orchestrator
// ============================================================
// Responsibilities:
//   1. Fetch available tests + my-results in parallel
//   2. Derive TestStatus for each test (cross-reference results)
//   3. Manage instructions modal state
//   4. Manage per-test start/resume loading state
//   5. Call startOrResumeAttempt, then navigate to exam engine
//   6. Handle "already submitted" 409 → redirect to results page
//   7. Expose retry() for failed fetches
//
// DATA FLOW:
//   getAvailableTests() ─┐
//                        ├─ deriveTestStatus() ─ TestWithStatus[] ─ TestCard[]
//   getMyResults()     ──┘
//
// PHASE 2 EXTENSION POINTS:
//   → Exam engine page will read attempt data from router state
//   → Zustand store (not built in Phase 1) will own active-attempt state
//   → This hook only handles the pre-exam list and launch flow
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }                                 from 'react-router-dom';

import {
  getAvailableTests,
  getMyResults,
  startOrResumeAttempt,
}                               from '@/services/testService';
import {
  deriveTestStatus,
}                               from '@/types/test';
import type {
  AvailableTest,
  StudentResultSummary,
  TestWithStatus,
}                               from '@/types/test';


// ---------------------------------------------------------------
// Public interface returned by the hook
// ---------------------------------------------------------------
export interface UseTestsReturn {
  tests:              TestWithStatus[];
  isLoading:          boolean;
  isError:            boolean;
  errorMessage:       string | null;

  // Instructions modal
  selectedTest:       AvailableTest | null;
  isInstructionsOpen: boolean;

  // Which test ID is currently launching (spinner on its card)
  startingTestId:     number | null;

  // Action dispatchers
  openInstructions:   (test: AvailableTest) => void;
  closeInstructions:  () => void;
  confirmStart:       () => Promise<void>;
  retry:              () => void;
}


// ---------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------
export function useTests(): UseTestsReturn {
  const navigate = useNavigate();

  // ── Server data ──────────────────────────────────────────────
  const [availableTests, setAvailableTests] = useState<AvailableTest[]>([]);
  const [myResults,      setMyResults]      = useState<StudentResultSummary[]>([]);

  // ── Fetch lifecycle ──────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isError,      setIsError]      = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Incrementing this triggers a re-fetch (used by retry())
  const [fetchKey, setFetchKey] = useState(0);

  // ── Modal state ──────────────────────────────────────────────
  const [selectedTest,       setSelectedTest]       = useState<AvailableTest | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  // ── Launch state ─────────────────────────────────────────────
  const [startingTestId, setStartingTestId] = useState<number | null>(null);


  // ── Parallel data fetch ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);

      try {
        // Fetch available tests and results simultaneously.
        // If results fetch fails (student has no attempts yet, 404 is not
        // expected but some edge cases), we fall back to empty array so
        // the tests list still renders — just without status enrichment.
        const [tests, results] = await Promise.all([
          getAvailableTests(),
          getMyResults().catch(() => [] as StudentResultSummary[]),
        ]);

        if (cancelled) return;
        setAvailableTests(tests);
        setMyResults(results);
      } catch (err) {
        if (cancelled) return;
        setIsError(true);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to load tests. Please try again.',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchKey]);


  // ── Derive status for every available test ───────────────────
  // submittedTestIds: Set<number> of test IDs where is_submitted === true.
  // Built once per results array change, not on every render.
  const submittedTestIds = useMemo<ReadonlySet<number>>(
    () => new Set(myResults.filter(r => r.is_submitted).map(r => r.test_id)),
    [myResults],
  );

  // TestWithStatus[] — what TestCard components consume.
  const tests = useMemo<TestWithStatus[]>(
    () =>
      availableTests.map(t => ({
        ...t,
        status: deriveTestStatus(t, submittedTestIds),
      })),
    [availableTests, submittedTestIds],
  );


  // ── Modal actions ────────────────────────────────────────────
  const openInstructions = useCallback((test: AvailableTest) => {
    setSelectedTest(test);
    setIsInstructionsOpen(true);
  }, []);

  const closeInstructions = useCallback(() => {
    setIsInstructionsOpen(false);
    // Delay clearing selectedTest so the modal close animation
    // doesn't flash empty content during the CSS transition.
    setTimeout(() => setSelectedTest(null), 300);
  }, []);


  // ── Confirm start / resume ───────────────────────────────────
  // Called when student clicks "Start Now" inside the modal.
  //
  // Flow:
  //   1. Close modal, show spinner on the card
  //   2. POST /tests/{id}/attempt
  //   3a. Success → navigate to exam page with attempt state
  //   3b. 409 "already submitted" → navigate to results page
  //   3c. Other error → surface error message, remove spinner
  const confirmStart = useCallback(async () => {
    if (!selectedTest) return;

    const testId  = selectedTest.id;
    const subject  = selectedTest.subject;   // capture before null-ing selectedTest

    // Close modal immediately for snappy UX — spinner on card continues
    setIsInstructionsOpen(false);
    setSelectedTest(null);
    setStartingTestId(testId);

    try {
      const attempt = await startOrResumeAttempt(testId);

      // Navigate to the exam engine.
      // Spread the full ActiveAttempt so TestExamPage's type guard passes,
      // then attach subject (not in ActiveAttemptResponse from backend).
      navigate(
        `/student/tests/${testId}/exam`,
        { state: { ...attempt, subject } },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start test.';

      // 409: "You have already submitted this test. View your result instead."
      // Backend sends this when student tries to re-start a submitted test.
      // Redirect to results instead of showing an error.
      if (message.toLowerCase().includes('already submitted')) {
        navigate(`/student/tests/${testId}/result`);
        return;
      }

      // All other errors: surface to the user
      setIsError(true);
      setErrorMessage(message);
    } finally {
      setStartingTestId(null);
    }
  }, [selectedTest, navigate]);


  // ── Retry ────────────────────────────────────────────────────
  const retry = useCallback(() => {
    setFetchKey(k => k + 1);
  }, []);


  return {
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
  };
}
