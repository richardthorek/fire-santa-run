/**
 * useSessionExpiry hook
 *
 * Tracks how much life is left in the stored Station Manager suite token
 * (no refresh endpoint exists — see src/utils/tokenExpiry.ts). Re-checks
 * every minute so `SessionExpiryBanner` and any start-screen gating stay
 * current without polling more aggressively than a JWT needs.
 */

import { useEffect, useState } from 'react';
import { getSessionTimeRemainingMs } from '../utils/tokenExpiry';

const RECHECK_INTERVAL_MS = 60_000;

export interface SessionExpiryState {
  /** Milliseconds remaining until the token expires, or null if signed out / undecodable. */
  remainingMs: number | null;
  /** True once remainingMs is known and has dropped to zero or below. */
  isExpired: boolean;
}

export function useSessionExpiry(): SessionExpiryState {
  const [remainingMs, setRemainingMs] = useState<number | null>(() => getSessionTimeRemainingMs());

  useEffect(() => {
    const check = () => setRemainingMs(getSessionTimeRemainingMs());
    check();
    const interval = setInterval(check, RECHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    remainingMs,
    isExpired: remainingMs !== null && remainingMs <= 0,
  };
}
