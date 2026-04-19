/**
 * Tests for tileCacheStorage (IndexedDB tile metadata)
 *
 * Uses the same in-memory IndexedDB stub pattern as offlineCache.test.ts.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TileCacheMetadata } from '../../storage/tileCacheStorage';

// ---------------------------------------------------------------------------
// Minimal in-memory IndexedDB stub (mirrored from offlineCache.test.ts)
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
      put: (value: unknown) => {
        const meta = value as TileCacheMetadata;
        return makeRequest(() => { store.set(meta.routeId, value); return meta.routeId; });
      },
      get: (key: string) => makeRequest(() => store.get(key)),
      delete: (key: string) => makeRequest(() => { store.delete(key); return undefined; }),
    } as unknown as IDBObjectStore;

    const tx = {
      objectStore: (_name: string) => objectStore,
      set oncomplete(fn: ((e: Event) => void) | null) {
        _oncomplete = fn;
        queueMicrotask(() => fn?.({} as Event));
      },
      get oncomplete() { return _oncomplete; },
      onerror: null,
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
      const db = makeDB();

      const req = {
        result: db,
        set onsuccess(fn: ((e: Event) => void) | null) { _onsuccess = fn; },
        get onsuccess() { return _onsuccess; },
        set onerror(fn: ((e: Event) => void) | null) { _onerror = fn; },
        get onerror() { return _onerror; },
        set onupgradeneeded(_fn: unknown) { /* skip */ },
        get onupgradeneeded() { return null; },
        error: null,
        _fire: () => {
          queueMicrotask(() => _onsuccess?.({ target: req } as unknown as Event));
        },
      } as unknown as IDBOpenDBRequest & { _fire: () => void };

      queueMicrotask(() => (req as unknown as { _fire: () => void })._fire());

      return req;
    },
  };

  return fakeIndexedDB;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SAMPLE_META: TileCacheMetadata = {
  routeId: 'route-abc',
  cachedAt: 1_700_000_000_000,
  tileCount: 120,
  failedCount: 2,
  bbox: [150.0, -34.0, 152.0, -32.0],
  minZoom: 10,
  maxZoom: 14,
};

describe('tileCacheStorage', () => {
  beforeEach(() => {
    vi.resetModules();
    const fakeIDB = buildIDBStub();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: fakeIDB,
      writable: true,
      configurable: true,
    });
  });

  it('returns null for an unknown routeId', async () => {
    const { getTileCacheMetadata } = await import('../../storage/tileCacheStorage');
    const result = await getTileCacheMetadata('non-existent');
    expect(result).toBeNull();
  });

  it('saves and retrieves metadata', async () => {
    const { saveTileCacheMetadata, getTileCacheMetadata } = await import(
      '../../storage/tileCacheStorage'
    );
    await saveTileCacheMetadata(SAMPLE_META);
    const result = await getTileCacheMetadata(SAMPLE_META.routeId);
    expect(result).toEqual(SAMPLE_META);
  });

  it('overwrites existing metadata on second save', async () => {
    const { saveTileCacheMetadata, getTileCacheMetadata } = await import(
      '../../storage/tileCacheStorage'
    );
    await saveTileCacheMetadata(SAMPLE_META);

    const updated: TileCacheMetadata = { ...SAMPLE_META, tileCount: 200 };
    await saveTileCacheMetadata(updated);

    const result = await getTileCacheMetadata(SAMPLE_META.routeId);
    expect(result?.tileCount).toBe(200);
  });

  it('deletes metadata and returns null afterwards', async () => {
    const { saveTileCacheMetadata, getTileCacheMetadata, deleteTileCacheMetadata } = await import(
      '../../storage/tileCacheStorage'
    );
    await saveTileCacheMetadata(SAMPLE_META);
    await deleteTileCacheMetadata(SAMPLE_META.routeId);
    const result = await getTileCacheMetadata(SAMPLE_META.routeId);
    expect(result).toBeNull();
  });

  it('isTileCached returns false before saving', async () => {
    const { isTileCached } = await import('../../storage/tileCacheStorage');
    expect(await isTileCached('no-route')).toBe(false);
  });

  it('isTileCached returns true after saving', async () => {
    const { saveTileCacheMetadata, isTileCached } = await import(
      '../../storage/tileCacheStorage'
    );
    await saveTileCacheMetadata(SAMPLE_META);
    expect(await isTileCached(SAMPLE_META.routeId)).toBe(true);
  });

  it('isTileCached returns false after deleting', async () => {
    const { saveTileCacheMetadata, deleteTileCacheMetadata, isTileCached } = await import(
      '../../storage/tileCacheStorage'
    );
    await saveTileCacheMetadata(SAMPLE_META);
    await deleteTileCacheMetadata(SAMPLE_META.routeId);
    expect(await isTileCached(SAMPLE_META.routeId)).toBe(false);
  });
});
