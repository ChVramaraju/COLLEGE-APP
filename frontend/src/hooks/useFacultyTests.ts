// ============================================================
// hooks/useFacultyTests.ts — Faculty Test Dashboard State
// ============================================================
// Manages the list of faculty's own tests with live search,
// status filter, and action handlers (delete / publish / unpublish).
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TestDetail, FacultyTestStatus } from '@/types/test';
import { deriveFacultyTestStatus } from '@/types/test';
import {
  getFacultyTests,
  deleteTest,
  publishTest,
  unpublishTest,
} from '@/services/testService';

export interface FacultyTestsFilter {
  search: string;
  status: FacultyTestStatus | 'all';
}

export interface UseFacultyTestsReturn {
  tests:         TestDetail[];
  filteredTests: TestDetail[];
  isLoading:     boolean;
  isError:       boolean;
  errorMessage:  string | null;
  filter:        FacultyTestsFilter;
  setFilter:     (partial: Partial<FacultyTestsFilter>) => void;
  handleDelete:  (testId: number) => Promise<void>;
  handlePublish: (testId: number) => Promise<void>;
  handleUnpublish: (testId: number) => Promise<void>;
  retry:         () => void;
  actionError:   string | null;
  clearActionError: () => void;
  actionTestId:  number | null;
}

export function useFacultyTests(): UseFacultyTestsReturn {
  const [tests,        setTests]        = useState<TestDetail[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isError,      setIsError]      = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchKey,     setFetchKey]     = useState(0);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [actionTestId, setActionTestId] = useState<number | null>(null);
  const [filter, setFilterState]        = useState<FacultyTestsFilter>({
    search: '',
    status: 'all',
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);

    getFacultyTests()
      .then(data => { if (!cancelled) setTests(data); })
      .catch(err  => {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load tests.');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [fetchKey]);

  const filteredTests = useMemo(() => {
    let result = tests;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        t => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q),
      );
    }
    if (filter.status !== 'all') {
      result = result.filter(t => deriveFacultyTestStatus(t) === filter.status);
    }
    return result;
  }, [tests, filter]);

  const setFilter = useCallback((partial: Partial<FacultyTestsFilter>) => {
    setFilterState(prev => ({ ...prev, ...partial }));
  }, []);

  const handleDelete = useCallback(async (testId: number) => {
    setActionTestId(testId);
    setActionError(null);
    try {
      await deleteTest(testId);
      setTests(prev => prev.filter(t => t.id !== testId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete test.');
    } finally {
      setActionTestId(null);
    }
  }, []);

  const handlePublish = useCallback(async (testId: number) => {
    setActionTestId(testId);
    setActionError(null);
    try {
      const updated = await publishTest(testId);
      setTests(prev => prev.map(t => t.id === testId ? updated : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish test.');
    } finally {
      setActionTestId(null);
    }
  }, []);

  const handleUnpublish = useCallback(async (testId: number) => {
    setActionTestId(testId);
    setActionError(null);
    try {
      const updated = await unpublishTest(testId);
      setTests(prev => prev.map(t => t.id === testId ? updated : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to unpublish test.');
    } finally {
      setActionTestId(null);
    }
  }, []);

  const retry          = useCallback(() => setFetchKey(k => k + 1), []);
  const clearActionError = useCallback(() => setActionError(null), []);

  return {
    tests,
    filteredTests,
    isLoading,
    isError,
    errorMessage,
    filter,
    setFilter,
    handleDelete,
    handlePublish,
    handleUnpublish,
    retry,
    actionError,
    clearActionError,
    actionTestId,
  };
}
