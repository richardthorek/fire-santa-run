/**
 * Tests for suiteAuth.refreshSession — POST /api/auth/refresh, used by
 * useSessionKeepAlive to keep a brigade member's sign-in alive through a
 * live Santa run.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('refreshSession', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a no-op that returns null in dev mode, without touching the network', async () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    localStorage.setItem('auth_token', 'old-token');

    const { refreshSession } = await import('../suiteAuth');
    const result = await refreshSession();

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth_token')).toBe('old-token');
  });

  it('returns null without a network call when there is no stored token', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { refreshSession } = await import('../suiteAuth');
    const result = await refreshSession();

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stores the new token and returns the session on success', async () => {
    localStorage.setItem('auth_token', 'old-token');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          token: 'new-token',
          id: 'user-1',
          email: 'a@b.com',
          organizationId: 'org-1',
          role: 'admin',
          organization: { name: 'Brigade', planCode: 'pro' },
          entitlements: { santaRunEnabled: true },
          memberships: [],
        }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { refreshSession } = await import('../suiteAuth');
    const result = await refreshSession();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer old-token' },
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.token).toBe('new-token');
    expect(result?.santaRunEnabled).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('new-token');
  });

  it('returns null and clears nothing on a 401 (session expired)', async () => {
    localStorage.setItem('auth_token', 'old-token');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Session expired' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { refreshSession } = await import('../suiteAuth');
    const result = await refreshSession();

    expect(result).toBeNull();
    // 401 doesn't imply the caller should clear the token itself; that's a
    // decision for callers (e.g. SessionExpiryBanner) to make explicitly.
    expect(localStorage.getItem('auth_token')).toBe('old-token');
  });

  it('returns null on a 404 (user gone)', async () => {
    localStorage.setItem('auth_token', 'old-token');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { refreshSession } = await import('../suiteAuth');
    const result = await refreshSession();

    expect(result).toBeNull();
  });

  it('keeps the stored token and returns null on a network error', async () => {
    localStorage.setItem('auth_token', 'old-token');
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchSpy);

    const { refreshSession } = await import('../suiteAuth');
    const result = await refreshSession();

    expect(result).toBeNull();
    expect(localStorage.getItem('auth_token')).toBe('old-token');
  });
});
