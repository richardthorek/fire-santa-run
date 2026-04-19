/**
 * Tile cache metadata storage using IndexedDB.
 *
 * Tracks which routes have had their map tiles pre-fetched for offline use.
 * The actual tile data lives in the service worker's Cache Storage
 * (`mapbox-tiles` cache), while this module only persists a lightweight
 * metadata record so the UI can quickly determine whether a route is cached.
 *
 * Schema:
 *   DB name   : 'fire-santa-run-tile-meta'
 *   Store name: 'tile-cache-meta'
 *   Key       : routeId (string)
 *   Value     : TileCacheMetadata
 */

const DB_NAME = 'fire-santa-run-tile-meta';
const DB_VERSION = 1;
const STORE_NAME = 'tile-cache-meta';

export interface TileCacheMetadata {
  routeId: string;
  cachedAt: number;
  tileCount: number;
  failedCount: number;
  /** Serialised bounding box [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'routeId' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist tile cache metadata for a route.
 * Overwrites any existing metadata for the same routeId.
 */
export async function saveTileCacheMetadata(metadata: TileCacheMetadata): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(metadata);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[TileCacheStorage] Failed to save metadata:', err);
  }
}

/**
 * Retrieve cached tile metadata for a route.
 * Returns null if no metadata has been saved for this route.
 */
export async function getTileCacheMetadata(routeId: string): Promise<TileCacheMetadata | null> {
  try {
    const db = await openDB();
    return await new Promise<TileCacheMetadata | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(routeId);
      let result: TileCacheMetadata | null = null;
      request.onsuccess = () => {
        result = (request.result as TileCacheMetadata | undefined) ?? null;
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[TileCacheStorage] Failed to retrieve metadata:', err);
    return null;
  }
}

/**
 * Delete tile cache metadata for a route.
 * Note: this does NOT evict tiles from the service worker cache —
 * use `clearCachedTilesForRoute` to do that.
 */
export async function deleteTileCacheMetadata(routeId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(routeId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[TileCacheStorage] Failed to delete metadata:', err);
  }
}

/**
 * Return true if tile metadata exists for the given route.
 */
export async function isTileCached(routeId: string): Promise<boolean> {
  const meta = await getTileCacheMetadata(routeId);
  return meta !== null;
}
