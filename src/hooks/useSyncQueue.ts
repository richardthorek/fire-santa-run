/**
 * useSyncQueue hook
 *
 * Watches the network status and automatically processes the offline action
 * queue when connectivity is restored. Exposes queue status for UI components.
 *
 * Last-write-wins conflict resolution:
 *   Before replaying, duplicate actions for the same route are collapsed so
 *   that only the most-recent mutation per resource is applied.
 *
 * Error handling:
 *   - If an individual action fails, the hook continues processing the remaining
 *     actions rather than aborting the whole sync.
 *   - Failed actions increment their `retryCount`; once `MAX_RETRY_COUNT` is
 *     reached the action is permanently dropped from the queue to prevent it from
 *     blocking future syncs.
 *   - `lastSyncError` is set to the most recent failure message. Use `clearError`
 *     to dismiss it (e.g., after the user has read it or triggered a retry).
 *
 * Usage:
 *   const { pendingCount, isSyncing, lastSyncError } = useSyncQueue();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { storageAdapter } from '../storage';
import {
  getPendingActions,
  getPendingCount,
  dequeueAction,
  incrementRetryCount,
  deduplicateActions,
  enqueueAction,
} from '../storage/syncQueue';
import type { SyncAction } from '../storage/syncQueue';
import type { Route } from '../types';

export type { SyncAction };
export { enqueueAction };

const MAX_RETRY_COUNT = 3;

/**
 * Milliseconds to wait after a network reconnection event before attempting
 * to drain the queue. This brief pause allows the OS/browser network stack
 * to fully stabilise before making outbound API calls.
 */
const RECONNECT_DELAY_MS = 500;

export interface SyncQueueState {
  /** Number of actions currently waiting in the queue. */
  pendingCount: number;
  /** True while the queue is being drained after reconnection. */
  isSyncing: boolean;
  /** Error message from the last sync attempt (null on success). */
  lastSyncError: string | null;
  /** True immediately after a successful sync (auto-clears after 4 s). */
  syncComplete: boolean;
  /** Manually trigger a sync attempt (e.g., from a retry button). */
  processQueue: () => Promise<void>;
  /** Clear the last sync error. */
  clearError: () => void;
}

export function useSyncQueue(): SyncQueueState {
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [syncComplete, setSyncComplete] = useState(false);
  const isSyncingRef = useRef(false);

  // Refresh the pending count from the queue.
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Load the initial count on mount.
  useEffect(() => {
    getPendingCount().then((count) => setPendingCount(count));
  }, []);

  const processQueue = useCallback(async () => {
    if (isSyncingRef.current) return;

    const actions = await getPendingActions();
    if (actions.length === 0) {
      await refreshCount();
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);
    setSyncComplete(false);

    // Apply last-write-wins: collapse duplicates before replaying.
    const deduped = deduplicateActions(actions);
    // IDs not in the deduplicated set can be removed immediately (superseded).
    const supersededIds = actions
      .filter((a) => !deduped.find((d) => d.id === a.id))
      .map((a) => a.id);
    await Promise.all(supersededIds.map((id) => dequeueAction(id)));

    let encounteredError = false;

    for (const action of deduped) {
      try {
        await applyAction(action);
        await dequeueAction(action.id);
      } catch (err) {
        encounteredError = true;
        if (action.retryCount >= MAX_RETRY_COUNT) {
          // Give up on this action after too many failures.
          await dequeueAction(action.id);
          console.warn('[SyncQueue] Dropping action after max retries:', action);
        } else {
          await incrementRetryCount(action.id);
        }
        const message = err instanceof Error ? err.message : 'Sync failed';
        setLastSyncError(message);
        console.error('[SyncQueue] Failed to apply action:', action, err);
        // Continue processing remaining actions instead of aborting.
      }
    }

    await refreshCount();
    isSyncingRef.current = false;
    setIsSyncing(false);

    if (!encounteredError) {
      setSyncComplete(true);
    }
  }, [refreshCount]);

  // Auto-dismiss the syncComplete flag after 4 seconds.
  useEffect(() => {
    if (!syncComplete) return;
    const timer = setTimeout(() => setSyncComplete(false), 4000);
    return () => clearTimeout(timer);
  }, [syncComplete]);

  // Process the queue whenever the device comes back online.
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOffline = !isOnlineRef.current;
    isOnlineRef.current = isOnline;

    if (isOnline && wasOffline) {
      const timer = setTimeout(() => processQueue(), RECONNECT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isOnline, processQueue]);

  const clearError = useCallback(() => setLastSyncError(null), []);

  return { pendingCount, isSyncing, lastSyncError, syncComplete, processQueue, clearError };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function applyAction(action: SyncAction): Promise<void> {
  switch (action.type) {
    case 'save-route': {
      const route = action.payload as Route;
      await storageAdapter.saveRoute(action.brigadeId, route);
      break;
    }
    case 'delete-route': {
      const { routeId } = action.payload as { routeId: string };
      await storageAdapter.deleteRoute(action.brigadeId, routeId);
      break;
    }
    default:
      console.warn('[SyncQueue] Unknown action type:', (action as SyncAction).type);
  }
}
