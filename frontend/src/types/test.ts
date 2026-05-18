// ============================================================
// types/test.ts — Online Test Module Type Contracts
// ============================================================
// FOUR CATEGORIES:
//   1. PRIMITIVE / ENUM TYPES   — CorrectOption, TestStatus
//   2. API RESPONSE TYPES       — mirrors backend schemas exactly
//   3. COMPUTED / UI TYPES      — enriched by the hook layer
//   4. HELPER UTILITIES         — pure functions over these types
//
// SCHEMA-AS-ACCESS-CONTROL (backend pattern mirrored here):
//   QuestionForStudent   → during exam  (NO correct_option)
//   QuestionWithAnswer   → after submit (WITH correct_option)
//   These are separate types so TypeScript enforces the same
//   access-control pattern the backend uses at the Pydantic layer.
// ============================================================

// ---------------------------------------------------------------
// CATEGORY 1: PRIMITIVES / ENUMS
// ---------------------------------------------------------------

// Mirrors: backend/models/enums.py → CorrectOption
// LOWERCASE — matches backend DB storage ('a','b','c','d').
// Display as uppercase in UI with .toUpperCase() on the key.
export type CorrectOption = 'a' | 'b' | 'c' | 'd';

// Computed by the useTests hook — NOT from the backend.
// Derived by cross-referencing AvailableTest + StudentResultSummary.
//
//   available   → test is live, student has not started
//   in_progress → test is live, student started but NOT submitted
//   submitted   → test is live OR ended, student already submitted
//   upcoming    → test exists but start_time is in the future (defensive)
//   expired     → test ended without student completing it
export type TestStatus =
  | 'available'
  | 'in_progress'
  | 'submitted'
  | 'upcoming'
  | 'expired';


// ---------------------------------------------------------------
// CATEGORY 2: API RESPONSE TYPES
// ---------------------------------------------------------------

// Mirrors: GET /tests/available response item
// (built inline in routes/test.py — not a named Pydantic schema)
//
// IMPORTANT: already_attempted means ANY attempt record exists.
// It does NOT distinguish between in-progress and submitted.
// The hook layer resolves this by cross-referencing my-results.
export interface AvailableTest {
  id:                number;
  title:             string;
  subject:           string;
  total_marks:       number | null;  // null until test is published
  duration_minutes:  number;
  start_time:        string;         // ISO 8601 datetime string
  end_time:          string;         // ISO 8601 datetime string
  question_count:    number;
  already_attempted: boolean;
}

// Mirrors: schemas/test.py → TestResponse
export interface TestDetail {
  id:               number;
  faculty_id:       number;
  section_id:       number;
  subject:          string;
  title:            string;
  description:      string | null;
  total_marks:      number | null;
  duration_minutes: number;
  start_time:       string;
  end_time:         string;
  is_published:     boolean;
  is_active:        boolean;
  question_count:   number;
  created_at:       string | null;
}

// Mirrors: schemas/test.py → QuestionForStudent
// Intentionally NO correct_option field.
export interface QuestionForStudent {
  id:            number;
  question_text: string;
  option_a:      string;
  option_b:      string;
  option_c:      string;
  option_d:      string;
  marks:         number;
  order_number:  number;
}

// Mirrors: schemas/test.py → QuestionWithAnswer
// Only returned AFTER submission — correct_option is now visible.
export interface QuestionWithAnswer extends QuestionForStudent {
  correct_option: CorrectOption;
  selected_option: CorrectOption | null;
  is_correct:      boolean | null;
  marks_awarded:   number | null;
}

// Mirrors: POST /tests/{id}/attempt response
// (built inline in routes/test.py, mirrors ActiveAttemptResponse)
export interface ActiveAttempt {
  attempt_id:       number;
  test_id:          number;
  title:            string;
  duration_minutes: number;
  started_at:       string;  // ISO 8601
  end_time:         string;  // hard deadline — frontend countdown targets this
  questions:        QuestionForStudent[];
}

