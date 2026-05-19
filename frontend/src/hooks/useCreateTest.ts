// ============================================================
// hooks/useCreateTest.ts — Create / Edit Test Form State
// ============================================================
// useReducer-based state manager for the test creation/editing page.
//
// ARCHITECTURE:
//   - TestFormReducer owns all mutable state
//   - saveDraft()  → POST /tests/ (new) or PATCH /tests/{id} (existing)
//                  → then PUT /tests/{id}/questions
//   - publishDraft()  → saveDraft() + PATCH /tests/{id}/publish
//   - Question CRUD is purely local until saveDraft() is called
//
// DIRTY FLAG:
//   isDirty tracks unsaved local changes.
//   The page component attaches a beforeunload listener when isDirty.
// ============================================================

import { useReducer, useEffect, useCallback } from 'react';
import type { TestMetaFormState, QuestionFormState } from '@/types/test';
import {
  createTest,
  updateTestMeta,
  getTestById,
  getTestQuestionsForFaculty,
  replaceTestQuestions,
  publishTest,
} from '@/services/testService';

// ── Types ────────────────────────────────────────────────────

interface CreateTestState {
  meta:          TestMetaFormState;
  questions:     QuestionFormState[];
  isDirty:       boolean;
  savedTestId:   number | null;
  isPublished:   boolean;
  pageStatus:    'idle' | 'loading' | 'saving' | 'publishing' | 'error';
  error:         string | null;
  successMessage: string | null;
}

type Action =
  | { type: 'SET_META';     field: keyof TestMetaFormState; value: TestMetaFormState[keyof TestMetaFormState] }
  | { type: 'ADD_QUESTION' }
  | { type: 'UPDATE_QUESTION'; tempId: string; updates: Partial<QuestionFormState> }
  | { type: 'DELETE_QUESTION'; tempId: string }
  | { type: 'MOVE_UP';   tempId: string }
  | { type: 'MOVE_DOWN'; tempId: string }
  | { type: 'DUPLICATE'; tempId: string }
  | { type: 'LOAD_SUCCESS'; testId: number; meta: TestMetaFormState; questions: QuestionFormState[]; isPublished: boolean }
  | { type: 'SAVE_SUCCESS'; testId: number; isPublished?: boolean; message?: string }
  | { type: 'SET_STATUS'; status: CreateTestState['pageStatus']; error?: string | null }
  | { type: 'CLEAR_SUCCESS' };

// ── Helpers ──────────────────────────────────────────────────

function blankQuestion(order: number): QuestionFormState {
  return {
    tempId:        crypto.randomUUID(),
    question_text: '',
    option_a:      '',
    option_b:      '',
    option_c:      '',
    option_d:      '',
    correct_option: 'a',
    marks:          1,
    order_number:   order,
  };
}

const DEFAULT_META: TestMetaFormState = {
  section_id:       '',
  subject:          '',
  title:            '',
  description:      '',
  duration_minutes: '',
  start_time:       '',
  end_time:         '',
};

function reorder(questions: QuestionFormState[]): QuestionFormState[] {
  return questions.map((q, i) => ({ ...q, order_number: i + 1 }));
}

// ── Reducer ──────────────────────────────────────────────────

