/**
 * Authentication utilities — validates Station Manager (StationKit suite IdP)
 * bearer tokens.
 *
 * Fire Santa Run no longer runs its own identity provider (Microsoft Entra
 * External ID has been retired) — every user is a Station Manager account,
 * and a "brigade" here is 1:1 with a Station Manager Organization
 * (brigade.id === organizationId). This validates the caller's SM-issued JWT
 * by calling back into SM's GET /api/auth/me — the same approach the Fire
 * Break Calculator sibling app uses (its services/suiteAuthService.ts) —
 * rather than verifying a signature locally, since SM is the source of truth
 * for identity, org membership, and entitlements. Contract:
 * docs/wiki/developer/suite-token-validation.md in the Station-Manager repo.
 */

const SUITE_AUTH_URL = (process.env.SUITE_AUTH_URL || 'https://stationkit.com.au').trim().replace(/\/+$/, '');
const isDevMode = process.env.DEV_MODE === 'true';

export type SuiteRole = 'owner' | 'admin' | 'viewer';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  name?: string;
  /** Station Manager Organization id — the brigade id in this app. */
  organizationId?: string;
  /** The caller's role within that organization, as issued by Station Manager. */
  role?: SuiteRole;
  /** Whether the org's plan (or standalone add-on) grants Fire Santa Run. */
  santaRunEnabled?: boolean;
  error?: string;
}

interface CacheEntry {
  result: AuthResult;
  expiresAt: number;
}

/** Positive results cache briefly so a burst of requests in one page load
 * makes one round-trip to Station Manager, not one per request. Failures are
 * not cached: a just-upgraded plan or recovered network should apply at once. */
const CACHE_TTL_MS = 60_000;
const tokenCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 500;

/** Test seam: clear the token cache. */
export function _clearAuthCache(): void {
  tokenCache.clear();
}

/**
 * Extract Bearer token from the Authorization header of a web-standard Request.
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Validate a bearer token against Station Manager. In dev mode returns a mock
 * authenticated user with Santa Run entitled, matching the pre-migration
 * dev-mode bypass.
 */
export async function validateToken(request: Request): Promise<AuthResult> {
  if (isDevMode) {
    return {
      authenticated: true,
      userId: 'dev-user-1',
      email: 'dev@example.com',
      name: 'Development User',
      organizationId: 'dev-brigade-1',
      role: 'admin',
      santaRunEnabled: true,
    };
  }

  const token = extractToken(request);
  if (!token) {
    return { authenticated: false, error: 'No authorization token provided' };
  }

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let res: Response;
  try {
    res = await fetch(`${SUITE_AUTH_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { authenticated: false, error: 'Station Manager unreachable' };
  }

  if (res.status === 401 || res.status === 403) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }
  if (!res.ok) {
    return { authenticated: false, error: 'Station Manager unavailable' };
  }

  let body: {
    id?: unknown;
    email?: unknown;
    organizationId?: unknown;
    role?: unknown;
    entitlements?: { santaRunEnabled?: unknown } | null;
  };
  try {
    body = await res.json();
  } catch {
    return { authenticated: false, error: 'Station Manager returned an invalid response' };
  }

  if (typeof body?.id !== 'string' || typeof body?.email !== 'string') {
    return { authenticated: false, error: 'Station Manager returned an unexpected response' };
  }

  const result: AuthResult = {
    authenticated: true,
    userId: body.id,
    email: body.email,
    name: body.email,
    organizationId: typeof body.organizationId === 'string' ? body.organizationId : undefined,
    role: (body.role === 'owner' || body.role === 'admin' || body.role === 'viewer') ? body.role : undefined,
    santaRunEnabled: body.entitlements?.santaRunEnabled === true,
  };

  if (tokenCache.size >= MAX_CACHE_ENTRIES) tokenCache.clear();
  tokenCache.set(token, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/**
 * Role-based permissions. Station Manager's 'owner' and 'admin' roles both map
 * onto full brigade-admin permissions here (Santa Run's old three-tier
 * admin/operator/viewer collapses onto SM's owner/admin/viewer — 'operator'
 * folds into 'admin'); 'viewer' is read-only plus navigation.
 */
export const ROLE_PERMISSIONS: Record<SuiteRole, string[]> = {
  owner: ['manage_routes', 'edit_settings', 'start_navigation'],
  admin: ['manage_routes', 'edit_settings', 'start_navigation'],
  viewer: [],
};

/** Whether a role has a specific brigade permission. */
export function hasPermission(role: SuiteRole | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export interface BrigadeAccessCheck {
  authorized: boolean;
  error?: string;
}

/**
 * Replaces the old membership-table lookup (checkBrigadePermission): since a
 * brigade IS a Station Manager Organization and the caller's own token
 * already carries their organizationId + role for their current org, "is this
 * user a member of brigade X with permission Y" reduces to "does brigade X
 * equal their token's organizationId, and does their token's role grant Y" —
 * no database round-trip needed.
 */
export function checkBrigadeAccess(authResult: AuthResult, brigadeId: string, permission: string): BrigadeAccessCheck {
  if (!authResult.organizationId || authResult.organizationId !== brigadeId) {
    return { authorized: false, error: 'You are not a member of this brigade' };
  }
  if (!hasPermission(authResult.role, permission)) {
    return { authorized: false, error: `Role '${authResult.role}' does not have '${permission}' permission` };
  }
  return { authorized: true };
}
