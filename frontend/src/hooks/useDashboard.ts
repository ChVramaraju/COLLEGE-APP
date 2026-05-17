// ============================================================
// hooks/useDashboard.ts — Dashboard Data Orchestration
// ============================================================
// Layer 2: Fetches from 8 APIs, manages loading states,
// isolates per-section failures, exposes clean state to UI.
//
// WHY useReducer INSTEAD OF multiple useState calls?
//   With 8 APIs each needing their own status, data, and error,
//   that would be 24 useState calls (8 × status + data + error).
//   useReducer collapses that into ONE dispatch call per update.
//   The state shape is explicit and impossible to get out of sync.
//
// FETCH STRATEGY: Two-phase parallel loading
//
//   PHASE 1 (getStudentProfile):
//     The student's section_id is embedded in their profile.
//     Notes are section-scoped — can't fetch them without section_id.
//     So profile is fetched first, alone.
//
//   PHASE 2 (everything else in parallel via Promise.allSettled):
//     Promise.allSettled means ALL promises run simultaneously
//     and we wait for ALL of them — whether they succeed or fail.
//     If placement API returns 500, the 6 other sections still load.
//     Each section is independently successful or failed.
//
//   This is how Notion, Linear, and enterprise dashboards work.
//   Critical data (attendance, notifications) never blocks on
//   non-critical data (placement).
//
// ERROR ISOLATION:
//   Each API result is wrapped in a DashboardSectionStatus.
//   The UI renders: loaded data OR a per-section error card.
//   One section failing never removes another section's data.
// ============================================================

import { useReducer, useEffect, useCallback } from 'react';
import type { DashboardData, DashboardState, DashboardSectionStatus } from '@/types/dashboard';
import {
  getStudentProfile,
  getAttendanceAnalytics,
  getNotificationsPreview,
  getAvailableTests,
  getSectionNotes,
  getTranscript,
  getActivePostings,
  getMyApplications,
} from '@/services/dashboardService';

// ---------------------------------------------------------------
// STATE SHAPE
// ---------------------------------------------------------------
type SectionKey = keyof DashboardData;

interface State {
  data: Partial<DashboardData>;
  status: Record<SectionKey, DashboardSectionStatus>;
  errors: Partial<Record<SectionKey, string>>;
}

// ---------------------------------------------------------------
// INITIAL STATE — everything is loading
// ---------------------------------------------------------------
const allSections: SectionKey[] = [
  'profile', 'attendance', 'notifications', 'tests',
  'notes', 'transcript', 'postings', 'applications',
];

const buildInitialState = (): State => ({
  data: {},
  status: Object.fromEntries(
    allSections.map(k => [k, 'loading' as DashboardSectionStatus])
  ) as Record<SectionKey, DashboardSectionStatus>,
  errors: {},
});

// ---------------------------------------------------------------
// ACTIONS
// ---------------------------------------------------------------
type Action =
  | { type: 'SECTION_SUCCESS'; key: SectionKey; payload: DashboardData[SectionKey] }
  | { type: 'SECTION_ERROR';   key: SectionKey; error: string }
  | { type: 'RESET' };

// ---------------------------------------------------------------
// REDUCER
// ---------------------------------------------------------------
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SECTION_SUCCESS':
      return {
        ...state,
        data: { ...state.data, [action.key]: action.payload },
        status: { ...state.status, [action.key]: 'success' },
        errors: { ...state.errors, [action.key]: undefined },
      };
    case 'SECTION_ERROR':
      return {
        ...state,
        status: { ...state.status, [action.key]: 'error' },
        errors: { ...state.errors, [action.key]: action.error },
      };
    case 'RESET':
      return buildInitialState();
  }
}

// ---------------------------------------------------------------
// HELPER: extract error message from unknown catch value
// ---------------------------------------------------------------
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Failed to load data';
}

// ---------------------------------------------------------------
// HELPER: resolve a Promise.allSettled result
// ---------------------------------------------------------------
function resolveResult<T>(
  result: PromiseSettledResult<T>,
  key: SectionKey,
  dispatch: (a: Action) => void,
) {
  if (result.status === 'fulfilled') {
    dispatch({ type: 'SECTION_SUCCESS', key, payload: result.value as DashboardData[SectionKey] });
  } else {
    dispatch({ type: 'SECTION_ERROR', key, error: getErrorMessage(result.reason) });
  }
}

// ---------------------------------------------------------------
// THE HOOK
// ---------------------------------------------------------------
export function useDashboard(): DashboardState {
  const [state, dispatch] = useReducer(reducer, buildInitialState());

  const fetchAll = useCallback(async () => {
    // Reset to loading state if refetching
    dispatch({ type: 'RESET' });

    // -----------------------------------------------------------
    // PHASE 1: Fetch student profile alone
    // We need section_id for the notes fetch in Phase 2.
    // -----------------------------------------------------------
    let sectionId: number | null = null;

    try {
      const profile = await getStudentProfile();
      sectionId = profile.section?.id ?? null;
      dispatch({ type: 'SECTION_SUCCESS', key: 'profile', payload: profile });
    } catch (err) {
      dispatch({ type: 'SECTION_ERROR', key: 'profile', error: getErrorMessage(err) });
      // Profile failed — mark ALL sections as error since without
      // section_id we can't even fetch notes.
      // Other data-independent sections still run below.
    }

    // -----------------------------------------------------------
    // PHASE 2: Fire ALL remaining calls simultaneously.
    // Promise.allSettled: each result is either fulfilled or rejected.
    // One failure does NOT cancel the others.
    //
    // If sectionId is null (no section assigned yet),
    // notes call is skipped and returns empty array instead.
    // -----------------------------------------------------------
    const [
      attendanceResult,
      notificationsResult,
      testsResult,
      notesResult,
      transcriptResult,
      postingsResult,
      applicationsResult,
    ] = await Promise.allSettled([
      getAttendanceAnalytics(),
      getNotificationsPreview(),
      getAvailableTests(),
      sectionId !== null ? getSectionNotes(sectionId) : Promise.resolve([]),
      getTranscript(),
      getActivePostings(),
      getMyApplications(),
    ]);

    // Dispatch each result independently
    resolveResult(attendanceResult,    'attendance',    dispatch);
    resolveResult(notificationsResult, 'notifications', dispatch);
    resolveResult(testsResult,         'tests',         dispatch);
    resolveResult(notesResult,         'notes',         dispatch);
    resolveResult(transcriptResult,    'transcript',    dispatch);
    resolveResult(postingsResult,      'postings',      dispatch);
    resolveResult(applicationsResult,  'applications',  dispatch);

  }, []);

  // Run on mount
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Derived state — computed from raw state for convenience
  const isAnyLoading = allSections.some(k => state.status[k] === 'loading');
  const isAllLoaded  = allSections.every(k => state.status[k] !== 'loading');

  return {
    data:         state.data,
    status:       state.status,
    errors:       state.errors,
    isAnyLoading,
    isAllLoaded,
    refetch:      fetchAll,
  };
}
