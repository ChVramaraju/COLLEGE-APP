// ============================================================
// pages/student/TestExamPage.tsx — Online Exam Engine
// ============================================================
// COMPOSITION ROOT for the exam engine. Responsibilities:
//
//   1. Guard — redirect to /student/tests if location.state
//      is missing (direct URL access, no attempt data)
//   2. Mount useExamEngine with attempt data from location.state
//   3. Wire all exam components together
//   4. Bridge QuestionCard's onSelect to clearAnswer (deselect toggle)
//
// LAYOUT (responsive):
//
//   ┌─────────────────────────────────────────────────────────┐
//   │  ExamHeader (sticky)                                    │
//   ├─────────────────────────────────────┬───────────────────┤
//   │                                     │                   │
//   │  QuestionCard          (flex-1)     │  QuestionPalette  │
//   │  ExamNavigation                     │  (lg:sticky)      │
//   │                                     │                   │
//   └─────────────────────────────────────┴───────────────────┘
//
//   Mobile: single column, palette below navigation.
// ============================================================

import { useEffect, type JSX } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';

import { useExamEngine }     from '@/hooks/useExamEngine';
import ExamHeader            from '@/components/tests/exam/ExamHeader';
import QuestionCard          from '@/components/tests/exam/QuestionCard';
import QuestionPalette       from '@/components/tests/exam/QuestionPalette';
import ExamNavigation        from '@/components/tests/exam/ExamNavigation';
import SubmitExamModal       from '@/components/tests/exam/SubmitExamModal';
import type { ActiveAttempt, CorrectOption } from '@/types/test';

// Location state shape: full ActiveAttempt + subject injected by useTests
interface ExamPageState extends ActiveAttempt {
  subject?: string;
}

// ── Type guard for location.state ────────────────────────────
function isValidAttemptState(s: unknown): s is ExamPageState {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.attempt_id === 'number' &&
    typeof o.test_id    === 'number' &&
    typeof o.end_time   === 'string' &&
    Array.isArray(o.questions)
  );
}

export default function TestExamPage(): JSX.Element {
  const { testId }  = useParams<{ testId: string }>();
  const location    = useLocation();
  const navigate    = useNavigate();
  const state = location.state as unknown;

  // ── Guard: redirect if attempt data is absent ─────────────
  useEffect(() => {
    if (!isValidAttemptState(state) || !testId) {
      navigate('/student/tests', { replace: true });
    }
  }, [state, testId, navigate]);

  if (!isValidAttemptState(state) || !testId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return <ExamEngine attempt={state} testId={parseInt(testId, 10)} subject={state.subject ?? ''} />;
}

// ── Inner component (safe — attempt data is validated above) ──
function ExamEngine({
  attempt,
  testId,
  subject,
}: {
  attempt: ExamPageState;
  testId:  number;
  subject: string;
}): JSX.Element {
  const engine = useExamEngine({
    attemptId:  attempt.attempt_id,
    testId,
    endTime:    attempt.end_time,
    questions:  attempt.questions,
  });

  const {
    isExpired, timerColorClass, formattedTime,
    currentIndex, totalQuestions, currentQuestion,
    goToQuestion, nextQuestion, prevQuestion,
    answers, setAnswer, clearAnswer,
    reviewFlags, toggleReview,
    getPaletteStatus,
    answeredCount, unansweredCount, reviewCount,
    isSubmitModalOpen, openSubmitModal, closeSubmitModal,
    isSubmitting, submitError, isSubmitted,
    confirmSubmit,
  } = engine;

  // ── Deselect-on-reclick logic ─────────────────────────────
  const handleOptionSelect = (option: CorrectOption) => {
    if (!currentQuestion) return;
    if (answers[currentQuestion.id] === option) {
      clearAnswer(currentQuestion.id);
    } else {
      setAnswer(currentQuestion.id, option);
    }
  };

  // ── Auto-submit overlay ───────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-gray-600">Submitting your answers…</p>
      </div>
    );
  }

  // ── Expired overlay (auto-submit in progress) ─────────────
  if (isExpired && !isSubmitting) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-base font-bold text-red-700">Time&apos;s up!</p>
        <p className="text-sm text-red-600">Auto-submitting your answers…</p>
        <Loader2 className="h-5 w-5 animate-spin text-red-500" />
      </div>
    );
  }

  if (!currentQuestion) return <div />;

  return (
    <>
      {/* ── Sticky header ─────────────────────────────── */}
      <ExamHeader
        title={attempt.title}
        subject={subject}
        questionNumber={currentIndex + 1}
        totalQuestions={totalQuestions}
        formattedTime={formattedTime}
        timerColorClass={timerColorClass}
        isExpired={isExpired}
        isSubmitting={isSubmitting}
        onSubmitClick={openSubmitModal}
      />

      {/* ── Submit error banner (outside modal, for retry) ── */}
      {submitError && !isSubmitModalOpen && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">

        {/* Left: question + navigation */}
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={totalQuestions}
            selectedOption={answers[currentQuestion.id] ?? null}
            isReviewed={reviewFlags.has(currentQuestion.id)}
            onSelect={handleOptionSelect}
            onToggleReview={() => toggleReview(currentQuestion.id)}
          />

          <ExamNavigation
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            onPrev={prevQuestion}
            onNext={nextQuestion}
          />

          {/* Mobile-only: quick stats */}
          <div className="flex gap-2 lg:hidden">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {answeredCount} answered
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
              {unansweredCount} left
            </span>
            {reviewCount > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {reviewCount} flagged
              </span>
            )}
          </div>
        </main>

        {/* Right: question palette */}
        <aside className="w-full lg:sticky lg:top-[72px] lg:w-72 lg:shrink-0 lg:self-start">
          <QuestionPalette
            questions={attempt.questions}
            currentIndex={currentIndex}
            getPaletteStatus={getPaletteStatus}
            onJump={goToQuestion}
            answeredCount={answeredCount}
            reviewCount={reviewCount}
          />
        </aside>
      </div>

      {/* ── Submit confirmation modal ─────────────────────── */}
      <SubmitExamModal
        isOpen={isSubmitModalOpen}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        reviewCount={reviewCount}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onConfirm={confirmSubmit}
        onCancel={closeSubmitModal}
      />
    </>
  );
}
