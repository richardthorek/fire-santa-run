/**
 * Tests for offlineCache (IndexedDB route caching)
 *
 * Uses a simple in-memory fake IndexedDB provided by the jsdom environment
 * via `fake-indexeddb` (bundled with vitest's jsdom environment).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Route } from '../../types';

// ---------------------------------------------------------------------------
// Minimal in-memory IndexedDB stub for tests.
// jsdom does not ship a real IndexedDB implementation, so we provide a simple
// in-memory stub that satisfies the API surface used by offlineCache.ts.
// ---------------------------------------------------------------------------

type StoreData = Map<string, unknown>;

function buildIDBStub() {
  const stores: Map<string, StoreData> = new Map();

  function makeRequest<T>(valueFn: () => T): IDBRequest<T> {
    let _onsuccess: ((e: Event) => void) | null = null;
    let _onerror: ((e: Event) => void) | null = null;
    let _result: T;

    const req = {
      get result() { return _result; },
      set onsuccess(fn: ((e: Event) => void) | null) { _onsuccess = fn; },
      get onsuccess() { return _onsuccess; },
      set onerror(fn: ((e: Event) => void) | null) { _onerror = fn; },
      get onerror() { return _onerror; },
      error: null,
    } as unknown as IDBRequest<T>;

    // Execute synchronously after current microtask
    queueMicrotask(() => {
      try {
        _result = valueFn();
        _onsuccess?.({} as Event);
      } catch (_e) {
        _onerror?.({} as Event);
      }
    });

    return req;
  }

  function makeTransaction(storeName: string, _mode: IDBTransactionMode): IDBTransaction {
    if (!stores.has(storeName)) stores.set(storeName, new Map());
    const store = stores.get(storeName)!;
    let _oncomplete: ((e: Event) => void) | null = null;

    const objectStore = {
      put: (value: unknown, key: string) => makeRequest(() => { store.set(key, value); return key; }),
      get: (key: string) => makeRequest(() => store.get(key)),
      delete: (key: string) => makeRequest(() => { store.delete(key); return undefined; }),
    } as unknown as IDBObjectStore;

    const tx = {
      objectStore: (_name: string) => objectStore,
      set oncomplete(fn: ((e: Event) => void) | null) { _oncomplete = fn; queueMicrotask(() => fn?.({} as Event)); },
      get oncomplete() { return _oncomplete; },
    } as unknown as IDBTransaction;

    return tx;
  }

  function makeDB(): IDBDatabase {
    return {
      transaction: (storeName: string, mode: IDBTransactionMode) => makeTransaction(storeName, mode),
      close: vi.fn(),
      objectStoreNames: { contains: () => true } as unknown as DOMStringList,
    } as unknown as IDBDatabase;
  }

  const fakeIndexedDB = {
    open: (_name: string, _version?: number): IDBOpenDBRequest => {
      let _onsuccess: ((e: Event) => void) | null = null;
      let _onerror: ((e: Event) => void) | null = null;
      let _onupgradeneeded: ((e: IDBVersionChangeEvent) => void) | null = null;
      const db = makeDB();

      const req = {
        result: db,
        set onsuccess(fn: ((e: Event) => void) | null) { _onsuccess = fn; },
        get onsuccess() { return _onsuccess; },
        set onerror(fn: ((e: Event) => void) | null) { _onerror = fn; },
        get onerror() { return _onerror; },
        set onupgradeneeded(fn: ((e: IDBVersionChangeEvent) => void) | null) {
          _onupgradeneeded = fn;
          // If we had a version change, we would call this. For simplicity, skip.
        },
        get onupgradeneeded() { return _onupgradeneeded; },
        error: null,
        // Called after handlers are set
        _fire: () => {
          queueMicrotask(() => _onsuccess?.({ target: req } as unknown as Event));
        },
      } as unknown as IDBOpenDBRequest & { _fire: () => void };

      queueMicrotask(() => (req as unknown as { _fire: () => void })._fire());

      return req;
    },
    _stores: stores,
  };

  return fakeIndexedDB;
}

describe('offlineCache', () => {
  let fakeIDB: ReturnType<typeof buildIDBStub>;

  beforeEach(() => {
    vi.resetModules();
    fakeIDB = buildIDBStub();
    // Replace the global indexedDB with our stub
    Object.defineProperty(globalThis, 'indexedDB', {
      value: fakeIDB,
      writable: true,
      configurable: true,
    });
  });

  const sampleRoutes: Route[] = [
    {
      id: 'route-1',
      brigadeId: 'brigade-a',
      name: 'Test Route',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [],
      createdAt: new Date().toISOString(),
    },
  ];

  it('should cache routes and retrieve them', async () => {
    const { cacheRoutes, getCachedRoutes } = await import('../../storage/offlineCache');

    await cacheRoutes('brigade-a', sampleRoutes);
    const result = await getCachedRoutes('brigade-a');

    expect(result).toEqual(sampleRoutes);
  });

  it('should return null for an unknown brigadeId', async () => {
    const { getCachedRoutes } = await import('../../storage/offlineCache');

    const result = await getCachedRoutes('brigade-unknown');
    expect(result).toBeNull();
  });

  it('should overwrite existing cache entries', async () => {
    const { cacheRoutes, getCachedRoutes } = await import('../../storage/offlineCache');

    const updatedRoutes: Route[] = [
      { ...sampleRoutes[0], name: 'Updated Route' },
    ];

    await cacheRoutes('brigade-a', sampleRoutes);
    await cacheRoutes('brigade-a', updatedRoutes);

    const result = await getCachedRoutes('brigade-a');
    expect(result?.[0].name).toBe('Updated Route');
  });

  it('should clear cached routes', async () => {
    const { cacheRoutes, getCachedRoutes, clearCachedRoutes } = await import('../../storage/offlineCache');

    await cacheRoutes('brigade-a', sampleRoutes);
    await clearCachedRoutes('brigade-a');

    const result = await getCachedRoutes('brigade-a');
    expect(result).toBeNull();
  });
});
