/**
 * useLocationBroadcast hook
 * Broadcasts GPS location updates from the navigator device
 * Throttles updates to 5 second intervals
 *
 * When the device is offline, broadcast attempts are still made so the
 * service worker BackgroundSync plugin can queue and replay them once
 * the connection is restored.
 *
 * Broadcast health: sendLocation/sendRunStatus report success/failure (see
 * useWebPubSub's BroadcastSendResult) rather than only logging, so this hook
 * can surface `broadcastHealth` for UI (BroadcastHealthBanner) instead of
 * failing silently. A 401/403 attempts one silent session restore (suite SSO
 * cookie, or the stored token re-validated) and retries once before giving
 * up as 'auth-expired'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebPubSub, type BroadcastSendResult } from './useWebPubSub';
import { useNetworkStatus } from './useNetworkStatus';
import { restoreSession } from '../auth/suiteAuth';
import type { RouteProgress, LocationBroadcast, RunStatus } from '../types';
import type { GeolocationCoordinates } from './useGeolocation';

interface UseLocationBroadcastOptions {
  routeId: string;
  position: GeolocationCoordinates | null;
  routeProgress: RouteProgress;
  isNavigating: boolean;
  nextWaypointEta?: string;
}

const BROADCAST_INTERVAL_MS = 5000; // 5 seconds
/** Consecutive failures (after any auth-expired retry) before health drops from 'degraded' to 'failing'. */
const FAILING_THRESHOLD = 2;

export type BroadcastHealth = 'ok' | 'degraded' | 'failing' | 'auth-expired';

export function useLocationBroadcast({
  routeId,
  position,
  routeProgress,
  isNavigating,
  nextWaypointEta,
}: UseLocationBroadcastOptions) {
  const lastBroadcastTimeRef = useRef(0);
  const lastPositionRef = useRef<[number, number] | null>(null);
  const consecutiveFailuresRef = useRef(0);
  // Only attempt one silent session restore per auth-expired episode — reset
  // once a send succeeds again.
  const authRestoreAttemptedRef = useRef(false);

  const [broadcastHealth, setBroadcastHealth] = useState<BroadcastHealth>('ok');
  const [lastSuccessfulBroadcastAt, setLastSuccessfulBroadcastAt] = useState<number | null>(null);

  const { sendLocation: sendLocationRaw, sendRunStatus: sendRunStatusRaw, isConnected, viewerCount, viewerPins } = useWebPubSub({
    routeId,
    role: 'broadcaster',
  });

  const { isOnline } = useNetworkStatus();

  /**
   * Records a send outcome, updating broadcastHealth. On a 401/403 it tries
   * one silent session restore and reports whether the caller should retry
   * the send with a (possibly) fresh token.
   */
  const recordSendResult = useCallback(async (result: BroadcastSendResult): Promise<'ok' | 'retry' | 'gave-up'> => {
    if (result.ok) {
      consecutiveFailuresRef.current = 0;
      authRestoreAttemptedRef.current = false;
      setBroadcastHealth('ok');
      setLastSuccessfulBroadcastAt(Date.now());
      return 'ok';
    }

    if (result.status === 401 || result.status === 403) {
      if (authRestoreAttemptedRef.current) {
        setBroadcastHealth('auth-expired');
        return 'gave-up';
      }
      authRestoreAttemptedRef.current = true;
      try {
        const session = await restoreSession();
        if (session) {
          return 'retry';
        }
      } catch {
        // Restore itself failed (offline, service down) — fall through to auth-expired.
      }
      setBroadcastHealth('auth-expired');
      return 'gave-up';
    }

    consecutiveFailuresRef.current += 1;
    setBroadcastHealth(consecutiveFailuresRef.current >= FAILING_THRESHOLD ? 'failing' : 'degraded');
    return 'gave-up';
  }, []);

  /** Sends a location broadcast, retrying once after a successful silent auth restore. */
  const sendLocation = useCallback(async (broadcast: LocationBroadcast) => {
    const result = await sendLocationRaw(broadcast);
    const outcome = await recordSendResult(result);
    if (outcome === 'retry') {
      const retryResult = await sendLocationRaw(broadcast);
      await recordSendResult(retryResult);
    }
  }, [sendLocationRaw, recordSendResult]);

  /** Sends a run-status update, retrying once after a successful silent auth restore. */
  const sendRunStatus = useCallback(async (status: RunStatus, message?: string) => {
    const result = await sendRunStatusRaw(status, message);
    const outcome = await recordSendResult(result);
    if (outcome === 'retry') {
      const retryResult = await sendRunStatusRaw(status, message);
      await recordSendResult(retryResult);
    }
  }, [sendRunStatusRaw, recordSendResult]);

  useEffect(() => {
    // Always require an active navigation session and a known position.
    // We intentionally do NOT gate on `isConnected` here: in production
    // mode the broadcast is a plain HTTP POST to /api/broadcast, so the
    // service worker can queue it via BackgroundSync when the device is
    // offline and replay it once connectivity is restored. In dev mode
    // `sendLocation` checks for BroadcastChannel availability internally
    // and is a no-op if the channel has not been opened yet.
    if (!isNavigating || !position) {
      return;
    }

    // Throttle broadcasts to 5 second intervals
    const now = Date.now();
    if (now - lastBroadcastTimeRef.current < BROADCAST_INTERVAL_MS) {
      return;
    }

    lastBroadcastTimeRef.current = now;
    lastPositionRef.current = position.coordinates;

    // Prepare location broadcast message
    const broadcast: LocationBroadcast = {
      routeId,
      location: position.coordinates,
      timestamp: position.timestamp,
      heading: position.heading ?? undefined,
      speed: position.speed ?? undefined,
      currentWaypointIndex: routeProgress.currentWaypointIndex,
      nextWaypointEta,
    };

    // Send location update (service worker queues when offline in production)
    sendLocation(broadcast);
  }, [isNavigating, position, routeId, routeProgress, nextWaypointEta, sendLocation]);

  /**
   * Send a final "run completed" message so viewers' tracking pages flip to
   * the thank-you state live, without waiting for a refresh.
   */
  const broadcastRunCompleted = useCallback(() => {
    const location = lastPositionRef.current;
    if (!location) return;
    sendLocation({
      routeId,
      location,
      timestamp: Date.now(),
      status: 'completed',
    });
  }, [routeId, sendLocation]);

  /**
   * Push a live run status to viewers — pause (temporary hold), abort (called
   * away to a real emergency), or resume (active). Completion has its own
   * {@link broadcastRunCompleted} path that also carries the final position.
   */
  const broadcastRunStatus = useCallback(
    (status: RunStatus, message?: string) => sendRunStatus(status, message),
    [sendRunStatus],
  );

  return {
    isConnected,
    isOnline,
    /** Live count of public viewers watching this run (pushed from the server). */
    viewerCount,
    /** Coarsened, aggregated waiting-spot pins from opt-in viewers. */
    viewerPins,
    broadcastRunCompleted,
    broadcastRunStatus,
    /** 'ok' | 'degraded' | 'failing' | 'auth-expired' — see BroadcastHealthBanner. */
    broadcastHealth,
    /** Epoch ms of the last broadcast that succeeded, or null if none yet this session. */
    lastSuccessfulBroadcastAt,
  };
}
