/**
 * Tests for tokenExpiry — client-side JWT `exp` decoding used for the
 * sign-in-expiry warning (no refresh endpoint exists for the suite token).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwtExpiry, getSessionTimeRemainingMs, getSessionExpiresAtMs } from '../tokenExpiry';

function base64UrlEncode(json: unknown): string {
  const str = JSON.stringify(json);
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: Record<string, unknown>): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fakesignature`;
}

describe('decodeJwtExpiry', () => {
  it('returns the exp claim in milliseconds', () => {
    const expSeconds = 1_700_000_000;
    const token = makeToken({ exp: expSeconds, sub: 'user-1' });
    expect(decodeJwtExpiry(token)).toBe(expSeconds * 1000);
  });

  it('returns null for a null/undefined token', () => {
    expect(decodeJwtExpiry(null)).toBeNull();
    expect(decodeJwtExpiry(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJwtExpiry('')).toBeNull();
  });

  it('returns null for a token with the wrong number of segments', () => {
    expect(decodeJwtExpiry('not-a-jwt')).toBeNull();
    expect(decodeJwtExpiry('a.b')).toBeNull();
    expect(decodeJwtExpiry('a.b.c.d')).toBeNull();
  });

  it('returns null when the payload segment is not valid base64', () => {
    expect(decodeJwtExpiry('a.!!!not-base64!!!.c')).toBeNull();
  });

  it('returns null when the payload segment is not valid JSON', () => {
    const header = base64UrlEncode({ alg: 'HS256' });
    const badPayload = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_');
    expect(decodeJwtExpiry(`${header}.${badPayload}.sig`)).toBeNull();
  });

  it('returns null when the payload has no exp claim', () => {
    const token = makeToken({ sub: 'user-1' });
    expect(decodeJwtExpiry(token)).toBeNull();
  });

  it('returns null when exp is not a number', () => {
    const token = makeToken({ exp: 'soon' });
    expect(decodeJwtExpiry(token)).toBeNull();
  });

  it('decodes tokens whose base64url payload needs padding', () => {
    // A payload length that is NOT a multiple of 4 once encoded exercises the
    // padding logic in base64UrlDecode.
    const token = makeToken({ exp: 1_699_999_999, note: 'x' });
    expect(decodeJwtExpiry(token)).toBe(1_699_999_999 * 1000);
  });
});

describe('getSessionTimeRemainingMs / getSessionExpiresAtMs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when there is no stored token', () => {
    expect(getSessionTimeRemainingMs()).toBeNull();
    expect(getSessionExpiresAtMs()).toBeNull();
  });

  it('computes remaining time relative to now', () => {
    const nowMs = 1_700_000_000_000;
    const expiresInMs = 90 * 60 * 1000; // 90 minutes
    const token = makeToken({ exp: Math.floor((nowMs + expiresInMs) / 1000) });
    localStorage.setItem('auth_token', token);

    const remaining = getSessionTimeRemainingMs(nowMs);
    expect(remaining).toBeCloseTo(expiresInMs, -2);
  });

  it('can return a negative value for an already-expired token', () => {
    const nowMs = 1_700_000_000_000;
    const token = makeToken({ exp: Math.floor((nowMs - 60_000) / 1000) });
    localStorage.setItem('auth_token', token);

    expect(getSessionTimeRemainingMs(nowMs)).toBeLessThan(0);
  });

  it('returns null when the stored token is malformed', () => {
    localStorage.setItem('auth_token', 'garbage');
    expect(getSessionTimeRemainingMs()).toBeNull();
  });
});
