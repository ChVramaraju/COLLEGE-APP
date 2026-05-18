// ============================================================
// pages/faculty/CreateTestPage.tsx — Create OR Edit a test
// ============================================================
// Route params:
//   /faculty/tests/create          → new test (no testId)
//   /faculty/tests/:testId/edit    → edit existing test
//
// Layout (desktop): 2/3 left (form + questions) | 1/3 right (panel)
// Layout (mobile):  stacked, panel at bottom
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import type { JSX } from 'react';

import { useCreateTest } from '@/hooks/useCreateTest';
import { deriveFacultyTestStatus } from '@/types/test';
import type { TestMetaFormState } from '@/types/test';

import TestForm from '@/components/tests/faculty/TestForm';
import QuestionBuilder from '@/components/tests/faculty/QuestionBuilder';
import TestPublishPanel from '@/components/tests/faculty/TestPublishPanel';
import ConfirmPublishModal from '@/components/tests/faculty/ConfirmPublishModal';

export default function CreateTestPage(): JSX.Element {
  const { testId }  = useParams<{ testId?: string }>();
  const parsedId    = testId ? parseInt(testId, 10) : undefined;
  const navigate    = useNavigate();
  const isEditMode  = Boolean(parsedId);

  const {
    meta, questions, isDirty, savedTestId, isPublished,
    pageStatus, error, successMessage, clearSuccess,
    setMetaField, totalMarks,
    addQuestion, updateQuestion, deleteQuestion,
    moveQuestionUp, moveQuestionDown, duplicateQuestion,
    saveDraft, publishDraft,
  } = useCreateTest(parsedId);

  const [showPublishModal, setShowPublishModal] = useState(false);

  // ── Unsaved-changes warning on page exit ─────────────────────
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isDirty]);

  // ── Redirect to edit after first save ───────────────────────
  useEffect(() => {
    if (savedTestId && !parsedId) {
      navigate(`/faculty/tests/${savedTestId}/edit`, { replace: true });
    }
  }, [savedTestId, parsedId, navigate]);

  // ── Derive status for the panel ──────────────────────────────
  const status = savedTestId
    ? deriveFacultyTestStatus({
        id: savedTestId,
        faculty_id: 0, section_id: 0,
        subject: meta.subject,
        title: meta.title,
        description: meta.description || null,
        total_marks: totalMarks,
        duration_minutes: Number(meta.duration_minutes) || 0,
        start_time: meta.start_time || new Date().toISOString(),
        end_time: meta.end_time || new Date().toISOString(),
        is_published: isPublished,
        is_active: true,
        question_count: questions.length,
        created_at: null,
      })
    : 'draft' as const;

  // ── Loading state (editing) ───────────────────────────────────
  if (isEditMode && pageStatus === 'loading') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100 mb-8" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="h-72 animate-pulse rounded-2xl bg-gray-100" />
            <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  const handlePublishClick = () => {
    if (questions.length === 0) return;
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async () => {
    setShowPublishModal(false);
    await publishDraft();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ── Back nav ── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/faculty/tests"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          My Tests
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">
          {isEditMode ? 'Edit Test' : 'Create Test'}
        </span>
      </div>

      {/* ── Error banner (non-panel errors) ── */}
      {pageStatus === 'error' && error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left column: form + question builder ── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <TestForm
            meta={meta}
            isReadonly={isPublished}
            onChange={(field: keyof TestMetaFormState, value) => setMetaField(field, value)}
          />
          <QuestionBuilder
            questions={questions}
            onAdd={addQuestion}
            onUpdate={updateQuestion}
            onDelete={deleteQuestion}
            onMoveUp={moveQuestionUp}
            onMoveDown={moveQuestionDown}
            onDuplicate={duplicateQuestion}
          />
        </div>

        {/* ── Right column: publish panel ── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <TestPublishPanel
            savedTestId={savedTestId}
            isPublished={isPublished}
            status={status}
            questionCount={questions.length}
            totalMarks={totalMarks}
            pageStatus={pageStatus}
            isDirty={isDirty}
            error={pageStatus === 'error' ? error : null}
            successMessage={successMessage}
            onSave={saveDraft}
            onPublish={handlePublishClick}
            onClearSuccess={clearSuccess}
          />
        </div>
      </div>

      {/* ── Confirm publish modal ── */}
      {showPublishModal && (
        <ConfirmPublishModal
          title={meta.title || 'Untitled Test'}
          questionCount={questions.length}
          totalMarks={totalMarks}
          onConfirm={handleConfirmPublish}
          onCancel={() => setShowPublishModal(false)}
          isPublishing={pageStatus === 'publishing'}
        />
      )}
    </div>
  );
}
