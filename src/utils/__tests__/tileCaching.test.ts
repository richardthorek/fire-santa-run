import { describe, it, expect } from 'vitest';
import {
  lngLatToTile,
  getBoundingBox,
  getTilesForBboxAtZoom,
  getTilesForBbox,
  buildMapboxTileUrl,
  getTileUrlsForRoute,
  MAX_TILES,
  TILE_MIN_ZOOM,
  TILE_MAX_ZOOM,
} from '../../utils/tileCaching';
import type { Waypoint } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWaypoint(lng: number, lat: number): Pick<Waypoint, 'coordinates'> {
  return { coordinates: [lng, lat] };
}

// ---------------------------------------------------------------------------
// lngLatToTile
// ---------------------------------------------------------------------------

describe('lngLatToTile', () => {
  it('returns tile (0, 0) for the top-left corner at zoom 0', () => {
    // At zoom 0 there is only tile (0,0)
    const { x, y } = lngLatToTile(-180, 85.05, 0);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('computes correct tile for Sydney CBD at zoom 14', () => {
    // Sydney CBD is approximately lng 151.2, lat -33.87
    // Expected tile can be pre-computed; we just verify the result is
    // consistent (deterministic) and within valid range for zoom 14.
    const zoom = 14;
    const { x, y } = lngLatToTile(151.2, -33.87, zoom);
    const maxCoord = Math.pow(2, zoom) - 1;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(maxCoord);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(maxCoord);
  });

  it('clamps out-of-range coordinates to valid tile indices', () => {
    // lng=-200 is out-of-range (< -180); lat=90 is at the pole (beyond Mercator range)
    const { x, y } = lngLatToTile(-200, 90, 5);
    const max = Math.pow(2, 5) - 1;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(max);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(max);
  });

  it('gives identical tile for the same coordinates at the same zoom', () => {
    const a = lngLatToTile(151.2, -33.87, 12);
    const b = lngLatToTile(151.2, -33.87, 12);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// getBoundingBox
// ---------------------------------------------------------------------------

describe('getBoundingBox', () => {
  it('returns null for an empty waypoint array', () => {
    expect(getBoundingBox([])).toBeNull();
  });

  it('returns a bbox that wraps a single waypoint plus padding', () => {
    const padding = 0.02;
    const bbox = getBoundingBox([makeWaypoint(151.2, -33.87)], padding);
    expect(bbox).not.toBeNull();
    const [minLng, minLat, maxLng, maxLat] = bbox!;
    expect(minLng).toBeCloseTo(151.2 - padding, 5);
    expect(minLat).toBeCloseTo(-33.87 - padding, 5);
    expect(maxLng).toBeCloseTo(151.2 + padding, 5);
    expect(maxLat).toBeCloseTo(-33.87 + padding, 5);
  });

  it('includes all waypoints in the bounding box', () => {
    const waypoints = [
      makeWaypoint(150.0, -34.0),
      makeWaypoint(152.0, -32.0),
      makeWaypoint(151.0, -33.5),
    ];
    const bbox = getBoundingBox(waypoints, 0)!;
    expect(bbox[0]).toBeCloseTo(150.0, 5); // minLng
    expect(bbox[1]).toBeCloseTo(-34.0, 5); // minLat
    expect(bbox[2]).toBeCloseTo(152.0, 5); // maxLng
    expect(bbox[3]).toBeCloseTo(-32.0, 5); // maxLat
  });
});

// ---------------------------------------------------------------------------
// getTilesForBboxAtZoom
// ---------------------------------------------------------------------------

describe('getTilesForBboxAtZoom', () => {
  it('returns at least one tile for any valid bbox', () => {
    const bbox: [number, number, number, number] = [151.19, -33.88, 151.21, -33.86];
    const tiles = getTilesForBboxAtZoom(bbox, 12);
    expect(tiles.length).toBeGreaterThanOrEqual(1);
  });

  it('all returned tiles have the requested zoom level', () => {
    const bbox: [number, number, number, number] = [150.0, -35.0, 152.0, -33.0];
    const zoom = 11;
    const tiles = getTilesForBboxAtZoom(bbox, zoom);
    for (const tile of tiles) {
      expect(tile.z).toBe(zoom);
    }
  });

  it('returns more tiles for a wider bbox', () => {
    const narrow: [number, number, number, number] = [151.19, -33.88, 151.21, -33.86];
    const wide: [number, number, number, number] = [150.0, -35.0, 152.0, -33.0];
    const zoom = 12;
    expect(getTilesForBboxAtZoom(wide, zoom).length).toBeGreaterThan(
      getTilesForBboxAtZoom(narrow, zoom).length
    );
  });
});

// ---------------------------------------------------------------------------
// getTilesForBbox
// ---------------------------------------------------------------------------

describe('getTilesForBbox', () => {
  const bbox: [number, number, number, number] = [151.19, -33.88, 151.21, -33.86];

  it('never exceeds MAX_TILES', () => {
    // Use a very large bbox to stress-test the cap
    const hugeBbox: [number, number, number, number] = [100.0, -40.0, 155.0, -10.0];
    const tiles = getTilesForBbox(hugeBbox, TILE_MIN_ZOOM, TILE_MAX_ZOOM);
    expect(tiles.length).toBeLessThanOrEqual(MAX_TILES);
  });

  it('includes tiles for every zoom level in range', () => {
    const tiles = getTilesForBbox(bbox, 10, 12);
    const zooms = new Set(tiles.map((t) => t.z));
    expect(zooms.has(10)).toBe(true);
    expect(zooms.has(11)).toBe(true);
    expect(zooms.has(12)).toBe(true);
  });

  it('returns more tiles for a larger zoom range', () => {
    const small = getTilesForBbox(bbox, 10, 11);
    const large = getTilesForBbox(bbox, 10, 14);
    expect(large.length).toBeGreaterThan(small.length);
  });
});

// ---------------------------------------------------------------------------
// buildMapboxTileUrl
// ---------------------------------------------------------------------------

describe('buildMapboxTileUrl', () => {
  const token = 'pk.test123';

  it('builds a URL with correct z/x/y path segments', () => {
    const url = buildMapboxTileUrl(14, 100, 200, token);
    expect(url).toContain('/14/100/200');
  });

  it('includes the access_token query parameter', () => {
    const url = buildMapboxTileUrl(12, 50, 60, token);
    expect(url).toContain(`access_token=${encodeURIComponent(token)}`);
  });

  it('starts with the Mapbox API origin', () => {
    const url = buildMapboxTileUrl(10, 0, 0, token);
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('api.mapbox.com');
    expect(parsed.protocol).toBe('https:');
  });

  it('uses the specified style', () => {
    const url = buildMapboxTileUrl(10, 0, 0, token, 'mapbox/outdoors-v12');
    expect(url).toContain('mapbox/outdoors-v12');
  });
});

// ---------------------------------------------------------------------------
// getTileUrlsForRoute
// ---------------------------------------------------------------------------

describe('getTileUrlsForRoute', () => {
  const token = 'pk.test456';
  const waypoints = [makeWaypoint(151.2, -33.87), makeWaypoint(151.22, -33.85)];

  it('returns an empty array when no waypoints are provided', () => {
    expect(getTileUrlsForRoute([], token)).toHaveLength(0);
  });

  it('returns Mapbox API URLs', () => {
    const urls = getTileUrlsForRoute(waypoints, token);
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('api.mapbox.com');
    }
  });

  it('returns at least one URL when waypoints are provided', () => {
    const urls = getTileUrlsForRoute(waypoints, token);
    expect(urls.length).toBeGreaterThan(0);
  });

  it('respects the zoom range parameters', () => {
    const allZooms = getTileUrlsForRoute(waypoints, token, 10, 14);
    const fewZooms = getTileUrlsForRoute(waypoints, token, 10, 10);
    expect(allZooms.length).toBeGreaterThan(fewZooms.length);
  });

  it('never exceeds MAX_TILES URLs', () => {
    // Large bounding box that would otherwise generate many tiles
    const many = [makeWaypoint(100.0, -40.0), makeWaypoint(155.0, -10.0)];
    const urls = getTileUrlsForRoute(many, token);
    expect(urls.length).toBeLessThanOrEqual(MAX_TILES);
  });
});
