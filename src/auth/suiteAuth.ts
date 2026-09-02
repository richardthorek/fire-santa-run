/**
 * StationKit suite authentication client.
 *
 * Station Manager is the suite identity provider: users sign in with their
 * Station Manager account, and every StationKit app (this one, Fire Break
 * Calculator) validates that same token and reads the same entitlements — see
 * docs/wiki/developer/suite-token-validation.md in the Station-Manager repo.
 * Fire Santa Run previously ran its own Microsoft Entra External ID tenant;
 * that has been retired in favour of this suite-wide identity.
 *
 * Two ways a session is established:
 * - Cross-subdomain SSO (Phase 2): on load, try GET /api/auth/session with
 *   credentials: 'include' — if the user is already signed in to Station
 *   Manager (or another StationKit app) on *.stationkit.com.au, this silently
 *   resumes the session with no redirect and no form.
 * - Stored token: falls back to a token in localStorage under the suite-wide
 *   key `auth_token` (same key AAR Studio and Fire Break Calculator use), or
 *   a fresh sign-in/sign-up against Station Manager directly.
 *
 * A brigade in this app is 1:1 with a Station Manager Organization — the
 * brigade id IS the organizationId.
 *
 * Passkey sign-in (loginWithPasskey): registration only happens in Station
 * Manager's own account settings (it's the suite's sole identity provider),
 * but sign-in works directly from this app's own login screen — the WebAuthn
 * Relying Party ID is the shared `.stationkit.com.au` parent domain, so this
 * page can run the ceremony itself and just POST the resulting assertion to
 * Station Manager cross-origin. See suite-token-validation.md §1b.
 */

import { startAuthentication } from '@simplewebauthn/browser';

const RAW_URL = (import.meta.env.VITE_SUITE_AUTH_URL as string | undefined) || 'https://stationkit.com.au';
export const SUITE_AUTH_URL = RAW_URL.trim().replace(/\/+$/, '');

const TOKEN_KEY = 'auth_token';

export interface SuiteMembership {
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'viewer';
}