// Mirrors: GET /tests/my-results response item
// (built inline in routes/test.py, mirrors StudentResultSummary)
export interface StudentResultSummary {
  attempt_id:   number;
  test_id:      number;
  title:        string;
  subject:      string;
  total_marks:  number;
  score:        number | null;      // null if not yet submitted
  percentage:   number | null;
  is_submitted: boolean;
  submitted_at: string | null;
}

// Mirrors: schemas/test.py → TestResultResponse
// Full graded result returned by GET /tests/attempts/{id}/result
export interface TestResultResponse {
  attempt_id:          number;
  test_id:             number;
  title:               string;
  subject:             string;
  total_marks:         number;
  score:               number;
  percentage:          number;
  is_pass:             boolean;
  submitted_at:        string | null;
  answered_questions:  QuestionWithAnswer[];
}


// ---------------------------------------------------------------
// PHASE 2 EXAM ENGINE TYPES
// ---------------------------------------------------------------

// Single answer entry sent in the submission payload.
// Mirrors: schemas/test.py → AnswerSubmission
export interface SubmissionAnswer {
  question_id:     number;
  selected_option: CorrectOption | null;  // null = question skipped
}

// Shape persisted to localStorage during an active attempt.
// Used to recover answers after browser refresh or crash.
// Key: `sce_exam_${attemptId}`
export interface PersistedExamState {
  attemptId:    number;
  answers:      Record<number, CorrectOption | null>;
  reviewFlags:  number[];   // array (JSON-serialisable — Set is not)
  currentIndex: number;
}

// Visual state of each button in the QuestionPalette.
export type QuestionPaletteStatus =
  | 'current'              // actively displayed
  | 'answered'             // student selected an option
  | 'review'               // flagged for review (regardless of answered state)
  | 'visited-unanswered'   // seen but no option chosen
  | 'unvisited';           // never opened

// ---------------------------------------------------------------
// CATEGORY 3: COMPUTED / UI TYPES
// ---------------------------------------------------------------

// AvailableTest enriched with the resolved TestStatus.
// Created by the useTests hook — never sent from the backend directly.
export interface TestWithStatus extends AvailableTest {
  status: TestStatus;
}

// Per-option data used by TestCard and exam rendering.
// Maps the raw option_a/b/c/d fields to a structured list.
export interface TestOption {
  key:   CorrectOption;
  label: string;
  text:  string;
}


// ---------------------------------------------------------------
// CATEGORY 4: HELPER UTILITIES
// ---------------------------------------------------------------

// Returns a stable color class for a subject name.
// Used for subject badges on TestCard. The same subject always
// gets the same color within a session (hash-based, not random).
const SUBJECT_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',
  'bg-teal-100   text-teal-700   dark:bg-teal-900/30   dark:text-teal-300',
  'bg-rose-100   text-rose-700   dark:bg-rose-900/30   dark:text-rose-300',
  'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
] as const;

