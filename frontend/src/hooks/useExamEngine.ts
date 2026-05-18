// ============================================================
// hooks/useExamEngine.ts — Online Exam Engine State Manager
// ============================================================
// Single hook that owns ALL mutable state for an active exam:
//
//   TIMER      — absolute-timestamp countdown (survives tab switches)
//   ANSWERS    — per-question selected option (ref + state for closure safety)
//   NAVIGATION — current question index, visited tracking
//   REVIEW     — "flag for review" set
//   SUBMIT     — manual + auto-submit with double-submission guard
//   PERSIST    — answers/flags/index → localStorage (crash recovery)
//   EXIT GUARD — beforeunload warn before submission
//
// ABSOLUTE TIMER STRATEGY:
//   We compute msLeft = endTime_epoch - Date.now() on every tick.
//   Contrast: a decrement-based timer loses time when the tab is
//   in the background (JS timers throttled to ≥1s in bg tabs).
//   Absolute recalculation is always accurate regardless of JS
//   execution timing.
//
// DOUBLE-SUBMIT GUARD:
//   React state updates are async so a stale isSubmitting=false
//   could allow two concurrent submit calls. We use refs as the
//   authoritative guard — state is only for re-rendering.
// ============================================================

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  QuestionForStudent,
  CorrectOption,
  SubmissionAnswer,
  PersistedExamState,
  QuestionPaletteStatus,
} from '@/types/test';
import { submitAttempt } from '@/services/testService';

// ── Storage key ──────────────────────────────────────────────
const storageKey = (id: number) => `sce_exam_${id}`;

// ── Timer thresholds ─────────────────────────────────────────
const WARN_MS  = 10 * 60 * 1000;   // orange at < 10 min
const ALERT_MS =  2 * 60 * 1000;   // red     at <  2 min

// ── Props / Return shape ─────────────────────────────────────
export interface UseExamEngineProps {
  attemptId:  number;
  testId:     number;
  endTime:    string;              // ISO 8601 hard deadline from backend
  questions:  QuestionForStudent[];
}

export interface UseExamEngineReturn {
  // Timer
  msLeft:           number;
  isExpired:        boolean;
  timerColorClass:  string;
  formattedTime:    string;
  // Navigation
  currentIndex:     number;
  totalQuestions:   number;
  currentQuestion:  QuestionForStudent | undefined;
  goToQuestion:     (index: number) => void;
  nextQuestion:     () => void;
  prevQuestion:     () => void;
  // Answers
  answers:          Readonly<Record<number, CorrectOption | null>>;
  setAnswer:        (questionId: number, option: CorrectOption) => void;
  clearAnswer:      (questionId: number) => void;
  // Review flags
  reviewFlags:      ReadonlySet<number>;
  toggleReview:     (questionId: number) => void;
  // Visited set
  visitedIds:       ReadonlySet<number>;
  // Palette status helper
  getPaletteStatus: (questionId: number, index: number) => QuestionPaletteStatus;
  // Stats (memoised)
  answeredCount:    number;
  unansweredCount:  number;
  reviewCount:      number;
  // Submit modal
  isSubmitModalOpen: boolean;
  openSubmitModal:   () => void;
  closeSubmitModal:  () => void;
  // Submit state
  isSubmitting:     boolean;
  submitError:      string | null;
  isSubmitted:      boolean;
  confirmSubmit:    () => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────
function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function timerClass(ms: number): string {
  if (ms <= ALERT_MS) return 'text-red-600 animate-pulse';
  if (ms <= WARN_MS)  return 'text-amber-500';
  return 'text-emerald-600';
}

function loadPersisted(key: string, attemptId: number): PersistedExamState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedExamState;
    if (parsed.attemptId !== attemptId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────
export function useExamEngine({
  attemptId,
  testId,
  endTime,
  questions,
}: UseExamEngineProps): UseExamEngineReturn {
  const navigate = useNavigate();
  const key = storageKey(attemptId);

  // ── Initialise from localStorage if available ────────────────
  const persisted = useMemo(() => loadPersisted(key, attemptId), [key, attemptId]);

  // ── Timer state ───────────────────────────────────────────────
  const endEpoch = useMemo(() => new Date(endTime).getTime(), [endTime]);
  const [msLeft, setMsLeft] = useState(() => Math.max(0, endEpoch - Date.now()));

  // ── Navigation state ──────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(persisted?.currentIndex ?? 0);

  // ── Answer state + ref (ref prevents stale closure in submit) ─
  const [answers, setAnswersState] = useState<Record<number, CorrectOption | null>>(
    () => persisted?.answers ?? {},
  );
  const answersRef = useRef(answers);

  // ── Visited set ───────────────────────────────────────────────
  const firstId = questions[persisted?.currentIndex ?? 0]?.id;
  const [visitedIds, setVisitedIds] = useState<Set<number>>(
    () => firstId !== undefined ? new Set([firstId]) : new Set(),
  );

  // ── Review flags ──────────────────────────────────────────────
  const [reviewFlags, setReviewFlags] = useState<Set<number>>(
    () => new Set(persisted?.reviewFlags ?? []),
  );

  // ── Submit state + refs ───────────────────────────────────────
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [submitError,      setSubmitError]      = useState<string | null>(null);
  const [isSubmitted,      setIsSubmitted]      = useState(false);
  const [isSubmitModalOpen,setIsSubmitModalOpen] = useState(false);
  const isSubmittingRef = useRef(false);
  const isSubmittedRef  = useRef(false);

  // ── Derived stats ─────────────────────────────────────────────
  const answeredCount = useMemo(
    () => questions.filter(q => (answersRef.current[q.id] ?? null) !== null).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, answers],
  );
  const unansweredCount = questions.length - answeredCount;
  const reviewCount     = reviewFlags.size;

  // ── Persist to localStorage on every state change ────────────
  useEffect(() => {
    if (isSubmittedRef.current) return;
    const state: PersistedExamState = {
      attemptId,
      answers:      answersRef.current,
      reviewFlags:  [...reviewFlags],
      currentIndex,
    };
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* quota */ }
  }, [answers, reviewFlags, currentIndex, attemptId, key]);

