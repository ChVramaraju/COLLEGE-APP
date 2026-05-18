// ============================================================
// pages/student/TestResultPage.tsx — Graded Exam Result View
// ============================================================
// Reads attemptId from URL query param (?attemptId=N) and
// fetches the graded result from GET /tests/attempts/{id}/result.
//
// SECTIONS:
//   1. Result banner  — pass/fail badge, score circle, percentage
//   2. Stats row      — correct / wrong / skipped / total
//   3. Answer review  — per-question breakdown with colour coding
//   4. Back button    — returns to /student/tests
//
// COLOUR RULES for answer review:
//   correct  → emerald background on selected option
//   wrong    → rose background on selected, emerald on correct
//   skipped  → amber hint, correct answer shown in emerald
// ============================================================

import { useEffect, useState, type JSX } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, MinusCircle,
  Trophy, ArrowLeft, AlertCircle,
} from 'lucide-react';

import { getAttemptResult } from '@/services/testService';
import type { TestResultResponse, QuestionWithAnswer, CorrectOption } from '@/types/test';
import { getSubjectColorClass } from '@/types/test';

// ── Option labels ─────────────────────────────────────────────
const OPTION_FIELDS: Record<CorrectOption, keyof QuestionWithAnswer> = {
  a: 'option_a', b: 'option_b', c: 'option_c', d: 'option_d',
};

