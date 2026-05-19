// ============================================================
// hooks/useSystemHealth.ts — Polling System Health Monitor
// ============================================================
// Polls GET /admin/system-health every POLL_MS milliseconds.
// Graceful degradation: errors don't crash — they show stale data.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSystemHealth } from '@/services/adminService';
import type { SystemHealthState } from '@/types/admin';

const POLL_MS = 15_000;   // 15 s refresh interval

export function useSystemHealth(): SystemHealthState {
  const [health,      setHealth]      = useState<SystemHealthState['health']>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const pollRef = useRef<number>(0);

  const fetch = useCallback(async () => {
    try {
      const data = await getSystemHealth();
      setHealth(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    pollRef.current = window.setInterval(fetch, POLL_MS);
    return () => window.clearInterval(pollRef.current);
  }, [fetch]);

  return { health, isLoading, lastUpdated, error };
}
