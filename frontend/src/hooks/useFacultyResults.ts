// ============================================================
// hooks/useFacultyResults.ts — Faculty Results Browser
// ============================================================
// Powers FacultyResultsPage.
//
// STRATEGY:
//   1. Load all faculty tests (getFacultyTests)
//   2. When faculty selects a test, load its results (getTestAllResults)
//   3. Client-side filtering by subject + section
//   4. Compute: average score, pass/fail counts, top N ranking
//
// NO new backend endpoints needed — reuses existing test API.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TestDetail, AllResultsItem } from '@/types/test';
import { getFacultyTests, getTestAllResults } from '@/services/testService';


export interface RankedResult extends AllResultsItem {
  rank: number;
}

export interface ResultStats {
  totalAttempts: number;
  averageScore:  number;
  highestScore:  number;
  lowestScore:   number;
  passCount:     number;
  failCount:     number;
  passRate:      number;
}

export interface UseFacultyResultsReturn {
  // Test list
  tests:          TestDetail[];
  testsLoading:   boolean;

  // Selected test + its results
  selectedTestId: number | null;
  selectTest:     (id: number) => void;

  // Results
  results:        RankedResult[];
  resultsLoading: boolean;
  resultsError:   string | null;
  stats:          ResultStats | null;

  // Filters
  searchQuery:    string;
  setSearchQuery: (q: string) => void;
  filtered:       RankedResult[];
}

const EMPTY_STATS: ResultStats = {
  totalAttempts: 0,
  averageScore:  0,
  highestScore:  0,
  lowestScore:   0,
  passCount:     0,
  failCount:     0,
  passRate:      0,
};

export function useFacultyResults(): UseFacultyResultsReturn {
  const [tests,          setTests]          = useState<TestDetail[]>([]);
  const [testsLoading,   setTestsLoading]   = useState(true);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [results,        setResults]        = useState<AllResultsItem[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError,   setResultsError]   = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]    = useState('');

  // Load tests on mount
  useEffect(() => {
    getFacultyTests()
      .then(data => { setTests(data); })
      .catch(() => { /* silent */ })
      .finally(() => setTestsLoading(false));
  }, []);

  // Load results when selected test changes
  useEffect(() => {
    if (selectedTestId === null) { setResults([]); return; }
    let cancelled = false;
    setResultsLoading(true);
    setResultsError(null);
    getTestAllResults(selectedTestId)
      .then(data => { if (!cancelled) setResults(data); })
      .catch(e  => { if (!cancelled) setResultsError(e instanceof Error ? e.message : 'Failed to load results.'); })
      .finally(() => { if (!cancelled) setResultsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedTestId]);

  const selectTest = useCallback((id: number) => {
    setSelectedTestId(id);
    setSearchQuery('');
  }, []);

  // Rank results by score desc
  const rankedResults = useMemo<RankedResult[]>(() => {
    const sorted = [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [results]);

  // Stats
  const stats = useMemo<ResultStats | null>(() => {
    if (rankedResults.length === 0) return null;
    const submitted = rankedResults.filter(r => r.is_submitted);
    if (submitted.length === 0) return EMPTY_STATS;
    const scores = submitted.map(r => r.score ?? 0);
    const selectedTest = tests.find(t => t.id === selectedTestId);
    const maxScore = selectedTest?.total_marks ?? 100;
    const passThreshold = maxScore * 0.4;
    return {
      totalAttempts: submitted.length,
      averageScore:  Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      highestScore:  Math.max(...scores),
      lowestScore:   Math.min(...scores),
      passCount:     scores.filter(s => s >= passThreshold).length,
      failCount:     scores.filter(s => s < passThreshold).length,
      passRate:      Math.round((scores.filter(s => s >= passThreshold).length / scores.length) * 100),
    };
  }, [rankedResults, tests, selectedTestId]);

  // Client-side search filter
  const filtered = useMemo<RankedResult[]>(() => {
    if (!searchQuery.trim()) return rankedResults;
    const q = searchQuery.toLowerCase();
    return rankedResults.filter(r =>
      r.roll_number?.toLowerCase().includes(q) ||
      r.full_name?.toLowerCase().includes(q),
    );
  }, [rankedResults, searchQuery]);

  return {
    tests,
    testsLoading,
    selectedTestId,
    selectTest,
    results: rankedResults,
    resultsLoading,
    resultsError,
    stats,
    searchQuery,
    setSearchQuery,
    filtered,
  };
}
