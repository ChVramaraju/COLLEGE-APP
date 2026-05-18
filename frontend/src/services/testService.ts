// ============================================================
// services/testService.ts — Online Tests API Layer
// ============================================================
// Four read-only / action functions that cover Phase 1 needs.
// Phase 2 (exam engine, submission, analytics) will add:
//   submitAttempt(), getAttemptResult(), getTestAnalytics()
//
// ALL functions use the shared Axios apiClient, which:
//   - Injects the JWT Authorization header automatically
//   - Normalises FastAPI { detail: "..." } errors to Error objects
//   - Handles 401 by clearing auth state and redirecting to /login
//
// WHY Axios (not fetch) here?
//   JSON endpoints: Axios is correct — interceptors, transforms,
//   error normalisation all apply correctly to JSON.
//   Binary endpoints (notes downloads): those use native fetch.
// ============================================================

import apiClient from '@/api/client';
import type {
  AvailableTest,
  TestDetail,
  ActiveAttempt,
  StudentResultSummary,
  TestResultResponse,
  SubmissionAnswer,
  FacultyQuestion,
  TestMetaFormState,
  QuestionFormState,
  AllResultsItem,
  TestAnalytics,
  SectionBrief,
} from '@/types/test';


// ---------------------------------------------------------------
// GET /tests/available
// Returns tests that are currently live for the student's section.
// Backend filters: published + active + within start/end window.
// Each item includes `already_attempted` so the UI can show
// correct CTA ("Start Test" vs "Resume").
// ---------------------------------------------------------------
export async function getAvailableTests(): Promise<AvailableTest[]> {
  const res = await apiClient.get<AvailableTest[]>('/tests/available');
  return res.data;
}


// ---------------------------------------------------------------
// GET /tests/{testId}
// Fetch full test metadata for a single test by ID.
// Used by the instructions modal to show description + details
// before the student confirms they want to start.
// ---------------------------------------------------------------
export async function getTestById(testId: number): Promise<TestDetail> {
  const res = await apiClient.get<TestDetail>(`/tests/${testId}`);
  return res.data;
}


// ---------------------------------------------------------------
// POST /tests/{testId}/attempt
// Start OR resume a student's test attempt.
//
// BACKEND BEHAVIOUR:
//   → No existing attempt     → creates new attempt, returns questions
//   → Existing, not submitted → resumes attempt, returns questions
//   → Existing, submitted     → 409 "already submitted" error
//
// CALLER RESPONSIBILITY:
//   If the response is a 409 with "already submitted", the caller
//   should redirect to the results page (/student/tests/:id/result).
//   The useTests hook handles this automatically.
//
// Returns: attempt_id, end_time (hard deadline), questions list
// Phase 2 stores this in Zustand and drives the exam engine.
// ---------------------------------------------------------------
export async function startOrResumeAttempt(testId: number): Promise<ActiveAttempt> {
  const res = await apiClient.post<ActiveAttempt>(`/tests/${testId}/attempt`);
  return res.data;
}


// ---------------------------------------------------------------
// POST /tests/attempts/{attemptId}/submit
// Sends the student's answers and receives a fully graded result.
//
// BACKEND BEHAVIOUR:
//   → Grades each answer in one pass (O(n))
//   → Marks attempt as submitted with timestamp
//   → Returns TestResultResponse with correct_option revealed
//   → 400 if attempt already submitted
//   → 403 if attempt belongs to a different student
//   → 410 if attempt's test window has expired
// ---------------------------------------------------------------
export async function submitAttempt(
  attemptId: number,
  answers:   SubmissionAnswer[],
): Promise<TestResultResponse> {
  const res = await apiClient.post<TestResultResponse>(
    `/tests/attempts/${attemptId}/submit`,
    { answers },
  );
  return res.data;
}


