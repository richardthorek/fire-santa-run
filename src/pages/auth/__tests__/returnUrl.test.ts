/**
 * Tests for LoginPage's returnUrl handling:
 * - only accepts an absolute-path `?returnUrl=` (rejects protocol-relative
 *   '//host' and anything not rooted at '/')
 * - falls back to the full pathname+search+hash of `location.state.from`
 * - falls back to '/dashboard' when neither is present
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { sanitizeReturnUrl, resolveReturnUrl } from '../LoginPage';

describe('sanitizeReturnUrl', () => {
  it('accepts an absolute path', () => {
    expect(sanitizeReturnUrl('/dashboard')).toBe('/dashboard');
    expect(sanitizeReturnUrl('/routes/new?x=1#section')).toBe('/routes/new?x=1#section');
  });

  it('rejects a protocol-relative URL', () => {
    expect(sanitizeReturnUrl('//evil.example.com/phish')).toBeNull();
  });

  it('rejects a non-rooted value', () => {
    expect(sanitizeReturnUrl('dashboard')).toBeNull();
    expect(sanitizeReturnUrl('https://evil.example.com')).toBeNull();
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects null/undefined/empty', () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
    expect(sanitizeReturnUrl(undefined)).toBeNull();
    expect(sanitizeReturnUrl('')).toBeNull();
  });
});

describe('resolveReturnUrl', () => {
  it('prefers a valid query returnUrl', () => {
    expect(resolveReturnUrl('/routes/new', undefined)).toBe('/routes/new');
  });

  it('falls back to location.state.from, preserving pathname+search+hash', () => {
    const state = { from: { pathname: '/routes/abc', search: '?tab=share', hash: '#top' } };
    expect(resolveReturnUrl(null, state)).toBe('/routes/abc?tab=share#top');
  });

  it('falls back to location.state.from with only a pathname', () => {
    const state = { from: { pathname: '/dashboard/brigade-1/settings' } };
    expect(resolveReturnUrl(null, state)).toBe('/dashboard/brigade-1/settings');
  });

  it('ignores an unsafe query returnUrl and falls back to state.from', () => {
    const state = { from: { pathname: '/routes/new' } };
    expect(resolveReturnUrl('//evil.example.com', state)).toBe('/routes/new');
  });

  it('falls back to /dashboard when there is neither', () => {
    expect(resolveReturnUrl(null, undefined)).toBe('/dashboard');
    expect(resolveReturnUrl(undefined, {})).toBe('/dashboard');
  });
});