  // ── Core submit function (used by both manual + auto-submit) ──
  const performSubmit = useCallback(async () => {
    if (isSubmittingRef.current || isSubmittedRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    const submissionAnswers: SubmissionAnswer[] = questions.map(q => ({
      question_id:     q.id,
      selected_option: answersRef.current[q.id] ?? null,
    }));

    try {
      await submitAttempt(attemptId, submissionAnswers);
      isSubmittedRef.current = true;
      setIsSubmitted(true);
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      navigate(
        `/student/tests/${testId}/result?attemptId=${attemptId}`,
        { replace: true },
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [attemptId, testId, questions, navigate, key]);

  // ── Countdown timer (absolute timestamp recalculation) ────────
  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, endEpoch - Date.now());
      setMsLeft(ms);
      if (ms === 0 && !isSubmittingRef.current && !isSubmittedRef.current) {
        void performSubmit();
      }
    };
    tick();  // immediate first tick
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endEpoch, performSubmit]);

  // ── beforeunload anti-exit guard ─────────────────────────────
  useEffect(() => {
    if (isSubmitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your exam progress may be lost. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSubmitted]);

  // ── Navigation helpers ────────────────────────────────────────
  const goToQuestion = useCallback((index: number) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    const id = questions[index]?.id;
    if (id !== undefined) {
      setVisitedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    }
  }, [questions]);

  const nextQuestion = useCallback(() => goToQuestion(currentIndex + 1), [goToQuestion, currentIndex]);
  const prevQuestion = useCallback(() => goToQuestion(currentIndex - 1), [goToQuestion, currentIndex]);

  // ── Answer helpers ────────────────────────────────────────────
  const setAnswer = useCallback((questionId: number, option: CorrectOption) => {
    setAnswersState(prev => {
      const next = { ...prev, [questionId]: option };
      answersRef.current = next;
      return next;
    });
  }, []);

  const clearAnswer = useCallback((questionId: number) => {
    setAnswersState(prev => {
      const next = { ...prev, [questionId]: null };
      answersRef.current = next;
      return next;
    });
  }, []);

  // ── Review flag helper ────────────────────────────────────────
  const toggleReview = useCallback((questionId: number) => {
    setReviewFlags(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  // ── Palette status helper ─────────────────────────────────────
  const getPaletteStatus = useCallback((questionId: number, index: number): QuestionPaletteStatus => {
    if (index === currentIndex) return 'current';
    if (reviewFlags.has(questionId)) return 'review';
    if ((answersRef.current[questionId] ?? null) !== null) return 'answered';
    if (visitedIds.has(questionId)) return 'visited-unanswered';
    return 'unvisited';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, reviewFlags, answers, visitedIds]);

  // ── Modal helpers ─────────────────────────────────────────────
  const openSubmitModal  = useCallback(() => setIsSubmitModalOpen(true),  []);
  const closeSubmitModal = useCallback(() => setIsSubmitModalOpen(false), []);
  const confirmSubmit    = useCallback(() => {
    setIsSubmitModalOpen(false);
    return performSubmit();
  }, [performSubmit]);

  return {
    msLeft,
    isExpired:        msLeft === 0,
    timerColorClass:  timerClass(msLeft),
    formattedTime:    formatMs(msLeft),
    currentIndex,
    totalQuestions:   questions.length,
    currentQuestion:  questions[currentIndex],
    goToQuestion,
    nextQuestion,
    prevQuestion,
    answers,
    setAnswer,
    clearAnswer,
    reviewFlags,
    toggleReview,
    visitedIds,
    getPaletteStatus,
    answeredCount,
    unansweredCount,
    reviewCount,
    isSubmitModalOpen,
    openSubmitModal,
    closeSubmitModal,
    isSubmitting,
    submitError,
    isSubmitted,
    confirmSubmit,
  };
}
