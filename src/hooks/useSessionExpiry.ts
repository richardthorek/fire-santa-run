/**
 * useSessionExpiry hook
 *
 * Tracks how much life is left in the stored Station Manager suite token
 * (see src/utils/tokenExpiry.ts). Re-checks every minute so
 * `SessionExpiryBanner` and any start-screen gating stay current without
 * polling more aggressively than a JWT needs, and re-checks immediately
 * whenever the stored token changes (e.g. a useSessionKeepAlive refresh) so
 * the warning clears promptly instead of waiting for the next minute tick.
 */

import { useEffect, useState } from 'react';
import { getSessionTimeRemainingMs } from '../utils/tokenExpiry';
import { TOKEN_CHANGED_EVENT } from '../auth/suiteAuth';

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
    window.addEventListener(TOKEN_CHANGED_EVENT, check);
    return () => {
      clearInterval(interval);
      window.removeEventListener(TOKEN_CHANGED_EVENT, check);
    };
  }, []);

  return {
    remainingMs,
    isExpired: remainingMs !== null && remainingMs <= 0,
  };
}
