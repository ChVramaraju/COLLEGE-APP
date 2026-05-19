// ============================================================
// hooks/useApplications.ts — Student Application Tracker
// ============================================================
// Fetches student's own applications, computes status funnel,
// and provides withdraw action with rollback safety.
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyApplications, withdrawApplication } from '@/services/placementService';
import type { PlacementApplication, ApplicationStatus, StudentPlacementStats } from '@/types/placement';

export interface UseApplicationsReturn {
  applications:        PlacementApplication[];
  filteredApplications: PlacementApplication[];
  isLoading:           boolean;
  error:               string | null;
  stats:               StudentPlacementStats;
  statusFilter:        ApplicationStatus | '';
  setStatusFilter:     (s: ApplicationStatus | '') => void;
  withdrawingId:       number | null;
  withdrawError:       string | null;
  withdraw:            (appId: number) => Promise<boolean>;
  refetch:             () => void;
}

export function useApplications(): UseApplicationsReturn {
  const [applications, setApplications] = useState<PlacementApplication[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [fetchKey,     setFetchKey]     = useState(0);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [withdrawingId,setWithdrawingId]= useState<number | null>(null);
  const [withdrawError,setWithdrawError]= useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getMyApplications()
      .then(data  => { if (!cancelled) setApplications(data); })
      .catch(e    => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  // ── Derived stats (memoized) ──────────────────────────────
  const stats = useMemo((): StudentPlacementStats => {
    const count = (s: ApplicationStatus) => applications.filter(a => a.status === s).length;
    return {
      total:       applications.length,
      applied:     count('applied'),
      shortlisted: count('shortlisted'),
      selected:    count('selected'),
      rejected:    count('rejected'),
      withdrawn:   count('withdrawn'),
    };
  }, [applications]);

  const filteredApplications = useMemo(() =>
    statusFilter
      ? applications.filter(a => a.status === statusFilter)
      : applications,
  [applications, statusFilter]);

  // ── Withdraw (optimistic rollback) ───────────────────────
  const withdraw = useCallback(async (appId: number): Promise<boolean> => {
    const original = applications.find(a => a.id === appId);
    if (!original) return false;

    // Optimistic update
    setApplications(prev =>
      prev.map(a => a.id === appId ? { ...a, status: 'withdrawn' as ApplicationStatus } : a),
    );
    setWithdrawingId(appId);
    setWithdrawError(null);

    try {
      await withdrawApplication(appId);
      return true;
    } catch (e) {
      // Rollback
      setApplications(prev =>
        prev.map(a => a.id === appId ? original : a),
      );
      setWithdrawError(e instanceof Error ? e.message : 'Failed to withdraw.');
      return false;
    } finally {
      setWithdrawingId(null);
    }
  }, [applications]);

  return {
    applications, filteredApplications,
    isLoading, error, stats,
    statusFilter, setStatusFilter,
    withdrawingId, withdrawError, withdraw,
    refetch,
  };
}
