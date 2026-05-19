// ============================================================
// hooks/usePlacements.ts — Student Job Browse + Apply Hook
// ============================================================
// Manages the student-facing job listing and apply flow.
//
// APPLY FLOW (optimistic):
//   1. Immediately add a 'applying' flag to the job in local state
//   2. Fire POST /placement/apply
//   3. On success: mark job as applied in appliedIds Set
//   4. On failure: rollback the flag, surface error
//
// FILTER LOGIC (client-side after single fetch):
//   All jobs fetched once. Filters run in useMemo.
//   Re-fetch only on explicit refetch().
// ============================================================

import {
  useState, useEffect, useMemo, useCallback,
} from 'react';
import { getJobPostings, applyToJob } from '@/services/placementService';
import { getMyApplications } from '@/services/placementService';
import type {
  JobPosting, PlacementFilters, EMPTY_PLACEMENT_FILTERS,
} from '@/types/placement';

// Satisfy TypeScript — import the constant, not just the type
import { EMPTY_PLACEMENT_FILTERS as DEFAULT_FILTERS } from '@/types/placement';

export interface UsePlacementsReturn {
  jobs:            JobPosting[];
  filteredJobs:    JobPosting[];
  isLoading:       boolean;
  error:           string | null;
  filters:         PlacementFilters;
  setFilter:       <K extends keyof PlacementFilters>(k: K, v: PlacementFilters[K]) => void;
  resetFilters:    () => void;
  appliedIds:      Set<number>;
  applyingId:      number | null;
  applyError:      string | null;
  apply:           (jobId: number) => Promise<boolean>;
  refetch:         () => void;
  // counts for stats row
  totalJobs:       number;
  eligibleCount:   number;
  appliedCount:    number;
}

export function usePlacements(): UsePlacementsReturn {
  const [jobs,       setJobs]       = useState<JobPosting[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [fetchKey,   setFetchKey]   = useState(0);
  const [filters,    setFilters]    = useState<PlacementFilters>(DEFAULT_FILTERS);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Fetch jobs + existing applications together
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([getJobPostings(true), getMyApplications()])
      .then(([posts, apps]) => {
        if (cancelled) return;
        setJobs(posts);
        setAppliedIds(new Set(apps.map(a => a.job_posting_id)));
      })
      .catch(e => {
        if (cancelled) return;
        // If applications fetch fails, still show jobs
        getJobPostings(true)
          .then(posts => { if (!cancelled) setJobs(posts); })
          .catch(e2 => { if (!cancelled) setError(e2 instanceof Error ? e2.message : 'Failed to load.'); });
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  const setFilter = useCallback(<K extends keyof PlacementFilters>(
    k: K, v: PlacementFilters[K],
  ) => {
    setFilters(prev => ({ ...prev, [k]: v }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // ── Client-side filtering ─────────────────────────────────
  const filteredJobs = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return jobs.filter(j => {
      if (filters.eligibleOnly && j.is_eligible !== true)       return false;
      if (q && !j.company_name.toLowerCase().includes(q) &&
               !j.role_title.toLowerCase().includes(q))         return false;
      if (filters.minPackage !== '' && (j.package_lpa ?? 0) < Number(filters.minPackage)) return false;
      if (filters.maxPackage !== '' && (j.package_lpa ?? 999) > Number(filters.maxPackage)) return false;
      if (filters.department) {
        const allowed = j.allowed_departments
          ? j.allowed_departments.split(',').map(d => d.trim())
          : null;
        if (allowed && !allowed.includes(filters.department)) return false;
      }
      return true;
    });
  }, [jobs, filters]);

  // ── Apply action (optimistic) ─────────────────────────────
  const apply = useCallback(async (jobId: number): Promise<boolean> => {
    setApplyingId(jobId);
    setApplyError(null);
    try {
      await applyToJob(jobId);
      setAppliedIds(prev => new Set([...prev, jobId]));
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to apply.';
      setApplyError(msg);
      return false;
    } finally {
      setApplyingId(null);
    }
  }, []);

  // ── Derived counts ────────────────────────────────────────
  const totalJobs     = jobs.length;
  const eligibleCount = jobs.filter(j => j.is_eligible === true).length;
  const appliedCount  = appliedIds.size;

  return {
    jobs, filteredJobs, isLoading, error,
    filters, setFilter, resetFilters,
    appliedIds, applyingId, applyError, apply,
    refetch, totalJobs, eligibleCount, appliedCount,
  };
}
