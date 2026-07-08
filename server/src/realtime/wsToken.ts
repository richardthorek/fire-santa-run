/**
 * Short-lived signed tokens for privileged realtime WebSocket connections.
 *
 * Browsers cannot set an Authorization header on a WebSocket handshake, so the
 * negotiate endpoint (which IS authenticated) mints a compact HMAC token that
 * binds {routeId, role, exp}; the WS upgrade handler verifies it. Viewers are
 * anonymous and need no token — only broadcaster/editor connections carry one.
 *
 * Secret resolution (no new required config):
 *   REALTIME_WS_SECRET, else a hash of the Storage connection string (always
 *   present in prod), else an insecure dev constant (dev mode only).
 */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export type RealtimeRole = 'viewer' | 'broadcaster' | 'editor';

interface WsTokenClaims {
  routeId: string;
  role: RealtimeRole;
  /** Expiry, epoch seconds. */
  exp: number;
}

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const explicit = process.env.REALTIME_WS_SECRET;
  if (explicit) {
    cachedSecret = explicit;
    return cachedSecret;
  }
  const storage = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  if (storage) {
    cachedSecret = createHash('sha256').update(`fsr-ws:${storage}`).digest('hex');
    return cachedSecret;
  }
  // Dev fallback only — privileged WS auth is not security-critical locally
  // (dev mode bypasses auth entirely and uses BroadcastChannel).
  cachedSecret = 'dev-insecure-realtime-secret';
  return cachedSecret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Sign a token authorising a privileged WS connection for `ttlSeconds`. */
export function signWsToken(routeId: string, role: RealtimeRole, ttlSeconds = 7200): string {
  const claims: WsTokenClaims = {
    routeId,
    role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = base64url(JSON.stringify(claims));
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Verify a token; returns claims when valid and unexpired, else null. */
export function verifyWsToken(token: string | null | undefined): WsTokenClaims | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.', 2);
  if (!payload || !sig) return null;

  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as WsTokenClaims;
    if (!claims.routeId || !claims.role) return null;
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
