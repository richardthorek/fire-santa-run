/**
 * Unit tests for route export utilities
 */

import { describe, it, expect } from 'vitest';
import {
  routesToBackupJSON,
  routesToCSV,
  routesToKML,
  safeFilename,
  buildPrintableRouteSummary,
  BACKUP_FORMAT,
} from '../routeExport';
import type { Route } from '../../types';

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    brigadeId: 'brigade-1',
    name: 'Test Route',
    date: '2026-12-24',
    startTime: '18:00',
    status: 'draft',
    waypoints: [
      { id: 'wp-1', coordinates: [151.2, -33.8], name: 'Start', address: '1 Main St', order: 0, isCompleted: false },
      { id: 'wp-2', coordinates: [151.3, -33.9], name: 'End, "quoted"', order: 1, isCompleted: true, notes: 'ho ho' },
    ],
    geometry: { type: 'LineString', coordinates: [[151.2, -33.8], [151.25, -33.85], [151.3, -33.9]] },
    distance: 12000,
    estimatedDuration: 3600,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('routeExport', () => {
  describe('safeFilename', () => {
    it('sanitises unsafe characters and lowercases', () => {
      expect(safeFilename('My Route! (2026) <v2>')).toBe('my-route-2026-v2');
    });

    it('falls back to "route" when nothing survives', () => {
      expect(safeFilename('###')).toBe('route');
    });
  });

  describe('routesToBackupJSON', () => {
    it('wraps routes in a versioned backup envelope', () => {
      const backup = JSON.parse(routesToBackupJSON([makeRoute()], { id: 'brigade-1', name: 'Riverside Brigade' }));
      expect(backup.format).toBe(BACKUP_FORMAT);
      expect(backup.version).toBe(1);
      expect(backup.brigadeId).toBe('brigade-1');
      expect(backup.brigadeName).toBe('Riverside Brigade');
      expect(backup.routes).toHaveLength(1);
      expect(backup.routes[0].waypoints).toHaveLength(2);
    });
  });

  describe('routesToCSV', () => {
    it('emits one row per waypoint with route metadata', () => {
      const csv = routesToCSV([makeRoute()]);
      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(3); // header + 2 waypoints
      expect(lines[0]).toContain('route_name');
      expect(lines[1]).toContain('Test Route');
      expect(lines[1]).toContain('151.2');
    });

    it('escapes quotes and commas per RFC 4180', () => {
      const csv = routesToCSV([makeRoute()]);
      expect(csv).toContain('"End, ""quoted"""');
    });

    it('emits a single metadata row for a route without waypoints', () => {
      const csv = routesToCSV([makeRoute({ waypoints: [] })]);
      expect(csv.split('\r\n')).toHaveLength(2);
    });
  });

  describe('routesToKML', () => {
    it('produces placemarks for waypoints and a path for geometry', () => {
      const kml = routesToKML([makeRoute()]);
      expect(kml).toContain('<kml');
      expect(kml).toContain('<name>Start</name>');
      expect(kml).toContain('<LineString>');
      expect(kml).toContain('151.2,-33.8,0');
    });

    it('escapes XML special characters', () => {
      const kml = routesToKML([makeRoute({ name: 'Route <b> & "friends"' })]);
      expect(kml).toContain('Route &lt;b&gt; &amp; &quot;friends&quot;');
      expect(kml).not.toContain('<b> &');
    });

    it('omits the path placemark when there is no geometry', () => {
      const kml = routesToKML([makeRoute({ geometry: undefined })]);
      expect(kml).not.toContain('<LineString>');
    });
  });

  describe('buildPrintableRouteSummary', () => {
    it('escapes route and waypoint text', () => {
      const html = buildPrintableRouteSummary(
        makeRoute({ name: '<script>alert(1)</script>', description: '<img onerror=x>' })
      );
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<img onerror=x>');
    });

    it('rejects a non-hex theme colour and falls back to the default', () => {
      const html = buildPrintableRouteSummary(makeRoute(), {
        name: 'B',
        themeColor: 'red; } body { background: url(javascript:1) ',
      });
      expect(html).not.toContain('javascript:1');
      expect(html).toContain('#D32F2F');
    });

    it('only accepts data-image or http(s) logo URLs', () => {
      const bad = buildPrintableRouteSummary(makeRoute(), {
        name: 'B',
        logo: 'javascript:alert(1)',
      });
      expect(bad).not.toContain('javascript:alert(1)');

      const good = buildPrintableRouteSummary(makeRoute(), {
        name: 'B',
        logo: 'data:image/png;base64,AAAA',
      });
      expect(good).toContain('data:image/png;base64,AAAA');
    });

    it('escapes quotes in the logo attribute', () => {
      const html = buildPrintableRouteSummary(makeRoute(), {
        name: 'B',
        logo: 'https://example.com/logo.png" onerror="alert(1)',
      });
      expect(html).not.toContain('" onerror="');
    });
  });
});
