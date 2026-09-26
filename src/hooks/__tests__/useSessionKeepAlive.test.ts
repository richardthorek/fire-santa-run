/**
 * Tests for useSessionKeepAlive hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionKeepAlive } from '../useSessionKeepAlive';

const mockRefreshSession = vi.fn();

vi.mock('../../auth/suiteAuth', () => ({
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
}));

vi.mock('../../utils/tokenExpiry', () => ({
  getSessionTimeRemainingMs: () => mockRemainingMs,
}));

let mockRemainingMs: number | null = 6 * 60 * 60 * 1000; // 6h remaining by default

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token: 'tok',
    userId: 'u1',
    email: 'a@b.com',
    planCode: null,
    santaRunEnabled: true,
    isPlatformAdmin: false,
    memberships: [],
    ...overrides,
  };
}

describe('useSessionKeepAlive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefreshSession.mockReset().mockResolvedValue(makeSession());
    mockRemainingMs = 6 * 60 * 60 * 1000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while inactive', async () => {
    renderHook(() => useSessionKeepAlive(false));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('refreshes immediately on activation and reports lastRefreshedAt', async () => {
    const { result } = renderHook(() => useSessionKeepAlive(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.lastRefreshedAt).not.toBeNull();
  });

  it('refreshes again every 30 minutes while active', async () => {
    renderHook(() => useSessionKeepAlive(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(3);
  });

  it('does not run a second refresh concurrently (single-flight)', async () => {
    let resolveRefresh: (v: unknown) => void = () => {};
    mockRefreshSession.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    renderHook(() => useSessionKeepAlive(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    // A visibility trigger while the first refresh is still in flight must
    // not start a second one.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefresh(makeSession());
      await Promise.resolve();
    });
  });

  it('refreshes on visibilitychange->visible when the last refresh is stale (>30 min)', async () => {
    const { result } = renderHook(() => useSessionKeepAlive(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.lastRefreshedAt).not.toBeNull();

    // Move past the 30-minute staleness window without the interval firing
    // (advance just under it, then trigger visibility).
    await act(async () => {
      vi.advanceTimersByTime(31 * 60 * 1000 - 1);
    });

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on visibilitychange when recently refreshed and plenty of time remains', async () => {
    renderHook(() => useSessionKeepAlive(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it('refreshes on the online event when little time remains, even if recently refreshed', async () => {
    renderHook(() => useSessionKeepAlive(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    mockRemainingMs = 30 * 60 * 1000; // under the 2h low-remaining threshold

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(2);
  });

  it('stops refreshing once deactivated', async () => {
    const { rerender } = renderHook(({ active }) => useSessionKeepAlive(active), {
      initialProps: { active: true },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    rerender({ active: false });

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });
});
