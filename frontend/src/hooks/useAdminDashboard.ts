// ============================================================
// hooks/useAdminDashboard.ts — Admin Dashboard Data
// ============================================================
// Fetches dashboard, analytics, trends, activity in parallel.
// Returns unified loading + error state.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  getAdminDashboard, getInstitutionAnalytics,
  getAnalyticsTrends, getActivityFeed,
} from '@/services/adminService';
import type { AdminDashboardState } from '@/types/admin';

export function useAdminDashboard(): AdminDashboardState {
  const [dashboard, setDashboard]   = useState<AdminDashboardState['dashboard']>(null);
  const [analytics, setAnalytics]   = useState<AdminDashboardState['analytics']>(null);
  const [trends,    setTrends]      = useState<AdminDashboardState['trends']>(null);
  const [activity,  setActivity]    = useState<AdminDashboardState['activity']>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error,     setError]       = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dash, ana, trd, act] = await Promise.allSettled([
        getAdminDashboard(),
        getInstitutionAnalytics(),
        getAnalyticsTrends(),
        getActivityFeed(20),
      ]);

      if (dash.status === 'fulfilled')    setDashboard(dash.value);
      if (ana.status  === 'fulfilled')    setAnalytics(ana.value);
      if (trd.status  === 'fulfilled')    setTrends(trd.value);
      if (act.status  === 'fulfilled')    setActivity(act.value);

      // Surface any errors
      const failed = [dash, ana, trd, act].filter(r => r.status === 'rejected');
      if (failed.length === 4) setError('Failed to load dashboard data.');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboard, analytics, trends, activity, isLoading, error, refetch: fetch };
}
