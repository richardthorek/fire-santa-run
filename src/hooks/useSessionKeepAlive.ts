/**
 * useSessionKeepAlive hook
 *
 * Keeps a brigade member's Station Manager sign-in alive through a live Santa
 * run by periodically calling POST /api/auth/refresh (see
 * src/auth/suiteAuth.ts refreshSession). Intended to be mounted for the
 * lifetime of the navigator screen (see NavigationView) — refreshing on
 * arrival covers "refresh when the run starts", and the 30-minute interval
 * plus visibility/online triggers cover "stay alive" through a long run.
 *
 * Dev mode: refreshSession() is a no-op (see suiteAuth), so this hook is
 * inert there too.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshSession } from '../auth/suiteAuth';
import { getSessionTimeRemainingMs } from '../utils/tokenExpiry';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
/** On visibility/online, only refresh if the last one was this stale... */
const STALE_REFRESH_MS = 30 * 60 * 1000; // 30 minutes
/** ...or if less than this much of the token's life remains. */
const LOW_REMAINING_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface SessionKeepAliveState {
  /** Epoch ms of the last successful refresh this session, or null if none yet. */
  lastRefreshedAt: number | null;
  /** The most recent refresh error, or null. Refresh failures are otherwise silent (the token is left as-is). */
  lastError: Error | null;
}

/**
 * @param active Whether the keep-alive should be running — pass true only
 *   while the screen that needs a live session (e.g. NavigationView) is
 *   mounted.
 */
export function useSessionKeepAlive(active: boolean): SessionKeepAliveState {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const inFlightRef = useRef(false);
  const lastRefreshedAtRef = useRef<number | null>(null);

  const runRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const session = await refreshSession();
      if (session) {
        const now = Date.now();
        lastRefreshedAtRef.current = now;
        setLastRefreshedAt(now);
        setLastError(null);
      }
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('Session refresh failed'));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    // Refresh immediately on activation (e.g. arriving at NavigationView —
    // this is the "refresh when a run starts" behaviour).
    runRefresh();

    const interval = setInterval(runRefresh, REFRESH_INTERVAL_MS);

    const maybeRefresh = () => {
      const last = lastRefreshedAtRef.current;
      const stale = last === null || Date.now() - last > STALE_REFRESH_MS;
      const remainingMs = getSessionTimeRemainingMs();
      const runningLow = remainingMs !== null && remainingMs < LOW_REMAINING_MS;
      if (stale || runningLow) runRefresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeRefresh();
    };
    const onOnline = () => maybeRefresh();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [active, runRefresh]);

  return { lastRefreshedAt, lastError };
}
