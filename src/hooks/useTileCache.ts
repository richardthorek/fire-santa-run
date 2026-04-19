/**
 * useTileCache hook
 *
 * Manages offline map tile pre-caching for a route. Exposes download state,
 * progress, and controls for the "Download for Offline Use" feature.
 *
 * How it works:
 *   1. Compute tile URLs from the route's waypoints (zoom 10–14, +2 km padding)
 *   2. `fetch()` each URL — the service worker's CacheFirst handler intercepts
 *      every `api.mapbox.com` request and stores the response in `mapbox-tiles`
 *   3. Save metadata to IndexedDB so the status persists across page reloads
 *   4. To clear, delete only the IndexedDB metadata (SW cache expires naturally
 *      after 30 days and is managed globally — we don't evict per-route)
 *
 * Usage:
 *   const { isCached, isCaching, downloaded, total, downloadTiles, clearTileCache } =
 *     useTileCache(route);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Route } from '../types';
import { MAPBOX_TOKEN } from '../config/mapbox';
import {
  getTileUrlsForRoute,
  prefetchTiles,
  getBoundingBox,
  TILE_MIN_ZOOM,
  TILE_MAX_ZOOM,
} from '../utils/tileCaching';
import {
  saveTileCacheMetadata,
  deleteTileCacheMetadata,
  isTileCached,
} from '../storage/tileCacheStorage';

export interface TileCacheState {
  /** True when tile metadata exists for this route in IndexedDB. */
  isCached: boolean;
  /** True while the download is in progress. */
  isCaching: boolean;
  /** Number of tiles fetched so far (during an active download). */
  downloaded: number;
  /** Total number of tiles to fetch (during an active download). */
  total: number;
  /** Error message from the last download attempt, if any. */
  error: string | null;
  /** Start pre-caching tiles for this route. No-op if already in progress. */
  downloadTiles: () => Promise<void>;
  /** Remove tile metadata (marks route as not cached for the "Download" button). */
  clearTileCache: () => Promise<void>;
}

export function useTileCache(route: Route | null): TileCacheState {
  const [isCached, setIsCached] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Ref mirrors isCaching so the downloadTiles callback can guard against
  // concurrent invocations without taking isCaching as a dependency.
  const isCachingRef = useRef(false);

  // Check cached status on mount and whenever the route changes
  useEffect(() => {
    if (!route?.id) return;
    isTileCached(route.id)
      .then(setIsCached)
      .catch(() => setIsCached(false));
  }, [route?.id]);

  // Abort any in-progress download when the component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const downloadTiles = useCallback(async () => {
    if (!route || isCachingRef.current) return;

    const waypoints = route.waypoints;
    if (waypoints.length === 0) return;

    const token = MAPBOX_TOKEN;
    if (!token) {
      setError('Mapbox token not configured');
      return;
    }

    isCachingRef.current = true;
    setIsCaching(true);
    setError(null);
    setDownloaded(0);

    const urls = getTileUrlsForRoute(waypoints, token, TILE_MIN_ZOOM, TILE_MAX_ZOOM);
    setTotal(urls.length);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { downloaded: done, failed } = await prefetchTiles(
        urls,
        (progress) => {
          setDownloaded(progress);
        },
        abort.signal
      );

      if (!abort.signal.aborted) {
        const bbox = getBoundingBox(waypoints);
        await saveTileCacheMetadata({
          routeId: route.id,
          cachedAt: Date.now(),
          tileCount: done,
          failedCount: failed,
          bbox: bbox ?? [0, 0, 0, 0],
          minZoom: TILE_MIN_ZOOM,
          maxZoom: TILE_MAX_ZOOM,
        });
        setIsCached(true);
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Download failed';
        setError(message);
        console.error('[useTileCache] Download failed:', err);
      }
    } finally {
      if (!abort.signal.aborted) {
        isCachingRef.current = false;
        setIsCaching(false);
        abortRef.current = null;
      }
    }
  }, [route]);

  const clearTileCache = useCallback(async () => {
    if (!route?.id) return;
    await deleteTileCacheMetadata(route.id);
    setIsCached(false);
    setDownloaded(0);
    setTotal(0);
  }, [route?.id]);

  return { isCached, isCaching, downloaded, total, error, downloadTiles, clearTileCache };
}
