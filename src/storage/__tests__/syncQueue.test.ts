/**
 * Tests for syncQueue (IndexedDB offline action queue)
 *
 * Uses the same in-memory IndexedDB stub pattern as offlineCache.test.ts.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Route } from '../../types';

// ---------------------------------------------------------------------------
// In-memory IndexedDB stub (keyPath-based object store variant).
// The sync-queue store uses `{ keyPath: 'id' }` so add/put receive the full
// object and the key is extracted from the 'id' property.
// ---------------------------------------------------------------------------

type StoreData = Map<string, unknown>;

function buildIDBStub() {
  const stores: Map<string, StoreData> = new Map();

  function makeRequest<T>(valueFn: () => T): IDBRequest<T> {
    let _onsuccess: ((e: Event) => void) | null = null;
    let _result: T;

    const req = {
      get result() { return _result; },
      set onsuccess(fn: ((e: Event) => void) | null) { _onsuccess = fn; },
      get onsuccess() { return _onsuccess; },
      set onerror(_fn: unknown) { /* noop */ },
      get onerror() { return null; },
      error: null,
    } as unknown as IDBRequest<T>;

    queueMicrotask(() => {
      _result = valueFn();
      _onsuccess?.({} as Event);
    });

    return req;
  }

  function makeCursorRequest(storeName: string): IDBRequest<IDBCursorWithValue | null> {
    const store = stores.get(storeName) ?? new Map();
    const entries = Array.from(store.values()) as unknown[];
    let index = 0;

    let _onsuccess: ((e: Event) => void) | null = null;

    const fireNext = () => {
      if (index >= entries.length) {
        (req as unknown as { _result: null })._result = null;
        _onsuccess?.({} as Event);
        return;
      }
      const value = entries[index++];
      (req as unknown as { _result: object })._result = {
        value,
        continue: () => {
          queueMicrotask(fireNext);
        },
      };
      _onsuccess?.({} as Event);
    };

    const req = {
      get result() { return (this as unknown as { _result: IDBCursorWithValue | null })._result; },
      _result: null as IDBCursorWithValue | null,
      set onsuccess(fn: ((e: Event) => void) | null) {
        _onsuccess = fn;
        queueMicrotask(fireNext);
      },
      get onsuccess() { return _onsuccess; },
      set onerror(_fn: unknown) { /* noop */ },
      get onerror() { return null; },
      error: null,
    } as unknown as IDBRequest<IDBCursorWithValue | null>;

    return req;
  }

  function makeTransaction(storeName: string, _mode: IDBTransactionMode): IDBTransaction {
    if (!stores.has(storeName)) stores.set(storeName, new Map());
    const store = stores.get(storeName)!;
    let _oncomplete: ((e: Event) => void) | null = null;

    const objectStore = {
      add: (value: unknown) =>
        makeRequest(() => {
          const id = (value as { id: string }).id;
          store.set(id, value);
          return id;
        }),
      put: (value: unknown) =>
        makeRequest(() => {
          const id = (value as { id: string }).id;
          store.set(id, value);
          return id;
        }),
      get: (key: string) => makeRequest(() => store.get(key)),
      delete: (key: string) => makeRequest(() => { store.delete(key); return undefined; }),
      clear: () => makeRequest(() => { store.clear(); return undefined; }),
      count: () => makeRequest(() => store.size),
      openCursor: () => makeCursorRequest(storeName),
    } as unknown as IDBObjectStore;

    const tx = {
      objectStore: (_name: string) => objectStore,
      set oncomplete(fn: ((e: Event) => void) | null) {
        _oncomplete = fn;
        queueMicrotask(() => fn?.({} as Event));
      },
      get oncomplete() { return _oncomplete; },
      set onerror(_fn: unknown) { /* noop */ },
      get onerror() { return null; },
      error: null,
    } as unknown as IDBTransaction;

    return tx;
  }

  function makeDB(): IDBDatabase {
    return {
      transaction: (storeName: string, mode: IDBTransactionMode) =>
        makeTransaction(storeName, mode),
      close: vi.fn(),
      objectStoreNames: { contains: () => true } as unknown as DOMStringList,
    } as unknown as IDBDatabase;
  }

  const fakeIndexedDB = {
    open: (_name: string, _version?: number): IDBOpenDBRequest => {
      let _onsuccess: ((e: Event) => void) | null = null;
      let _onupgradeneeded: ((e: IDBVersionChangeEvent) => void) | null = null;
      const db = makeDB();

      const req = {
        result: db,
        set onsuccess(fn: ((e: Event) => void) | null) { _onsuccess = fn; },
        get onsuccess() { return _onsuccess; },
        set onerror(_fn: unknown) { /* noop */ },
        get onerror() { return null; },
        set onupgradeneeded(fn: ((e: IDBVersionChangeEvent) => void) | null) {
          _onupgradeneeded = fn;
          void _onupgradeneeded; // suppress unused warning
        },
        get onupgradeneeded() { return _onupgradeneeded; },
        error: null,
      } as unknown as IDBOpenDBRequest;

      queueMicrotask(() => _onsuccess?.({ target: req } as unknown as Event));

      return req;
    },
    _stores: stores,
  };

  return fakeIndexedDB;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    const fakeIDB = buildIDBStub();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: fakeIDB,
      writable: true,
      configurable: true,
    });
    // Ensure crypto.randomUUID is available for ID generation
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` },
        writable: true,
        configurable: true,
      });
    }
  });

  const sampleRoute: Route = {
    id: 'route-1',
    brigadeId: 'brigade-a',
    name: 'Test Route',
    date: '2024-12-24',
    startTime: '18:00',
    status: 'draft',
    waypoints: [],
    createdAt: new Date().toISOString(),
  };

  it('enqueues a save-route action and getPendingCount returns 1', async () => {
    const { enqueueAction, getPendingCount } = await import('../../storage/syncQueue');

    await enqueueAction({ type: 'save-route', brigadeId: 'brigade-a', payload: sampleRoute });
    const count = await getPendingCount();
    expect(count).toBe(1);
  });

  it('getPendingActions returns enqueued items', async () => {
    const { enqueueAction, getPendingActions } = await import('../../storage/syncQueue');

    await enqueueAction({ type: 'save-route', brigadeId: 'brigade-a', payload: sampleRoute });
    const actions = await getPendingActions();

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('save-route');
    expect(actions[0].brigadeId).toBe('brigade-a');
    expect(actions[0].retryCount).toBe(0);
  });

  it('dequeueAction removes a specific action', async () => {
    const { enqueueAction, getPendingActions, dequeueAction } = await import('../../storage/syncQueue');

    await enqueueAction({ type: 'save-route', brigadeId: 'brigade-a', payload: sampleRoute });
    const before = await getPendingActions();
    expect(before).toHaveLength(1);

    await dequeueAction(before[0].id);
    const after = await getPendingActions();
    expect(after).toHaveLength(0);
  });

  it('clearQueue removes all actions', async () => {
    const { enqueueAction, clearQueue, getPendingCount } = await import('../../storage/syncQueue');

    await enqueueAction({ type: 'save-route', brigadeId: 'brigade-a', payload: sampleRoute });
    await enqueueAction({ type: 'delete-route', brigadeId: 'brigade-a', payload: { routeId: 'route-1' } });
    await clearQueue();

    const count = await getPendingCount();
    expect(count).toBe(0);
  });

  it('incrementRetryCount increments the retryCount field', async () => {
    const { enqueueAction, getPendingActions, incrementRetryCount } = await import('../../storage/syncQueue');

    await enqueueAction({ type: 'save-route', brigadeId: 'brigade-a', payload: sampleRoute });
    const before = await getPendingActions();
    const id = before[0].id;
    expect(before[0].retryCount).toBe(0);

    await incrementRetryCount(id);
    const after = await getPendingActions();
    expect(after[0].retryCount).toBe(1);
  });
});

describe('deduplicateActions', () => {
  it('keeps only the latest action per route (last-write-wins)', async () => {
    const { deduplicateActions } = await import('../../storage/syncQueue');

    const route: Route = {
      id: 'route-1',
      brigadeId: 'brigade-a',
      name: 'First Save',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [],
      createdAt: new Date().toISOString(),
    };

    const actions = [
      { id: 'a1', type: 'save-route' as const, brigadeId: 'brigade-a', payload: route, timestamp: 1000, retryCount: 0 },
      { id: 'a2', type: 'save-route' as const, brigadeId: 'brigade-a', payload: { ...route, name: 'Second Save' }, timestamp: 2000, retryCount: 0 },
    ];

    const deduped = deduplicateActions(actions);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('a2');
    expect((deduped[0].payload as Route).name).toBe('Second Save');
  });

  it('keeps delete that comes after a save', async () => {
    const { deduplicateActions } = await import('../../storage/syncQueue');

    const route: Route = {
      id: 'route-1',
      brigadeId: 'brigade-a',
      name: 'Route',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [],
      createdAt: new Date().toISOString(),
    };

    const actions = [
      { id: 'a1', type: 'save-route' as const, brigadeId: 'brigade-a', payload: route, timestamp: 1000, retryCount: 0 },
      { id: 'a2', type: 'delete-route' as const, brigadeId: 'brigade-a', payload: { routeId: 'route-1' }, timestamp: 2000, retryCount: 0 },
    ];

    const deduped = deduplicateActions(actions);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].type).toBe('delete-route');
  });

  it('keeps actions for different routes separately', async () => {
    const { deduplicateActions } = await import('../../storage/syncQueue');

    const makeRoute = (id: string): Route => ({
      id,
      brigadeId: 'brigade-a',
      name: id,
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [],
      createdAt: new Date().toISOString(),
    });

    const actions = [
      { id: 'a1', type: 'save-route' as const, brigadeId: 'brigade-a', payload: makeRoute('route-1'), timestamp: 1000, retryCount: 0 },
      { id: 'a2', type: 'save-route' as const, brigadeId: 'brigade-a', payload: makeRoute('route-2'), timestamp: 1000, retryCount: 0 },
    ];

    const deduped = deduplicateActions(actions);
    expect(deduped).toHaveLength(2);
  });
});