export interface SuiteSession {
  token: string;
  userId: string;
  email: string;
  organizationId?: string;
  organizationName?: string;
  role?: 'owner' | 'admin' | 'viewer';
  planCode: string | null;
  /** True when the org's plan (or standalone add-on) includes Fire Santa Run. */
  santaRunEnabled: boolean;
  /**
   * True when Station Manager reports this user as a platform administrator
   * (SM's PLATFORM_ADMIN_EMAILS allowlist). Unlocks the /admin portal. Not
   * org-scoped — it does not change when the user switches brigade.
   */
  isPlatformAdmin: boolean;
  memberships: SuiteMembership[];
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode) — session lasts until reload only.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Authorization header for API calls. Empty object when signed out. */
export function authHeader(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface MeResponse {
  id: string;
  email: string;
  organizationId?: string;
  role?: 'owner' | 'admin' | 'viewer';
  organization?: { name?: string; planCode?: string } | null;
  entitlements?: { santaRunEnabled?: boolean } | null;
  memberships?: { organizationId: string; organizationName: string; role: 'owner' | 'admin' | 'viewer' }[];
  isPlatformAdmin?: boolean;
}

function toSession(token: string, me: MeResponse): SuiteSession {
  return {
    token,
    userId: me.id,
    email: me.email,
    organizationId: me.organizationId,
    organizationName: me.organization?.name,
    role: me.role,
    planCode: me.organization?.planCode ?? null,
    santaRunEnabled: me.entitlements?.santaRunEnabled === true,
    isPlatformAdmin: me.isPlatformAdmin === true,
    memberships: me.memberships ?? [],
  };
}

/** Resolve a token into a full session via GET /api/auth/me. Returns null on 401. */
async function fetchSession(token: string): Promise<SuiteSession | null> {
  const res = await fetch(`${SUITE_AUTH_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error('Account service unavailable');
  const me = (await res.json()) as MeResponse;
  return toSession(token, me);
}

/** Sign in with Station Manager credentials. Throws with a friendly message on failure. */
export async function signIn(email: string, password: string): Promise<SuiteSession> {
  let res: Response;
  try {
    res = await fetch(`${SUITE_AUTH_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Could not reach the account service. Check your connection.');
  }
  if (res.status === 401) throw new Error('Invalid email or password');
  if (res.status === 429) throw new Error('Too many attempts — wait a minute and try again');
  if (!res.ok) throw new Error('Sign-in failed. Try again shortly.');

  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('Sign-in failed. Try again shortly.');

  const session = await fetchSession(body.token);
  if (!session) throw new Error('Sign-in failed. Try again shortly.');
  storeToken(body.token);
  return session;
}

/**
 * Sign in with a passkey. No username is collected — the request carries no
 * allowCredentials, so the browser's own picker shows every passkey it holds
 * for the shared StationKit relying party (a "usernameless"/discoverable
 * flow). Throws with a friendly message on failure; a cancelled OS prompt
 * throws a DOMException named 'NotAllowedError' — callers should treat that
 * as a silent no-op, not an error to display.
 */
export async function signInWithPasskey(): Promise<SuiteSession> {
  const optionsRes = await fetch(`${SUITE_AUTH_URL}/api/auth/passkey/login/options`, { method: 'POST' });
  if (!optionsRes.ok) throw new Error('Could not start passkey sign-in');
  const { flowId, options } = await optionsRes.json();

  const response = await startAuthentication({ optionsJSON: options });

  const verifyRes = await fetch(`${SUITE_AUTH_URL}/api/auth/passkey/login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ flowId, response }),
  });
  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || 'Passkey sign-in failed');
  }

  const body = (await verifyRes.json()) as { token?: string };
  if (!body.token) throw new Error('Passkey sign-in failed');

  const session = await fetchSession(body.token);
  if (!session) throw new Error('Passkey sign-in failed');
  storeToken(body.token);
  return session;
}

export interface SignUpInput {
  organizationName: string;
  billingEmail: string;
  username: string;
  password: string;
  email: string;
}

/** Standalone sign-up: creates a new Station Manager organization (Community plan) and its owner account. */
export async function signUp(input: SignUpInput): Promise<SuiteSession> {
  let res: Response;
  try {
    res = await fetch(`${SUITE_AUTH_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Could not reach the account service. Check your connection.');
  }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || 'That username is already taken');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || 'Sign-up failed. Try again shortly.');
  }

  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('Sign-up failed. Try again shortly.');

  const session = await fetchSession(body.token);
  if (!session) throw new Error('Sign-up failed. Try again shortly.');
  storeToken(body.token);
  return session;
}

/**
 * Restore a session on app load: try the cross-subdomain SSO cookie first
 * (silent — no redirect), then fall back to a stored token.
 */
export async function restoreSession(): Promise<SuiteSession | null> {
  try {
    const res = await fetch(`${SUITE_AUTH_URL}/api/auth/session`, {
      credentials: 'include',
    });
    if (res.ok) {
      const me = (await res.json()) as MeResponse & { token: string };
      storeToken(me.token);
      return toSession(me.token, me);
    }
  } catch {
    // Network error reaching the cookie-SSO endpoint — fall through to the
    // stored-token path below (may still work if we're just offline briefly).
  }

  const token = getStoredToken();
  if (!token) return null;
  try {
    const session = await fetchSession(token);
    if (!session) clearStoredToken();
    return session;
  } catch {
    // Service unreachable — keep the token; the user may be offline.
    return null;
  }
}

/** Switch the active organization for a multi-org member; reissues the session. */
export async function switchOrg(organizationId: string): Promise<SuiteSession> {
  const token = getStoredToken();
  const res = await fetch(`${SUITE_AUTH_URL}/api/auth/switch-org`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ organizationId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || 'Failed to switch organisation');
  }
  const body = (await res.json()) as { token: string };
  const session = await fetchSession(body.token);
  if (!session) throw new Error('Failed to switch organisation');
  storeToken(body.token);
  return session;
}

export async function signOut(): Promise<void> {
  const token = getStoredToken();
  clearStoredToken();
  if (token) {
    try {
      await fetch(`${SUITE_AUTH_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    } catch {
      // Best-effort — the local token is already cleared.
    }
  }
}