// ---------------------------------------------------------------
// GET /tests/attempts/{attemptId}/result
// Fetch the graded result for a previously submitted attempt.
//
// Used by:
//   → TestResultPage on mount (when location.state lacks result)
//   → Direct deep-link to result page (?attemptId=N in URL)
// ---------------------------------------------------------------
export async function getAttemptResult(
  attemptId: number,
): Promise<TestResultResponse> {
  const res = await apiClient.get<TestResultResponse>(
    `/tests/attempts/${attemptId}/result`,
  );
  return res.data;
}


// ---------------------------------------------------------------
// GET /tests/my-results
// Returns a compact summary of ALL this student's test attempts
// (both in-progress and submitted).
//
// Used in Phase 1 to cross-reference `already_attempted` flag:
//   → If test_id appears here with is_submitted=true → "Submitted"
//   → If test_id appears here with is_submitted=false → "In Progress"
//
// Phase 2 also uses this to populate the Results History page.
// ---------------------------------------------------------------
export async function getMyResults(): Promise<StudentResultSummary[]> {
  const res = await apiClient.get<StudentResultSummary[]>('/tests/my-results');
  return res.data;
}


// ============================================================
// FACULTY API FUNCTIONS
// ============================================================

// GET /tests/my-tests — faculty's own test list
export async function getFacultyTests(): Promise<TestDetail[]> {
  const res = await apiClient.get<TestDetail[]>('/tests/my-tests');
  return res.data;
}

// POST /tests/ — create a draft test
export async function createTest(
  data: Omit<TestMetaFormState, 'section_id' | 'duration_minutes'> & {
    section_id: number;
    duration_minutes: number;
  },
): Promise<TestDetail> {
  const res = await apiClient.post<TestDetail>('/tests/', data);
  return res.data;
}

// PATCH /tests/{id} — update draft test metadata
export async function updateTestMeta(
  testId: number,
  data: Partial<Omit<TestMetaFormState, 'section_id' | 'duration_minutes'> & {
    section_id?: number;
    duration_minutes?: number;
  }>,
): Promise<TestDetail> {
  const res = await apiClient.patch<TestDetail>(`/tests/${testId}`, data);
  return res.data;
}

// DELETE /tests/{id} — soft-delete
export async function deleteTest(testId: number): Promise<void> {
  await apiClient.delete(`/tests/${testId}`);
}

// GET /tests/{id}/questions — faculty-only (includes correct_option)
export async function getTestQuestionsForFaculty(
  testId: number,
): Promise<FacultyQuestion[]> {
  const res = await apiClient.get<FacultyQuestion[]>(`/tests/${testId}/questions`);
  return res.data;
}

// PUT /tests/{id}/questions — replace all questions atomically
export async function replaceTestQuestions(
  testId: number,
  questions: Array<Omit<QuestionFormState, 'tempId' | 'id'>>,
): Promise<{ question_count: number; test_id: number }> {
  const res = await apiClient.put<{ question_count: number; test_id: number }>(
    `/tests/${testId}/questions`,
    { questions },
  );
  return res.data;
}

// PATCH /tests/{id}/publish
export async function publishTest(testId: number): Promise<TestDetail> {
  const res = await apiClient.patch<TestDetail>(`/tests/${testId}/publish`);
  return res.data;
}

// PATCH /tests/{id}/unpublish
export async function unpublishTest(testId: number): Promise<TestDetail> {
  const res = await apiClient.patch<TestDetail>(`/tests/${testId}/unpublish`);
  return res.data;
}

// GET /tests/{id}/all-results — all student attempts
export async function getTestAllResults(
  testId: number,
): Promise<AllResultsItem[]> {
  const res = await apiClient.get<AllResultsItem[]>(`/tests/${testId}/all-results`);
  return res.data;
}

// GET /tests/{id}/analytics
export async function getTestAnalytics(
  testId: number,
): Promise<TestAnalytics> {
  const res = await apiClient.get<TestAnalytics>(`/tests/${testId}/analytics`);
  return res.data;
}

// GET /faculty/me/sections — sections assigned to the logged-in faculty
// Used to populate the section dropdown in the create-test form.
export async function getFacultySections(): Promise<SectionBrief[]> {
  const res = await apiClient.get<SectionBrief[]>('/faculty/me/sections');
  return res.data;
}
