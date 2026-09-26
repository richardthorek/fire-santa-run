/**
 * Client-side JWT expiry helpers for the Station Manager suite token.
 *
 * The 24h token in localStorage (`auth_token`, see src/auth/suiteAuth.ts) has
 * no refresh endpoint — a brigade member mid-run needs a clear warning before
 * it lapses. We only ever read the `exp` claim here; there is no signature
 * verification (nor any need for one — this is a UX nicety, not an auth
 * check, and the server independently rejects an expired token).
 */

import { getStoredToken } from '../auth/suiteAuth';

/** Decodes a base64url string (as used in JWT segments) to a UTF-8 string. */
function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  // atob is available in both browser and jsdom test environments.
  const binary = atob(padded);
  // Decode the binary string as UTF-8 (handles non-ASCII claim values safely).
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Decodes a JWT's payload and returns its `exp` claim as milliseconds since
 * epoch, or null when the token is missing, malformed, or has no `exp`.
 * Never throws.
 */
export function decodeJwtExpiry(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * Milliseconds remaining until the stored suite token expires, or null when
 * there is no stored token or it can't be decoded. Can be negative if the
 * token has already expired.
 */
export function getSessionTimeRemainingMs(now: number = Date.now()): number | null {
  const expiresAtMs = decodeJwtExpiry(getStoredToken());
  if (expiresAtMs === null) return null;
  return expiresAtMs - now;
}

/** The absolute expiry time (ms since epoch) of the stored token, or null. */
export function getSessionExpiresAtMs(): number | null {
  return decodeJwtExpiry(getStoredToken());
}
