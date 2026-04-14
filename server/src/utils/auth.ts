/**
 * Authentication utilities for validating JWT tokens from Microsoft Entra External ID.
 *
 * Accepts the web-standard `Request` object (used by Hono via `c.req.raw`),
 * so there is no dependency on the Azure Functions SDK.
 */

import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import type { BrigadeMembership } from '../types/membership.js';

const ENTRA_TENANT_ID = process.env.VITE_ENTRA_TENANT_ID || '50fcb752-2a4e-4efd-bdc2-e18a5042c5a8';
const ENTRA_CLIENT_ID = process.env.VITE_ENTRA_CLIENT_ID || '';
const ENTRA_AUTHORITY = (process.env.VITE_ENTRA_AUTHORITY || '').replace(/\/$/, '') || `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`;
const ALT_TENANT_AUTHORITY = `https://${ENTRA_TENANT_ID}.ciamlogin.com/${ENTRA_TENANT_ID}`;

const BASE_AUTHORITIES = [ENTRA_AUTHORITY, ALT_TENANT_AUTHORITY].map(a => a.replace(/\/$/, ''));
const ISSUER_CANDIDATES = BASE_AUTHORITIES.map(a => `${a}/v2.0`) as [string, ...string[]];

const isDevMode = process.env.DEV_MODE === 'true';

const jwksClients = BASE_AUTHORITIES.map(authority => {
  const jwksUri = `${authority}/discovery/v2.0/keys`;
  return {
    authority,
    issuer: `${authority}/v2.0`,
    client: jwksClient.default({
      jwksUri,
      cache: true,
      cacheMaxAge: 86400000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    }),
  };
});

function selectJwksClient(token: string) {
  const decoded = jwt.decode(token, { complete: true }) as jwt.Jwt | null;
  const iss = (decoded?.payload as jwt.JwtPayload | undefined)?.iss?.toLowerCase();
  if (iss) {
    const match = jwksClients.find(entry => entry.issuer.toLowerCase() === iss);
    if (match) return match.client;
  }
  return jwksClients[0].client;
}

function getKeyForToken(token: string) {
  const client = selectJwksClient(token);
  return (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void => {
    client.getSigningKey(header.kid as string, (err, key) => {
      if (err) { callback(err); return; }
      callback(null, key?.getPublicKey());
    });
  };
}

export interface DecodedToken {
  oid: string;
  sub: string;
  tid?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  name?: string;
  error?: string;
  token?: DecodedToken;
}

function buildHomeAccountId(oid?: string, tid?: string): string | undefined {
  if (!oid) return undefined;
  return tid ? `${oid}.${tid}` : oid;
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
 * Validate JWT token from a web-standard Request.
 * In dev mode returns a mock authenticated user; in production validates against Entra External ID.
 */
export async function validateToken(request: Request): Promise<AuthResult> {
  if (isDevMode) {
    return { authenticated: true, userId: 'dev-user-1', email: 'dev@example.gov.au', name: 'Dev User' };
  }

  const token = extractToken(request);
  if (!token) {
    return { authenticated: false, error: 'No authorization token provided' };
  }

  if (!ENTRA_CLIENT_ID) {
    console.warn('[Auth] VITE_ENTRA_CLIENT_ID not set. Skipping audience check.');
  }

  try {
    const decoded = await new Promise<DecodedToken>((resolve, reject) => {
      const validAudiences: [string, string] | undefined = ENTRA_CLIENT_ID
        ? [ENTRA_CLIENT_ID, `api://${ENTRA_CLIENT_ID}`]
        : undefined;

      jwt.verify(
        token,
        getKeyForToken(token),
        {
          ...(validAudiences ? { audience: validAudiences } : {}),
          issuer: ISSUER_CANDIDATES,
          algorithms: ['RS256'],
        },
        (err: jwt.VerifyErrors | null, decoded: unknown) => {
          if (err) reject(err); else resolve(decoded as DecodedToken);
        }
      );
    });

    const oid = decoded.oid || decoded.sub;
    const tenantId = decoded.tid || ENTRA_TENANT_ID;
    const userId = buildHomeAccountId(oid, tenantId);
    const email = decoded.email || decoded.preferred_username;
    const name = decoded.name || `${decoded.given_name || ''} ${decoded.family_name || ''}`.trim();

    return { authenticated: true, userId, email, name, token: decoded };

  } catch (error: unknown) {
    let errorMessage = 'Invalid or expired token';
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') errorMessage = 'Token has expired';
      else if (error.name === 'JsonWebTokenError') errorMessage = 'Invalid token';
      else if (error.name === 'NotBeforeError') errorMessage = 'Token not yet valid';
    }
    const decoded = jwt.decode(token) as DecodedToken | null;
    return {
      authenticated: false,
      error: `${errorMessage} (iss=${decoded?.iss || 'n/a'}, aud=${decoded?.aud || 'n/a'}, tid=${decoded?.tid || 'n/a'})`,
    };
  }
}

export interface BrigadePermissionCheck {
  authorized: boolean;
  membership?: BrigadeMembership;
  error?: string;
}

export const ROLE_PERMISSIONS = {
  admin: ['manage_routes','manage_members','invite_members','approve_members','remove_members','promote_admin','demote_admin','edit_settings','start_navigation','view_members','cancel_invitation'],
  operator: ['manage_routes','start_navigation','view_members'],
  viewer: ['view_members'],
};

export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  return permissions ? permissions.includes(permission) : false;
}

export async function checkBrigadePermission(
  userId: string,
  brigadeId: string,
  requiredPermission: string,
  getMembership: (userId: string, brigadeId: string) => Promise<BrigadeMembership | null>
): Promise<BrigadePermissionCheck> {
  try {
    const membership = await getMembership(userId, brigadeId);
    if (!membership) return { authorized: false, error: 'User is not a member of this brigade' };
    if (membership.status !== 'active') return { authorized: false, error: 'User membership is not active' };
    if (!hasPermission(membership.role, requiredPermission)) {
      return { authorized: false, error: `User role '${membership.role}' does not have '${requiredPermission}' permission` };
    }
    return { authorized: true, membership };
  } catch (error: unknown) {
    return { authorized: false, error: error instanceof Error ? error.message : 'Failed to check brigade permission' };
  }
}