// ── Per-question breakdown card ───────────────────────────────
function QuestionResult({
  q,
  index,
}: {
  q:     QuestionWithAnswer;
  index: number;
}): JSX.Element {
  const statusIcon =
    q.is_correct === true  ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
    q.is_correct === false ? <XCircle className="h-4 w-4 text-rose-600" /> :
                              <MinusCircle className="h-4 w-4 text-amber-500" />;

  const statusLabel =
    q.is_correct === true  ? 'Correct'  :
    q.is_correct === false ? 'Wrong'    : 'Skipped';

  const borderClass =
    q.is_correct === true  ? 'border-emerald-200 bg-emerald-50/30' :
    q.is_correct === false ? 'border-rose-200 bg-rose-50/30'       :
                              'border-amber-200 bg-amber-50/30';

  return (
    <div className={`rounded-2xl border p-4 ${borderClass}`}>
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-700 shadow-sm ring-1 ring-gray-200">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-gray-500">
            {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusIcon}
          <span className={`text-xs font-semibold ${
            q.is_correct === true  ? 'text-emerald-700' :
            q.is_correct === false ? 'text-rose-700'    : 'text-amber-600'
          }`}>
            {statusLabel}
            {q.marks_awarded !== null && (
              <span className="ml-1 font-normal text-gray-500">
                ({q.marks_awarded}/{q.marks})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Question text */}
      <p className="mb-3 text-sm font-medium leading-relaxed text-gray-800">
        {q.question_text}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        {(Object.entries(OPTION_FIELDS) as Array<[CorrectOption, keyof QuestionWithAnswer]>).map(
          ([key, field]) => {
            const text        = q[field] as string;
            const isCorrect   = key === q.correct_option;
            const isSelected  = key === q.selected_option;
            const isWrong     = isSelected && !isCorrect;

            let cls = 'border-gray-200 bg-white text-gray-700';
            if (isCorrect)  cls = 'border-emerald-400 bg-emerald-100 text-emerald-900 font-medium';
            if (isWrong)    cls = 'border-rose-400 bg-rose-100 text-rose-900';

            return (
              <div
                key={key}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${cls}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCorrect ? 'bg-emerald-500 text-white' :
                    isWrong   ? 'bg-rose-500 text-white'   : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {key.toUpperCase()}
                </span>
                <span className="flex-1">{text}</span>
                {isCorrect && !isSelected && (
                  <span className="text-xs font-semibold text-emerald-600">✓ Correct</span>
                )}
                {isWrong && (
                  <span className="text-xs font-semibold text-rose-600">✗ Your answer</span>
                )}
                {isCorrect && isSelected && (
                  <span className="text-xs font-semibold text-emerald-600">✓ Correct!</span>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────
function ResultSkeleton(): JSX.Element {
  return (
    <div className="animate-pulse space-y-5 pb-8">
      <div className="h-40 rounded-2xl bg-gray-200" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-200" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-36 rounded-2xl bg-gray-200" />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function TestResultPage(): JSX.Element {
  const location      = useLocation();
  const [searchParams] = useSearchParams();

  const attemptId = parseInt(searchParams.get('attemptId') ?? '0', 10);

  const [result,    setResult]    = useState<TestResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) {
      setError('No attempt ID provided. Please navigate from your tests page.');
      setIsLoading(false);
      return;
    }
    void getAttemptResult(attemptId)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load result.');
      })
      .finally(() => setIsLoading(false));
  }, [attemptId]);

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) return <ResultSkeleton />;

  // ── Error ────────────────────────────────────────────────
  if (error || !result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-sm font-semibold text-red-700">Failed to load result</p>
        <p className="mt-1 text-xs text-gray-500">{error}</p>
        <Link
          to="/student/tests"
          className="mt-5 flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tests
        </Link>
      </div>
    );
  }

  // ── Stats ────────────────────────────────────────────────
  const correct   = result.answered_questions.filter(q => q.is_correct === true).length;
  const wrong     = result.answered_questions.filter(q => q.is_correct === false).length;
  const skipped   = result.answered_questions.filter(q => q.selected_option === null).length;
  const fromExam  = (location.state as { fromExam?: boolean } | null)?.fromExam ?? false;

  const scorePercent = Math.round(result.percentage);
  const passClass    = result.is_pass
    ? 'border-emerald-300 bg-emerald-50'
    : 'border-rose-300 bg-rose-50';

  return (
    <div className="space-y-5 pb-10">

      {/* ── Success toast (only when navigating from exam) ── */}
      {fromExam && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800">
            Exam submitted successfully! Here are your results.
          </p>
        </div>
      )}

      {/* ── Result banner ────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 ${passClass}`}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">

          {/* Score circle */}
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white shadow-md">
            <div className="text-center">
              <span className={`block text-2xl font-extrabold leading-none ${result.is_pass ? 'text-emerald-700' : 'text-rose-700'}`}>
                {scorePercent}%
              </span>
              <span className="text-xs text-gray-500">score</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-lg font-bold text-gray-900">{result.title}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getSubjectColorClass(result.subject)}`}>
                {result.subject}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Score:{' '}
              <strong className="text-gray-900">{result.score}</strong>
              {' '}/ {result.total_marks} marks
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5 sm:justify-start">
              {result.is_pass ? (
                <>
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">PASSED</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span className="text-sm font-semibold text-rose-700">
                    FAILED <span className="font-normal text-gray-500">(≥ 40% required)</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',    value: result.answered_questions.length, cls: 'bg-gray-50  text-gray-700',    border: 'border-gray-200'   },
          { label: 'Correct',  value: correct,                          cls: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200'},
          { label: 'Wrong',    value: wrong,                            cls: 'bg-rose-50 text-rose-700',       border: 'border-rose-200'   },
          { label: 'Skipped',  value: skipped,                          cls: 'bg-amber-50 text-amber-700',    border: 'border-amber-200'  },
        ].map(({ label, value, cls, border }) => (
          <div key={label} className={`flex flex-col items-center rounded-xl border py-4 ${cls} ${border}`}>
            <span className="text-2xl font-extrabold">{value}</span>
            <span className="mt-0.5 text-xs font-medium opacity-80">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Per-question breakdown ────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Answer Review</h2>
        <div className="flex flex-col gap-3">
          {result.answered_questions.map((q, idx) => (
            <QuestionResult key={q.id} q={q} index={idx} />
          ))}
        </div>
      </div>

      {/* ── Back button ──────────────────────────────────── */}
      <div className="flex justify-center pt-2">
        <Link
          to="/student/tests"
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tests
        </Link>
      </div>
    </div>
  );
}
