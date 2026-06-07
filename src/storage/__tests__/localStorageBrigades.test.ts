/**
 * Regression tests for LocalStorageAdapter.getBrigades().
 *
 * The brigade discovery page (#148) relies on getBrigades() returning every
 * persisted brigade. Brigade records are keyed `santa_<brigadeId>_brigade`, so
 * the scan must match that exact format — this locks it in.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../localStorage';
import type { Brigade } from '../types';

function makeBrigade(id: string, name: string, claimed = true): Brigade {
  return {
    id,
    slug: id,
    name,
    location: 'Somewhere, NSW',
    allowedDomains: [],
    allowedEmails: [],
    requireManualApproval: false,
    adminUserIds: [],
    isClaimed: claimed,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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

  it('returns every saved brigade', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBrigade(makeBrigade('a', 'Alpha RFS'));
    await adapter.saveBrigade(makeBrigade('b', 'Bravo RFS'));

    const result = await adapter.getBrigades();
    expect(result.map((b) => b.name).sort()).toEqual(['Alpha RFS', 'Bravo RFS']);
  });

  it('ignores unrelated localStorage keys', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBrigade(makeBrigade('a', 'Alpha RFS'));
    localStorage.setItem('santa_a_routes', '[]');
    localStorage.setItem('unrelated_key', 'value');

    const result = await adapter.getBrigades();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha RFS');
  });
});