function reducer(state: CreateTestState, action: Action): CreateTestState {
  switch (action.type) {

    case 'SET_META':
      return {
        ...state,
        meta: { ...state.meta, [action.field]: action.value },
        isDirty: true,
      };

    case 'ADD_QUESTION':
      return {
        ...state,
        questions: [...state.questions, blankQuestion(state.questions.length + 1)],
        isDirty: true,
      };

    case 'UPDATE_QUESTION':
      return {
        ...state,
        questions: state.questions.map(q =>
          q.tempId === action.tempId ? { ...q, ...action.updates } : q,
        ),
        isDirty: true,
      };

    case 'DELETE_QUESTION':
      return {
        ...state,
        questions: reorder(state.questions.filter(q => q.tempId !== action.tempId)),
        isDirty: true,
      };

    case 'MOVE_UP': {
      const idx = state.questions.findIndex(q => q.tempId === action.tempId);
      if (idx <= 0) return state;
      const arr = [...state.questions];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return { ...state, questions: reorder(arr), isDirty: true };
    }

    case 'MOVE_DOWN': {
      const idx = state.questions.findIndex(q => q.tempId === action.tempId);
      if (idx < 0 || idx >= state.questions.length - 1) return state;
      const arr = [...state.questions];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { ...state, questions: reorder(arr), isDirty: true };
    }

    case 'DUPLICATE': {
      const src = state.questions.find(q => q.tempId === action.tempId);
      if (!src) return state;
      const idx   = state.questions.findIndex(q => q.tempId === action.tempId);
      const clone = { ...src, tempId: crypto.randomUUID(), id: undefined };
      const arr   = [...state.questions];
      arr.splice(idx + 1, 0, clone);
      return { ...state, questions: reorder(arr), isDirty: true };
    }

    case 'LOAD_SUCCESS':
      return {
        ...state,
        meta:        action.meta,
        questions:   action.questions,
        savedTestId: action.testId,
        isPublished: action.isPublished,
        isDirty:     false,
        pageStatus:  'idle',
        error:       null,
      };

    case 'SAVE_SUCCESS':
      return {
        ...state,
        savedTestId:    action.testId,
        isPublished:    action.isPublished ?? state.isPublished,
        isDirty:        false,
        pageStatus:     'idle',
        error:          null,
        successMessage: action.message ?? 'Saved successfully.',
      };

    case 'SET_STATUS':
      return {
        ...state,
        pageStatus: action.status,
        error:      action.error ?? null,
      };

    case 'CLEAR_SUCCESS':
      return { ...state, successMessage: null };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────

export interface UseCreateTestReturn {
  meta:         TestMetaFormState;
  questions:    QuestionFormState[];
  isDirty:      boolean;
  savedTestId:  number | null;
  isPublished:  boolean;
  pageStatus:   CreateTestState['pageStatus'];
  error:        string | null;
  successMessage: string | null;
  clearSuccess: () => void;
  setMetaField: (field: keyof TestMetaFormState, value: TestMetaFormState[keyof TestMetaFormState]) => void;
  addQuestion:       () => void;
  updateQuestion:    (tempId: string, updates: Partial<QuestionFormState>) => void;
  deleteQuestion:    (tempId: string) => void;
  moveQuestionUp:    (tempId: string) => void;
  moveQuestionDown:  (tempId: string) => void;
  duplicateQuestion: (tempId: string) => void;
  totalMarks: number;
  saveDraft:    () => Promise<void>;
  publishDraft: () => Promise<void>;
}

export function useCreateTest(existingTestId?: number): UseCreateTestReturn {
  const [state, dispatch] = useReducer(reducer, {
    meta:           DEFAULT_META,
    questions:      [],
    isDirty:        false,
    savedTestId:    existingTestId ?? null,
    isPublished:    false,
    pageStatus:     existingTestId ? 'loading' : 'idle',
    error:          null,
    successMessage: null,
  });

  // ── Load existing test if editing ───────────────────────────
  useEffect(() => {
    if (!existingTestId) return;
    let cancelled = false;
    dispatch({ type: 'SET_STATUS', status: 'loading' });

    Promise.all([
      getTestById(existingTestId),
      getTestQuestionsForFaculty(existingTestId),
    ])
      .then(([test, questions]) => {
        if (cancelled) return;
        const toLocalDT = (iso: string) =>
          iso ? iso.slice(0, 16) : '';
        dispatch({
          type: 'LOAD_SUCCESS',
          testId: test.id,
          isPublished: test.is_published,
          meta: {
            section_id:       test.section_id,
            subject:          test.subject,
            title:            test.title,
            description:      test.description ?? '',
            duration_minutes: test.duration_minutes,
            start_time:       toLocalDT(test.start_time),
            end_time:         toLocalDT(test.end_time),
          },
          questions: questions.map((q, i) => ({
            tempId:         crypto.randomUUID(),
            id:             q.id,
            question_text:  q.question_text,
            option_a:       q.option_a,
            option_b:       q.option_b,
            option_c:       q.option_c,
            option_d:       q.option_d,
            correct_option: q.correct_option,
            marks:          q.marks,
            order_number:   i + 1,
          })),
        });
      })
      .catch(err => {
        if (!cancelled) {
          dispatch({
            type: 'SET_STATUS',
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to load test.',
          });
        }
      });

    return () => { cancelled = true; };
  }, [existingTestId]);

  // ── Validation ──────────────────────────────────────────────
  function validateMeta(): string | null {
    const { meta } = state;
    if (!meta.title.trim())                   return 'Test title is required.';
    if (!meta.subject.trim())                 return 'Subject is required.';
    if (meta.section_id === '')               return 'Section is required.';
    if (meta.duration_minutes === '' || Number(meta.duration_minutes) < 5)
      return 'Duration must be at least 5 minutes.';
    if (!meta.start_time)                     return 'Start time is required.';
    if (!meta.end_time)                       return 'End time is required.';
    if (new Date(meta.end_time) <= new Date(meta.start_time))
      return 'End time must be after start time.';
    return null;
  }

  function validateQuestions(): string | null {
    for (let i = 0; i < state.questions.length; i++) {
      const q = state.questions[i];
      const num = i + 1;
      if (!q.question_text.trim()) return `Question ${num}: text is required.`;
      if (!q.option_a.trim())      return `Question ${num}: Option A is required.`;
      if (!q.option_b.trim())      return `Question ${num}: Option B is required.`;
      if (!q.option_c.trim())      return `Question ${num}: Option C is required.`;
      if (!q.option_d.trim())      return `Question ${num}: Option D is required.`;
      if (q.marks < 1 || q.marks > 10) return `Question ${num}: marks must be 1–10.`;
    }
    return null;
  }

  // ── saveDraft ────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    const metaErr = validateMeta();
    if (metaErr) { dispatch({ type: 'SET_STATUS', status: 'error', error: metaErr }); return; }
    const qErr = validateQuestions();
    if (qErr)    { dispatch({ type: 'SET_STATUS', status: 'error', error: qErr }); return; }

    dispatch({ type: 'SET_STATUS', status: 'saving' });
    try {
      const { meta, questions, savedTestId } = state;
      const payload = {
        section_id:       meta.section_id as number,
        subject:          meta.subject,
        title:            meta.title,
        description:      meta.description || '',
        duration_minutes: meta.duration_minutes as number,
        start_time:       new Date(meta.start_time).toISOString(),
        end_time:         new Date(meta.end_time).toISOString(),
      };

      let testId: number;
      if (savedTestId) {
        await updateTestMeta(savedTestId, payload);
        testId = savedTestId;
      } else {
        const created = await createTest(payload);
        testId = created.id;
      }

      if (questions.length > 0) {
        await replaceTestQuestions(
          testId,
          questions.map(q => ({
            question_text:  q.question_text,
            option_a:       q.option_a,
            option_b:       q.option_b,
            option_c:       q.option_c,
            option_d:       q.option_d,
            correct_option: q.correct_option,
            marks:          q.marks,
            order_number:   q.order_number,
          })),
        );
      }
      dispatch({ type: 'SAVE_SUCCESS', testId, message: 'Draft saved.' });
    } catch (err) {
      dispatch({
        type: 'SET_STATUS',
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to save draft.',
      });
    }
  }, [state]);

  // ── publishDraft ─────────────────────────────────────────────
  const publishDraft = useCallback(async () => {
    const metaErr = validateMeta();
    if (metaErr) { dispatch({ type: 'SET_STATUS', status: 'error', error: metaErr }); return; }
    if (state.questions.length === 0) {
      dispatch({ type: 'SET_STATUS', status: 'error', error: 'Add at least one question before publishing.' });
      return;
    }
    const qErr = validateQuestions();
    if (qErr) { dispatch({ type: 'SET_STATUS', status: 'error', error: qErr }); return; }

    dispatch({ type: 'SET_STATUS', status: 'publishing' });
    try {
      const { meta, questions, savedTestId } = state;
      const payload = {
        section_id:       meta.section_id as number,
        subject:          meta.subject,
        title:            meta.title,
        description:      meta.description || '',
        duration_minutes: meta.duration_minutes as number,
        start_time:       new Date(meta.start_time).toISOString(),
        end_time:         new Date(meta.end_time).toISOString(),
      };

      let testId: number;
      if (savedTestId) {
        await updateTestMeta(savedTestId, payload);
        testId = savedTestId;
      } else {
        const created = await createTest(payload);
        testId = created.id;
      }

      await replaceTestQuestions(
        testId,
        questions.map(q => ({
          question_text:  q.question_text,
          option_a:       q.option_a,
          option_b:       q.option_b,
          option_c:       q.option_c,
          option_d:       q.option_d,
          correct_option: q.correct_option,
          marks:          q.marks,
          order_number:   q.order_number,
        })),
      );

      await publishTest(testId);
      dispatch({ type: 'SAVE_SUCCESS', testId, isPublished: true, message: 'Test published successfully!' });
    } catch (err) {
      dispatch({
        type: 'SET_STATUS',
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to publish test.',
      });
    }
  }, [state]);

  const totalMarks = state.questions.reduce((sum, q) => sum + q.marks, 0);

  return {
    meta:         state.meta,
    questions:    state.questions,
    isDirty:      state.isDirty,
    savedTestId:  state.savedTestId,
    isPublished:  state.isPublished,
    pageStatus:   state.pageStatus,
    error:        state.error,
    successMessage: state.successMessage,
    clearSuccess: () => dispatch({ type: 'CLEAR_SUCCESS' }),
    setMetaField: (field, value) => dispatch({ type: 'SET_META', field, value }),
    addQuestion:       () => dispatch({ type: 'ADD_QUESTION' }),
    updateQuestion:    (tempId, updates) => dispatch({ type: 'UPDATE_QUESTION', tempId, updates }),
    deleteQuestion:    tempId => dispatch({ type: 'DELETE_QUESTION', tempId }),
    moveQuestionUp:    tempId => dispatch({ type: 'MOVE_UP', tempId }),
    moveQuestionDown:  tempId => dispatch({ type: 'MOVE_DOWN', tempId }),
    duplicateQuestion: tempId => dispatch({ type: 'DUPLICATE', tempId }),
    totalMarks,
    saveDraft,
    publishDraft,
  };
}
