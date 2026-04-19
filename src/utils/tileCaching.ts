/**
 * Offline map tile caching utilities.
 *
 * Provides helpers to:
 * - Compute a route bounding box from waypoints
 * - Enumerate Mapbox raster tile coordinates for a given bounding box + zoom range
 * - Build Mapbox tile request URLs
 * - Pre-fetch tiles so the service worker caches them for offline use
 *
 * The service worker (src/sw.ts) registers a CacheFirst handler for all
 * `api.mapbox.com` requests with a 30-day TTL and a custom plugin that strips
 * the `sku` query parameter from cache keys. This means any tile fetched via
 * `fetch()` in the page will be cached and served offline automatically.
 *
 * Usage:
 *   const urls = getTileUrlsForRoute(waypoints, MAPBOX_TOKEN);
 *   await prefetchTiles(urls, (done, total) => setProgress(done / total));
 */

import type { Waypoint } from '../types';

/** [minLng, minLat, maxLng, maxLat] */
export type BoundingBox = [number, number, number, number];

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/** Minimum and maximum zoom levels included in the offline tile set. */
export const TILE_MIN_ZOOM = 10;
export const TILE_MAX_ZOOM = 14;

/**
 * Degrees of padding added to each side of the route bounding box when
 * computing tiles to pre-cache (~2 km at mid-latitudes).
 */
const BBOX_PADDING_DEG = 0.02;

/** Maximum total tiles to download per route (safety cap). */
export const MAX_TILES = 2000;

/** Mapbox style used for tile requests. */
const MAPBOX_STYLE = 'mapbox/streets-v12';

/** Tile pixel size for Mapbox requests. */
const TILE_SIZE = 512;

// ---------------------------------------------------------------------------
// Tile coordinate math (EPSG:3857 / Web Mercator)
// ---------------------------------------------------------------------------

/**
 * Convert a longitude/latitude to the tile XY coordinates at a given zoom.
 * Uses the standard slippy map tile scheme.
 * Latitude is clamped to the valid Mercator projection range (≈ ±85.05°).
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  // Clamp latitude to the valid Web Mercator range to avoid log(NaN)
  const clampedLat = Math.max(-85.05113, Math.min(85.05113, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  // Clamp to valid tile range
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

/**
 * Compute the bounding box for a set of waypoints with optional padding.
 * Returns null when no coordinates are provided.
 */
export function getBoundingBox(
  waypoints: Pick<Waypoint, 'coordinates'>[],
  paddingDeg = BBOX_PADDING_DEG
): BoundingBox | null {
  if (waypoints.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const wp of waypoints) {
    const [lng, lat] = wp.coordinates;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    minLng - paddingDeg,
    minLat - paddingDeg,
    maxLng + paddingDeg,
    maxLat + paddingDeg,
  ];
}

/**
 * Return all tile coordinates that overlap a bounding box at the given zoom.
 */
export function getTilesForBboxAtZoom(bbox: BoundingBox, zoom: number): TileCoord[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // NW corner → top-left tile; SE corner → bottom-right tile
  const topLeft = lngLatToTile(minLng, maxLat, zoom);
  const bottomRight = lngLatToTile(maxLng, minLat, zoom);

  const tiles: TileCoord[] = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

/**
 * Return all tile coordinates for a bounding box across a range of zoom levels.
 * Stops early if the total would exceed MAX_TILES.
 */
export function getTilesForBbox(
  bbox: BoundingBox,
  minZoom = TILE_MIN_ZOOM,
  maxZoom = TILE_MAX_ZOOM
): TileCoord[] {
  const all: TileCoord[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const zTiles = getTilesForBboxAtZoom(bbox, z);
    if (all.length + zTiles.length > MAX_TILES) {
      // Partial zoom level — include as many as the cap allows then stop
      const remaining = MAX_TILES - all.length;
      all.push(...zTiles.slice(0, remaining));
      break;
    }
    all.push(...zTiles);
  }

  return all;
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

/**
 * Build a Mapbox raster tile URL.
 *
 * Format: https://api.mapbox.com/styles/v1/{style}/tiles/{tileSize}/{z}/{x}/{y}?access_token={token}
 */
export function buildMapboxTileUrl(
  z: number,
  x: number,
  y: number,
  token: string,
  style = MAPBOX_STYLE,
  tileSize = TILE_SIZE
): string {
  return (
    `https://api.mapbox.com/styles/v1/${style}/tiles/${tileSize}/${z}/${x}/${y}` +
    `?access_token=${encodeURIComponent(token)}`
  );
}

/**
 * Compute all tile URLs that need to be pre-cached for a route.
 *
 * @param waypoints - Route waypoints (must have coordinates)
 * @param token     - Mapbox access token
 * @param minZoom   - Lowest zoom level to include (default: TILE_MIN_ZOOM)
 * @param maxZoom   - Highest zoom level to include (default: TILE_MAX_ZOOM)
 * @returns Array of tile URLs, capped at MAX_TILES
 */
export function getTileUrlsForRoute(
  waypoints: Pick<Waypoint, 'coordinates'>[],
  token: string,
  minZoom = TILE_MIN_ZOOM,
  maxZoom = TILE_MAX_ZOOM
): string[] {
  if (waypoints.length === 0) return [];

  const bbox = getBoundingBox(waypoints);
  if (!bbox) return [];

  const tiles = getTilesForBbox(bbox, minZoom, maxZoom);
  return tiles.map(({ z, x, y }) => buildMapboxTileUrl(z, x, y, token));
}

// ---------------------------------------------------------------------------
// Pre-fetch / download
// ---------------------------------------------------------------------------

/** Number of tile requests to fire in parallel (respects browser connection limits). */
const FETCH_CONCURRENCY = 10;

/**
 * Pre-fetch all tile URLs so the service worker caches them for offline use.
 *
 * Each `fetch()` call is intercepted by the SW's CacheFirst handler for
 * `api.mapbox.com`. If the tile is already cached the request is served
 * from cache (fast); if not, it's fetched from the network and stored.
 *
 * Requests are issued in batches of FETCH_CONCURRENCY to maximise throughput
 * while respecting the browser's concurrent connection limit.
 *
 * @param urls       - Tile URLs to download (from getTileUrlsForRoute)
 * @param onProgress - Optional callback receiving the count of completed requests (success + failed)
 * @param signal     - Optional AbortSignal to cancel the download
 */
export async function prefetchTiles(
  urls: string[],
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ downloaded: number; failed: number }> {
  let downloaded = 0;
  let failed = 0;
  const total = urls.length;

  onProgress?.(0, total);

  for (let i = 0; i < urls.length; i += FETCH_CONCURRENCY) {
    if (signal?.aborted) break;

    const batch = urls.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((url) => fetch(url, { credentials: 'omit' }))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        downloaded++;
      } else {
        failed++;
      }
    }

    onProgress?.(downloaded + failed, total);
  }

  return { downloaded, failed };
}