export function getSubjectColorClass(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

// ---------------------------------------------------------------
// FACULTY-SIDE TYPES (Phase 3 — Test Management)
// ---------------------------------------------------------------

// Derived status for a test from the faculty perspective.
export type FacultyTestStatus = 'draft' | 'scheduled' | 'active' | 'expired';

export function deriveFacultyTestStatus(test: TestDetail): FacultyTestStatus {
  if (!test.is_published) return 'draft';
  const now  = new Date();
  const start = new Date(test.start_time);
  const end   = new Date(test.end_time);
  if (now < start) return 'scheduled';
  if (now <= end)  return 'active';
  return 'expired';
}

export const FACULTY_STATUS_CONFIG: Record<
  FacultyTestStatus,
  { label: string; badgeClass: string }
> = {
  draft:     { label: 'Draft',     badgeClass: 'bg-gray-100   text-gray-600   ring-1 ring-gray-300'   },
  scheduled: { label: 'Scheduled', badgeClass: 'bg-blue-100   text-blue-700   ring-1 ring-blue-200'   },
  active:    { label: 'Active',    badgeClass: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  expired:   { label: 'Expired',   badgeClass: 'bg-rose-100   text-rose-700   ring-1 ring-rose-200'   },
};

// Mirrors: schemas/test.py → FacultyQuestionResponse
// Returned by GET /tests/{id}/questions — includes correct_option.
export interface FacultyQuestion {
  id:            number;
  question_text: string;
  option_a:      string;
  option_b:      string;
  option_c:      string;
  option_d:      string;
  correct_option: CorrectOption;
  marks:          number;
  order_number:   number;
}

// Local per-question form state inside the Create/Edit test page.
// tempId is a client-only UUID used as React key before the question
// gets a real DB id from the backend.
export interface QuestionFormState {
  tempId:        string;           // crypto.randomUUID()
  id?:           number;           // set after saving to DB
  question_text: string;
  option_a:      string;
  option_b:      string;
  option_c:      string;
  option_d:      string;
  correct_option: CorrectOption;   // 'a'|'b'|'c'|'d'
  marks:          number;          // 1–10
  order_number:   number;          // 1-based sequential
}

// Payload for POST /tests/ (create) and PATCH /tests/{id} (update).
export interface TestMetaFormState {
  section_id:       number | '';
  subject:          string;
  title:            string;
  description:      string;
  duration_minutes: number | '';
  start_time:       string;   // datetime-local string 'YYYY-MM-DDTHH:mm'
  end_time:         string;
}

// Minimal section shape for the create-test section dropdown.
// Mirrors: schemas/section.py → SectionResponse (subset).
export interface SectionBrief {
  id:            number;
  name:          string;
  department:    string;
  semester:      number;
  academic_year: string;
}


// Mirrors: schemas/test.py → AllResultsItem
export interface AllResultsItem {
  attempt_id:   number;
  student_id:   number;
  roll_number:  string;
  full_name:    string | null;
  score:        number | null;
  total_marks:  number;
  percentage:   number | null;
  is_submitted: boolean;
  submitted_at: string | null;
}

// Mirrors: schemas/test.py → TestAnalytics
export interface QuestionAccuracy {
  question_id:         number;
  question_text:       string;
  total_answers:       number;
  correct_answers:     number;
  accuracy_percentage: number;
}

export interface TestAnalytics {
  test_id:            number;
  title:              string;
  subject:            string;
  total_marks:        number;
  total_attempts:     number;
  submitted_count:    number;
  average_score:      number;
  average_percentage: number;
  highest_score:      number;
  lowest_score:       number;
  pass_count:         number;
  fail_count:         number;
  topper_roll_number: string | null;
  topper_score:       number | null;
  question_accuracy:  QuestionAccuracy[];
}

// TestStatus → display label + Tailwind badge classes
export const TEST_STATUS_CONFIG: Record<
  TestStatus,
  { label: string; badgeClass: string }
> = {
  available:   { label: 'Available',   badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-300'   },
  submitted:   { label: 'Submitted',   badgeClass: 'bg-blue-100    text-blue-700    dark:bg-blue-900/30    dark:text-blue-300'    },
  upcoming:    { label: 'Upcoming',    badgeClass: 'bg-purple-100  text-purple-700  dark:bg-purple-900/30  dark:text-purple-300'  },
  expired:     { label: 'Expired',     badgeClass: 'bg-gray-100    text-gray-500    dark:bg-gray-800       dark:text-gray-400'    },
};

// Computes TestStatus from available test data + submitted test ID set.
// Pure function — no side effects, easily testable.
export function deriveTestStatus(
  test:             AvailableTest,
  submittedTestIds: ReadonlySet<number>,
): TestStatus {
  const now     = new Date();
  const endTime = new Date(test.end_time);

  if (now > endTime) return 'expired';
  if (test.already_attempted && submittedTestIds.has(test.id)) return 'submitted';
  if (test.already_attempted) return 'in_progress';
  return 'available';
}
