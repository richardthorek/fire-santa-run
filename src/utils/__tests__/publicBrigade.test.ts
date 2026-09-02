import { describe, it, expect } from 'vitest';
import {
  categorizeBrigadeRoutes,
  hasPublicRoutes,
  safeHttpUrl,
  safeImageSrc,
  shouldListInDirectory,
} from '../publicBrigade';
import type { Route, RouteStatus } from '../../types';

function makeRoute(id: string, status: RouteStatus, date: string): Route {
  return {
    id,
    brigadeId: 'b1',
    name: `Route ${id}`,
    date,
    startTime: '18:00',
    status,
    waypoints: [],
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

describe('categorizeBrigadeRoutes', () => {
  // Fixed reference time so date-aware categorisation is deterministic.
  const NOW = new Date('2025-12-01T12:00:00');

  it('drops drafts and non-public statuses from both lists', () => {
    const routes = [
      makeRoute('draft', 'draft', '2025-12-01'),
      makeRoute('pub', 'published', '2025-12-10'),
    ];
    const { upcoming, past } = categorizeBrigadeRoutes(routes, NOW);
    expect(upcoming.map((r) => r.id)).toEqual(['pub']);
    expect(past).toHaveLength(0);
  });

  it('classifies published/active as upcoming and completed/archived as past', () => {
    const routes = [
      makeRoute('a', 'active', '2025-12-05'),
      makeRoute('p', 'published', '2025-12-20'),
      makeRoute('c', 'completed', '2025-11-01'),
      makeRoute('ar', 'archived', '2025-10-01'),
    ];
    const { upcoming, past } = categorizeBrigadeRoutes(routes, NOW);
    expect(new Set(upcoming.map((r) => r.id))).toEqual(new Set(['a', 'p']));
    expect(new Set(past.map((r) => r.id))).toEqual(new Set(['c', 'ar']));
  });

  it('moves published routes whose date has passed into past runs', () => {
    const routes = [
      makeRoute('stale', 'published', '2024-12-24'),
      makeRoute('fresh', 'published', '2025-12-20'),
      makeRoute('late-start', 'active', '2025-11-30'),
    ];
    const { upcoming, past } = categorizeBrigadeRoutes(routes, NOW);
    // Active runs stay live regardless of date (a run can start late).
    expect(new Set(upcoming.map((r) => r.id))).toEqual(new Set(['fresh', 'late-start']));
    expect(past.map((r) => r.id)).toContain('stale');
  });

  it('sorts upcoming soonest-first and past most-recent-first', () => {
    const routes = [
      makeRoute('later', 'published', '2025-12-25'),
      makeRoute('sooner', 'published', '2025-12-05'),
      makeRoute('old', 'completed', '2025-01-01'),
      makeRoute('recent', 'completed', '2025-11-30'),
    ];
    const { upcoming, past } = categorizeBrigadeRoutes(routes, NOW);
    expect(upcoming.map((r) => r.id)).toEqual(['sooner', 'later']);
    expect(past.map((r) => r.id)).toEqual(['recent', 'old']);
  });

  it('does not throw on invalid dates', () => {
    const routes = [makeRoute('bad', 'published', 'not-a-date')];
    expect(() => categorizeBrigadeRoutes(routes)).not.toThrow();
  });
});

describe('safeHttpUrl', () => {
  it('allows http and https URLs', () => {
    expect(safeHttpUrl('https://example.com/')).toBe('https://example.com/');
    expect(safeHttpUrl('http://example.com/')).toBe('http://example.com/');
  });

  it('percent-encodes HTML meta-characters in the URL', () => {
    expect(safeHttpUrl('https://example.com/"><img>')).toBe(
      'https://example.com/%22%3E%3Cimg%3E',
    );
  });

  it('rejects javascript: and other dangerous schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    // Browsers ignore whitespace/control chars inside the scheme.
    expect(safeHttpUrl('java\tscript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('  JavaScript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('vbscript:msgbox(1)')).toBeUndefined();
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('returns undefined for empty/nullish values', () => {
    expect(safeHttpUrl(undefined)).toBeUndefined();
    expect(safeHttpUrl('')).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
  });
});

describe('safeImageSrc', () => {
  it('allows http(s) image URLs', () => {
    expect(safeImageSrc('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );
  });

  it('allows data:image URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    expect(safeImageSrc(dataUrl)).toBe(dataUrl);
  });

  it('rejects javascript:, non-image data URLs, and SVG data URLs', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeUndefined();
    expect(safeImageSrc('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    // SVG data URLs can embed script — excluded.
    expect(safeImageSrc('data:image/svg+xml,<svg onload="alert(1)"/>')).toBeUndefined();
  });
});

describe('hasPublicRoutes', () => {
  it('is false when only drafts exist', () => {
    expect(hasPublicRoutes([makeRoute('d', 'draft', '2025-12-01')])).toBe(false);
  });

  it('is true when at least one public route exists', () => {
    expect(
      hasPublicRoutes([
        makeRoute('d', 'draft', '2025-12-01'),
        makeRoute('p', 'published', '2025-12-02'),
      ]),
    ).toBe(true);
  });
});

describe('shouldListInDirectory', () => {
  const NOW = new Date('2025-12-01T12:00:00');
  const upcoming = [makeRoute('p', 'published', '2025-12-20')];
  const pastOnly = [makeRoute('c', 'completed', '2025-11-01'), makeRoute('old', 'published', '2024-12-24')];

  it("'shown' is always listed, even with no runs", () => {
    expect(shouldListInDirectory('shown', [], NOW)).toBe(true);
  });

  it("'hidden' is never listed, even with an upcoming run", () => {
    expect(shouldListInDirectory('hidden', upcoming, NOW)).toBe(false);
  });

  it("'auto' (and undefined) is listed only with a current or upcoming run", () => {
    expect(shouldListInDirectory('auto', upcoming, NOW)).toBe(true);
    expect(shouldListInDirectory('auto', pastOnly, NOW)).toBe(false);
    expect(shouldListInDirectory(undefined, [], NOW)).toBe(false);
    expect(shouldListInDirectory(undefined, [makeRoute('a', 'active', '2025-11-30')], NOW)).toBe(true);
  });
});
