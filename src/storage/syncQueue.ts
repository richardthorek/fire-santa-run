/**
 * Sync queue using IndexedDB for offline action buffering.
 *
 * When the device is offline and a route save or delete fails, the action is
 * persisted here. When connectivity is restored the queue is drained and each
 * action is replayed against the live storage adapter.
 *
 * The queue is intentionally kept in a separate IndexedDB database from the
 * read-through route cache (`fire-santa-run-offline`) to avoid coupling the
 * two version histories.
 */

import type { Route } from '../types';

const DB_NAME = 'fire-santa-run-sync';
const DB_VERSION = 1;
const QUEUE_STORE = 'sync-queue';

export type SyncActionType = 'save-route' | 'delete-route';

export interface SyncAction {
  /** Unique identifier for this queued action (crypto.randomUUID or fallback). */
  id: string;
  /** The kind of mutation to replay. */
  type: SyncActionType;
  /** Brigade the mutation belongs to. */
  brigadeId: string;
  /** Full route for 'save-route'; `{ routeId }` for 'delete-route'. */
  payload: Route | { routeId: string };
  /** Unix ms timestamp – used for last-write-wins conflict resolution. */
  timestamp: number;
  /** Number of times this action has been attempted unsuccessfully. */
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add an action to the sync queue. Idempotent for identical payloads —
 * callers should pass a meaningful `timestamp` (e.g., `Date.now()`) so that
 * last-write-wins deduplication can work correctly when the queue is drained.
 */
export async function enqueueAction(
  action: Pick<SyncAction, 'type' | 'brigadeId' | 'payload'>
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const item: SyncAction = {
        id: generateId(),
        retryCount: 0,
        timestamp: Date.now(),
        ...action,
      };
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      tx.objectStore(QUEUE_STORE).add(item);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    // Best-effort; warn but don't crash the calling code.
    console.warn('[SyncQueue] Failed to enqueue action:', err);
  }
}

/**
 * Retrieve all pending actions in insertion order.
 */
export async function getPendingActions(): Promise<SyncAction[]> {
  try {
    const db = await openDB();
    return await new Promise<SyncAction[]>((resolve, reject) => {
      const results: SyncAction[] = [];
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const cursorRequest = tx.objectStore(QUEUE_STORE).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          results.push(cursor.value as SyncAction);
          cursor.continue();
        }
      };
      tx.oncomplete = () => { db.close(); resolve(results); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[SyncQueue] Failed to read pending actions:', err);
    return [];
  }
}

/**
 * Remove a specific action from the queue by its `id`.
 */
export async function dequeueAction(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      tx.objectStore(QUEUE_STORE).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[SyncQueue] Failed to dequeue action:', err);
  }
}

/**
 * Increment the retry counter for a queued action after a failed attempt.
 */
export async function incrementRetryCount(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const action = getReq.result as SyncAction | undefined;
        if (action) {
          store.put({ ...action, retryCount: action.retryCount + 1 });
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[SyncQueue] Failed to increment retry count:', err);
  }
}

/**
 * Remove all actions from the queue (e.g., after a forced reset or logout).
 */
export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      tx.objectStore(QUEUE_STORE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[SyncQueue] Failed to clear queue:', err);
  }
}

/**
 * Return the number of queued actions without loading the full payloads.
 */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const request = tx.objectStore(QUEUE_STORE).count();
      let count = 0;
      request.onsuccess = () => { count = request.result; };
      tx.oncomplete = () => { db.close(); resolve(count); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[SyncQueue] Failed to count pending actions:', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Conflict resolution helpers
// ---------------------------------------------------------------------------

/**
 * Extract the route ID from a SyncAction's payload for deduplication.
 */
function getRouteId(action: SyncAction): string {
  if (action.type === 'save-route') {
    return (action.payload as Route).id;
  }
  return (action.payload as { routeId: string }).routeId;
}

/**
 * Apply last-write-wins deduplication to a list of pending actions.
 *
 * For each unique `(brigadeId, routeId)` tuple only the action with the
 * highest `timestamp` is kept. If a `delete-route` and a `save-route` target
 * the same route, the one with the later timestamp wins.
 *
 * The returned array is sorted ascending by `timestamp` so that the replay
 * order mirrors the original write order — e.g. saving route A before saving
 * route B is preserved even after deduplication collapses multiple saves of
 * the same route.
 */
export function deduplicateActions(actions: SyncAction[]): SyncAction[] {
  const winners = new Map<string, SyncAction>();

  for (const action of actions) {
    const routeId = getRouteId(action);
    // Use brigadeId + routeId as the deduplication key so that a later save
    // always supersedes an earlier one for the same resource.
    const key = `${action.brigadeId}:${routeId}`;
    const existing = winners.get(key);
    if (!existing || action.timestamp > existing.timestamp) {
      winners.set(key, action);
    }
  }

  return Array.from(winners.values()).sort((a, b) => a.timestamp - b.timestamp);
}
