/**
 * Offline cache using IndexedDB for storing route data locally.
 *
 * Allows routes to be viewed without network access by persisting the
 * last-known state fetched from the server. Data is automatically updated
 * whenever routes are loaded successfully while online.
 */

import type { Route } from '../types';

const DB_NAME = 'fire-santa-run-offline';
const DB_VERSION = 1;
const ROUTES_STORE = 'brigade-routes';

interface CachedEntry {
  routes: Route[];
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ROUTES_STORE)) {
        db.createObjectStore(ROUTES_STORE);
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist a set of routes for a brigade in the offline cache.
 */
export async function cacheRoutes(brigadeId: string, routes: Route[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROUTES_STORE, 'readwrite');
      const store = tx.objectStore(ROUTES_STORE);
      const entry: CachedEntry = { routes, cachedAt: Date.now() };
      store.put(entry, brigadeId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    // Offline caching is best-effort; log and swallow errors.
    console.warn('[OfflineCache] Failed to cache routes:', err);
  }
}

/**
 * Retrieve cached routes for a brigade. Returns null if no cached data exists.
 */
export async function getCachedRoutes(brigadeId: string): Promise<Route[] | null> {
  try {
    const db = await openDB();
    return await new Promise<Route[] | null>((resolve, reject) => {
      const tx = db.transaction(ROUTES_STORE, 'readonly');
      const store = tx.objectStore(ROUTES_STORE);
      const request = store.get(brigadeId);
      let cached: CachedEntry | undefined;
      request.onsuccess = () => { cached = request.result as CachedEntry | undefined; };
      tx.oncomplete = () => { db.close(); resolve(cached?.routes ?? null); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[OfflineCache] Failed to retrieve cached routes:', err);
    return null;
  }
}

/**
 * Remove cached routes for a brigade (e.g., after a logout).
 */
export async function clearCachedRoutes(brigadeId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROUTES_STORE, 'readwrite');
      const store = tx.objectStore(ROUTES_STORE);
      store.delete(brigadeId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[OfflineCache] Failed to clear cached routes:', err);
  }
}
