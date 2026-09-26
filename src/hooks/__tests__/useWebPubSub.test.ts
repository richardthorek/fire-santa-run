/**
 * Tests for useWebPubSub's reconnect behaviour (production WS path):
 * - exponential backoff with jitter, capped ~30s, uncapped attempt count
 * - a failed negotiate call schedules a retry (not just a socket close)
 * - visibilitychange -> visible and window 'online' reset backoff and retry
 *   immediately
 *
 * The module reads `VITE_DEV_MODE` at import time to choose the WS vs.
 * BroadcastChannel path, so this file stubs it to 'false' and re-imports the
 * module fresh (the global test setup stubs it to 'true' for every other
 * test file's dev-mode-by-default hooks).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../auth/apiToken', () => ({
  getApiAuthHeaders: vi.fn().mockResolvedValue({}),
}));

vi.stubEnv('VITE_DEV_MODE', 'false');

let useWebPubSub: typeof import('../useWebPubSub').useWebPubSub;

// ---------------------------------------------------------------------------
// Minimal controllable WebSocket mock
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  triggerOpen() {
    this.onopen?.();
  }

  triggerClose() {
    this.onclose?.();
  }
}

function mockNegotiateOk() {
  return { ok: true, statusText: 'OK', json: async () => ({ url: 'wss://example.test/ws' }) };
}

function mockNegotiateFail() {
  return { ok: false, statusText: 'Service Unavailable', json: async () => ({}) };
}

describe('useWebPubSub reconnect (production WS path)', () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ useWebPubSub } = await import('../useWebPubSub'));

    MockWebSocket.instances = [];
    // @ts-expect-error test double
    global.WebSocket = MockWebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reaches connectionStatus "connected" once negotiate succeeds and the socket opens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockNegotiateOk());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useWebPubSub({ routeId: 'r1', role: 'viewer' }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('schedules a reconnect with exponential backoff after the socket closes, with no hard attempt cap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockNegotiateOk());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useWebPubSub({ routeId: 'r1', role: 'viewer' }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    // Simulate six consecutive failures — well past the old hard cap of 5 —
    // and confirm the hook keeps trying every time rather than giving up.
    for (let i = 0; i < 6; i++) {
      const before = MockWebSocket.instances.length;
      act(() => {
        MockWebSocket.instances[before - 1].triggerClose();
      });
      // Advance well past the max possible backoff so the retry always fires.
      await act(async () => {
        vi.advanceTimersByTime(31_000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(MockWebSocket.instances.length).toBe(before + 1);
    }
  });

  it('caps the backoff delay at ~30s and never disables retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockNegotiateOk());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useWebPubSub({ routeId: 'r1', role: 'viewer' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Force many consecutive closes so the internal attempt counter grows
    // well past the point where 2^attempt would exceed the 30s cap.
    for (let i = 0; i < 10; i++) {
      const before = MockWebSocket.instances.length;
      act(() => {
        MockWebSocket.instances[before - 1].triggerClose();
      });
      await act(async () => {
        // 30s is the documented cap; jitter never pushes it past the cap itself.
        vi.advanceTimersByTime(30_001);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(MockWebSocket.instances.length).toBe(before + 1);
    }
  });

  it('schedules a retry after a failed negotiate call, not only after a socket close', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockNegotiateFail());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useWebPubSub({ routeId: 'r1', role: 'viewer' }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(0); // never got past negotiate

    await act(async () => {
      vi.advanceTimersByTime(31_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('resets backoff and reconnects immediately on document visibilitychange -> visible', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockNegotiateOk());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useWebPubSub({ routeId: 'r1', role: 'viewer' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    // Drop the connection — this schedules a backoff retry we don't wait out.
    act(() => {
      MockWebSocket.instances[0].triggerClose();
    });

    // Foreground the tab before the backoff timer would have fired.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // A second socket should have been opened immediately, without advancing timers.
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('resets backoff and reconnects immediately on window "online"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockNegotiateOk());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useWebPubSub({ routeId: 'r1', role: 'viewer' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0].triggerClose();
    });

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does not break the broadcaster role: still connects and can send location', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockNegotiateOk())
      .mockResolvedValueOnce({ ok: true, statusText: 'OK' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useWebPubSub({ routeId: 'r1', role: 'broadcaster' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    expect(result.current.isConnected).toBe(true);

    let sendResult;
    await act(async () => {
      sendResult = await result.current.sendLocation({
        routeId: 'r1',
        location: [151.2, -33.8],
        timestamp: Date.now(),
      });
    });

    expect(sendResult).toEqual({ ok: true });
  });
});
