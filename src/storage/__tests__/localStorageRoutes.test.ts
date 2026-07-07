/**
 * Round-trip tests for the LocalStorageAdapter's two-table route/waypoint
 * split (routes list + per-route waypoint store).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../localStorage';
import type { Route } from '../../types';

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    brigadeId: 'brigade-1',
    name: 'Round Trip',
    date: '2026-12-24',
    startTime: '18:00',
    status: 'published',
    waypoints: [
      { id: 'wp-1', coordinates: [151.2, -33.8], name: 'Start', order: 0, isCompleted: false },
      { id: 'wp-2', coordinates: [151.3, -33.9], name: 'End', order: 1, isCompleted: false },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('LocalStorageAdapter route round-trips (two-table split)', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
  });

  it('saveRoute → getRoute preserves waypoints', async () => {
    await adapter.saveRoute('brigade-1', makeRoute());
    const loaded = await adapter.getRoute('brigade-1', 'route-1');
    expect(loaded?.waypoints).toHaveLength(2);
    expect(loaded?.waypoints[0].name).toBe('Start');
  });

  it('saveRoute → getRoutes preserves waypoints', async () => {
    await adapter.saveRoute('brigade-1', makeRoute());
    const routes = await adapter.getRoutes('brigade-1');
    expect(routes).toHaveLength(1);
    expect(routes[0].waypoints).toHaveLength(2);
  });

  it('stores the route record without embedded waypoints', async () => {
    await adapter.saveRoute('brigade-1', makeRoute());
    const raw = JSON.parse(localStorage.getItem('santa_brigade-1_routes')!);
    expect(raw[0].waypoints).toBeUndefined();
  });

  it('getPublicRoute reconstructs waypoints for published routes', async () => {
    await adapter.saveRoute('brigade-1', makeRoute());
    const publicRoute = await adapter.getPublicRoute('route-1');
    expect(publicRoute?.waypoints).toHaveLength(2);
  });

  it('getPublicRoute hides draft routes', async () => {
    await adapter.saveRoute('brigade-1', makeRoute({ status: 'draft' }));
    expect(await adapter.getPublicRoute('route-1')).toBeNull();
  });

  it('falls back to embedded waypoints for pre-split legacy data', async () => {
    // Simulate a route written before the two-table split: waypoints embedded
    // in the routes list, nothing in the waypoint store.
    localStorage.setItem('santa_brigade-1_routes', JSON.stringify([makeRoute()]));
    const loaded = await adapter.getRoute('brigade-1', 'route-1');
    expect(loaded?.waypoints).toHaveLength(2);
    const publicRoute = await adapter.getPublicRoute('route-1');
    expect(publicRoute?.waypoints).toHaveLength(2);
  });

  it('updating a route replaces its waypoints', async () => {
    await adapter.saveRoute('brigade-1', makeRoute());
    const updated = makeRoute({
      waypoints: [{ id: 'wp-3', coordinates: [150, -33], name: 'Only', order: 0, isCompleted: false }],
    });
    await adapter.saveRoute('brigade-1', updated);
    const loaded = await adapter.getRoute('brigade-1', 'route-1');
    expect(loaded?.waypoints).toHaveLength(1);
    expect(loaded?.waypoints[0].name).toBe('Only');
  });
});
