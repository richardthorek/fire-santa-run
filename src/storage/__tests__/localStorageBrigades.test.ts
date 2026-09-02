/**
 * Regression tests for LocalStorageAdapter.getBrigades().
 *
 * getBrigades() powers the public brigade discovery page (#148), so it returns
 * the *directory-visible* brigades — mirroring the server's GET /brigades/public.
 * A brigade is visible when `publicListing` is 'shown', or (the default 'auto')
 * when it has a current or upcoming run. Brigade records are keyed
 * `santa_<brigadeId>_brigade`; the scan must match that exact format.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../localStorage';
import type { Brigade } from '../types';
import type { Route } from '../../types';

function makeBrigade(id: string, name: string, publicListing: Brigade['publicListing'] = 'shown'): Brigade {
  return {
    id,
    slug: id,
    name,
    location: 'Somewhere, NSW',
    publicListing,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function futureRoute(id: string, brigadeId: string): Route {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return {
    id,
    brigadeId,
    name: `Run ${id}`,
    date: d.toISOString().slice(0, 10),
    startTime: '18:00',
    status: 'published',
    waypoints: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('LocalStorageAdapter.getBrigades', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty array when no brigades are stored', async () => {
    const adapter = new LocalStorageAdapter();
    expect(await adapter.getBrigades()).toEqual([]);
  });

  it('returns every "shown" brigade', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBrigade(makeBrigade('a', 'Alpha Brigade'));
    await adapter.saveBrigade(makeBrigade('b', 'Bravo Brigade'));

    const result = await adapter.getBrigades();
    expect(result.map((b) => b.name).sort()).toEqual(['Alpha Brigade', 'Bravo Brigade']);
  });

  it('ignores unrelated localStorage keys', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBrigade(makeBrigade('a', 'Alpha Brigade'));
    localStorage.setItem('santa_a_routes', '[]');
    localStorage.setItem('unrelated_key', 'value');

    const result = await adapter.getBrigades();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Brigade');
  });

  it("hides 'auto' brigades with no current or upcoming run, shows them once one is scheduled", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBrigade(makeBrigade('a', 'No Runs Brigade', 'auto'));
    expect(await adapter.getBrigades()).toHaveLength(0);

    await adapter.saveRoute('a', futureRoute('r1', 'a'));
    const result = await adapter.getBrigades();
    expect(result.map((b) => b.name)).toEqual(['No Runs Brigade']);
  });

  it("never lists a 'hidden' brigade, even with an upcoming run", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBrigade(makeBrigade('a', 'Private Brigade', 'hidden'));
    await adapter.saveRoute('a', futureRoute('r1', 'a'));
    expect(await adapter.getBrigades()).toHaveLength(0);
  });
});
