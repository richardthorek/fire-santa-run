/**
 * Unit tests for route import utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parseImportFile,
  parseGPX,
  parseKML,
  validateImportedRoute,
  markDuplicates,
  resolveCandidate,
} from '../routeImport';
import { routesToBackupJSON, routesToKML } from '../routeExport';
import type { Route } from '../../types';

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    brigadeId: 'brigade-1',
    name: 'Test Route',
    date: '2026-12-24',
    startTime: '18:00',
    status: 'published',
    waypoints: [
      { id: 'wp-1', coordinates: [151.2, -33.8], name: 'Start', order: 0, isCompleted: false },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const GPX_SAMPLE = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <metadata><name>Christmas Track</name></metadata>
  <wpt lat="-33.8" lon="151.2"><name>Stop A</name><desc>Lollies here</desc></wpt>
  <wpt lat="-33.9" lon="151.3"><name>Stop B</name></wpt>
  <trk><trkseg>
    <trkpt lat="-33.8" lon="151.2"/>
    <trkpt lat="-33.85" lon="151.25"/>
    <trkpt lat="-33.9" lon="151.3"/>
  </trkseg></trk>
</gpx>`;

describe('routeImport', () => {
  describe('JSON backup round-trip', () => {
    it('re-imports a backup produced by routesToBackupJSON', () => {
      const original = makeRoute();
      const backup = routesToBackupJSON([original], { id: 'brigade-1', name: 'Griffith' });
      const result = parseImportFile('backup.json', backup);
      expect(result.source).toBe('backup');
      expect(result.errors).toHaveLength(0);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].route.name).toBe('Test Route');
      expect(result.candidates[0].route.waypoints).toHaveLength(1);
    });

    it('accepts a bare single-route JSON export', () => {
      const result = parseImportFile('route.json', JSON.stringify(makeRoute()));
      expect(result.candidates).toHaveLength(1);
    });

    it('rejects invalid JSON', () => {
      const result = parseImportFile('bad.json', '{oops');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.candidates).toHaveLength(0);
    });

    it('rejects unrelated JSON', () => {
      const result = parseImportFile('other.json', '{"hello": "world"}');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateImportedRoute', () => {
    it('skips waypoints with out-of-range coordinates', () => {
      const { route, issues } = validateImportedRoute({
        name: 'R',
        waypoints: [
          { coordinates: [151.2, -33.8] },
          { coordinates: [999, -33.8] },
        ],
      });
      expect(route?.waypoints).toHaveLength(1);
      expect(issues.some(i => i.message.includes('invalid coordinates'))).toBe(true);
    });

    it('resets unknown status to draft with a warning', () => {
      const { route, issues } = validateImportedRoute({ name: 'R', status: 'bogus', waypoints: [] });
      expect(route?.status).toBe('draft');
      expect(issues.some(i => i.message.includes('bogus'))).toBe(true);
    });

    it('fails without a name', () => {
      const { route } = validateImportedRoute({ waypoints: [] });
      expect(route).toBeNull();
    });
  });

  describe('parseGPX', () => {
    it('imports waypoints and track geometry', () => {
      const result = parseGPX(GPX_SAMPLE, 'fallback');
      expect(result.errors).toHaveLength(0);
      const route = result.candidates[0].route;
      expect(route.name).toBe('Christmas Track');
      expect(route.waypoints).toHaveLength(2);
      expect(route.waypoints[0].coordinates).toEqual([151.2, -33.8]);
      expect(route.waypoints[0].notes).toBe('Lollies here');
      expect(route.geometry?.coordinates).toHaveLength(3);
      expect(route.status).toBe('draft');
    });

    it('creates Start/Finish stops from a track-only GPX', () => {
      const trackOnly = GPX_SAMPLE.replace(/<wpt[\s\S]*?<\/wpt>/g, '');
      const result = parseGPX(trackOnly, 'fallback');
      const route = result.candidates[0].route;
      expect(route.waypoints.map(w => w.name)).toEqual(['Start', 'Finish']);
    });

    it('rejects non-GPX content', () => {
      const result = parseGPX('<html></html>', 'x');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseKML round-trip', () => {
    it('re-imports KML produced by routesToKML', () => {
      const original = makeRoute({
        waypoints: [
          { id: 'wp-1', coordinates: [151.2, -33.8], name: 'Stop A', order: 0, isCompleted: false },
          { id: 'wp-2', coordinates: [151.3, -33.9], name: 'Stop B', order: 1, isCompleted: false },
        ],
        geometry: { type: 'LineString', coordinates: [[151.2, -33.8], [151.3, -33.9]] },
      });
      const kml = routesToKML([original]);
      const result = parseKML(kml, 'fallback');
      expect(result.errors).toHaveLength(0);
      const route = result.candidates[0].route;
      expect(route.waypoints).toHaveLength(2);
      expect(route.waypoints[0].name).toBe('Stop A');
      expect(route.geometry?.coordinates).toHaveLength(2);
    });
  });

  describe('duplicate handling', () => {
    it('flags duplicates by id and by name+date', () => {
      const existing = [makeRoute()];
      const byId = parseImportFile('r.json', JSON.stringify(makeRoute({ name: 'Renamed' })));
      const byNameDate = parseImportFile('r.json', JSON.stringify(makeRoute({ id: 'other-id' })));
      expect(markDuplicates(byId.candidates, existing)[0].duplicateOf).toBe('route-1');
      expect(markDuplicates(byNameDate.candidates, existing)[0].duplicateOf).toBe('route-1');
    });

    it('resolveCandidate honours skip/replace/copy and re-scopes brigade', () => {
      const candidate = markDuplicates(
        parseImportFile('r.json', JSON.stringify(makeRoute())).candidates,
        [makeRoute()]
      )[0];

      expect(resolveCandidate({ ...candidate, resolution: 'skip' }, 'b-2')).toBeNull();

      const replaced = resolveCandidate({ ...candidate, resolution: 'replace' }, 'b-2');
      expect(replaced?.id).toBe('route-1');
      expect(replaced?.brigadeId).toBe('b-2');

      const copied = resolveCandidate({ ...candidate, resolution: 'copy' }, 'b-2');
      expect(copied?.id).not.toBe('route-1');
      expect(copied?.name).toContain('(imported)');
    });
  });
});
