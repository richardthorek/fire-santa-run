/**
 * Shared access-token helper for authenticated API calls.
 *
 * The HTTP storage adapter, realtime hooks, and one-off page fetches all need
 * to attach an Entra bearer token to write/broadcast requests. This centralises
 * that so every caller resolves the token the same way.
 *
 * In dev mode (VITE_DEV_MODE=true) the backend bypasses auth, so no token is
 * attached. In production the token is acquired silently from the active MSAL
 * account (which refreshes it transparently when near expiry).
 */

import type { PublicClientApplication } from '@azure/msal-browser';
import { tokenRequest } from './msalConfig';

/**
 * Acquire an API access token for the signed-in user, or null when running in
 * dev mode / no user is signed in. Never throws — callers decide how to treat a
 * missing token (the server returns 401 if one is required).
 */
export async function getApiAccessToken(): Promise<string | null> {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  if (isDevMode) return null;
  if (typeof window === 'undefined') return null;

  const msalInstance = (window as unknown as { __msalInstance?: PublicClientApplication }).__msalInstance;
  if (!msalInstance) return null;

  const account = msalInstance.getActiveAccount();
  if (!account) return null;

  try {
    const response = await msalInstance.acquireTokenSilent({ ...tokenRequest, account });
    return response.accessToken;
  } catch (error) {
    console.warn('[apiToken] Failed to acquire access token silently:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Authorization header map for `fetch`. Empty in dev mode or when no token is
 * available, so the header is simply omitted.
 */
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const token = await getApiAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
