import { describe, it, expect } from 'vitest';
import { categorizeBrigadeRoutes, hasPublicRoutes } from '../publicBrigade';
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
  it('drops drafts and non-public statuses from both lists', () => {
    const routes = [
      makeRoute('draft', 'draft', '2025-12-01'),
      makeRoute('pub', 'published', '2025-12-10'),
    ];
    const { upcoming, past } = categorizeBrigadeRoutes(routes);
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
    const { upcoming, past } = categorizeBrigadeRoutes(routes);
    expect(new Set(upcoming.map((r) => r.id))).toEqual(new Set(['a', 'p']));
    expect(new Set(past.map((r) => r.id))).toEqual(new Set(['c', 'ar']));
  });

  it('sorts upcoming soonest-first and past most-recent-first', () => {
    const routes = [
      makeRoute('later', 'published', '2025-12-25'),
      makeRoute('sooner', 'published', '2025-12-05'),
      makeRoute('old', 'completed', '2025-01-01'),
      makeRoute('recent', 'completed', '2025-11-30'),
    ];
    const { upcoming, past } = categorizeBrigadeRoutes(routes);
    expect(upcoming.map((r) => r.id)).toEqual(['sooner', 'later']);
    expect(past.map((r) => r.id)).toEqual(['recent', 'old']);
  });

  it('does not throw on invalid dates', () => {
    const routes = [makeRoute('bad', 'published', 'not-a-date')];
    expect(() => categorizeBrigadeRoutes(routes)).not.toThrow();
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
