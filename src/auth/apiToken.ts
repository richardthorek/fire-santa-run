/**
 * Shared access-token helper for authenticated API calls.
 *
 * The HTTP storage adapter and other non-React modules need to attach a
 * Station Manager bearer token to write/broadcast requests. This centralises
 * that so every caller resolves the token the same way — from the suite-wide
 * stored token (see auth/suiteAuth.ts), not React context (these modules
 * aren't components).
 *
 * In dev mode (VITE_DEV_MODE=true) the backend bypasses auth, so no token is
 * attached.
 */

import { getStoredToken } from './suiteAuth';

/** The current Station Manager bearer token, or null when signed out / dev mode. */
export async function getApiAccessToken(): Promise<string | null> {
  if (import.meta.env.VITE_DEV_MODE === 'true') return null;
  return getStoredToken();
}

/** Authorization header map for `fetch`. Empty when signed out or in dev mode. */
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const token = await getApiAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
