/**
 * Authentication utilities for validating JWT tokens from Microsoft Entra External ID
 * 
 * This module provides middleware functions to:
 * - Validate JWT tokens from Authorization header
 * - Verify token signature using Entra's public keys (JWKS)
 * - Extract user information from token claims
 * - Check token expiration
 */

import { HttpRequest } from '@azure/functions';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import type { BrigadeMembership } from '../../../src/types/membership';

// JWT validation configuration
// Note: Tenant ID is public information for the Brigade Santa Run Entra External ID tenant
// It's used to construct the JWKS endpoint URL for fetching public keys
const ENTRA_TENANT_ID = process.env.VITE_ENTRA_TENANT_ID || '50fcb752-2a4e-4efd-bdc2-e18a5042c5a8';
const ENTRA_CLIENT_ID = process.env.VITE_ENTRA_CLIENT_ID || '';
const JWKS_URI = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`;

// Dev mode bypass flag
// Note: Uses VITE_ prefix for consistency with frontend environment variables in Azure Static Web Apps
// All environment variables are shared between frontend and API in Azure Static Web Apps
const isDevMode = process.env.VITE_DEV_MODE === 'true';

// JWKS client for fetching public keys
const jwksClientInstance = jwksClient.default({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

/**
 * Get the signing key for JWT verification
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  jwksClientInstance.getSigningKey(header.kid as string, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Decoded JWT payload with user claims
 */
export interface DecodedToken {
  oid: string; // Object ID (user ID in Entra)
  sub: string; // Subject (user identifier)
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  aud: string; // Audience (client ID)
  iss: string; // Issuer
  iat: number; // Issued at
  exp: number; // Expiration
}

/**
 * Authentication result containing user info and error state
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  name?: string;
  error?: string;
  token?: DecodedToken;
}

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: HttpRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }

  // Authorization: Bearer <token>
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validate JWT token and extract user information
 * 
 * In dev mode, this function bypasses validation and returns a mock user.
 * In production mode, it validates the token against Entra External ID.
 */
export async function validateToken(request: HttpRequest): Promise<AuthResult> {
  // Dev mode bypass - return mock authenticated user
  if (isDevMode) {
    return {
      authenticated: true,
      userId: 'dev-user-1',
      email: 'dev@example.gov.au',
      name: 'Dev User',
    };
  }

  // Extract token from header
  const token = extractToken(request);
  
  if (!token) {
    return {
      authenticated: false,
      error: 'No authorization token provided',
    };
  }

  // Validate configuration
  if (!ENTRA_CLIENT_ID) {
    return {
      authenticated: false,
      error: 'Authentication not configured (missing VITE_ENTRA_CLIENT_ID)',
    };
  }

  try {
    // Verify and decode token
    const decoded = await new Promise<DecodedToken>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: ENTRA_CLIENT_ID,
          issuer: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as DecodedToken);
          }
        }
      );
    });

    // Extract user information from claims
    const userId = decoded.oid || decoded.sub;
    const email = decoded.email || decoded.preferred_username;
    const name = decoded.name || `${decoded.given_name || ''} ${decoded.family_name || ''}`.trim();

    return {
      authenticated: true,
      userId,
      email,
      name,
      token: decoded,
    };

  } catch (error: unknown) {
    // Token validation failed
    let errorMessage = 'Invalid or expired token';
    
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token';
      } else if (error.name === 'NotBeforeError') {
        errorMessage = 'Token not yet valid';
      }
    }

    return {
      authenticated: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if user has permission to access a brigade resource
 * 
 * This function validates that:
 * 1. User is authenticated
 * 2. User has an active membership in the brigade
 * 3. User's role has the required permission
 */
export interface BrigadePermissionCheck {
  authorized: boolean;
  membership?: BrigadeMembership;
  error?: string;
}

/**
 * Role-based permissions
 */
export const ROLE_PERMISSIONS = {
  admin: [
    'manage_routes',
    'manage_members',
    'invite_members',
    'approve_members',
    'remove_members',
    'promote_admin',
    'demote_admin',
    'edit_settings',
    'start_navigation',
    'view_members',
    'cancel_invitation',
  ],
  operator: [
    'manage_routes',
    'start_navigation',
    'view_members',
  ],
  viewer: [
    'view_members',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Validate user has permission for an action on a brigade
 * 
 * @param userId - User ID from validated token
 * @param brigadeId - Brigade ID from request
 * @param requiredPermission - Permission required for the action
 * @param getMembership - Function to fetch user's membership in the brigade
 */
export async function checkBrigadePermission(
  userId: string,
  brigadeId: string,
  requiredPermission: string,
  getMembership: (userId: string, brigadeId: string) => Promise<BrigadeMembership | null>
): Promise<BrigadePermissionCheck> {
  try {
    // Fetch user's membership in the brigade
    const membership = await getMembership(userId, brigadeId);

    if (!membership) {
      return {
        authorized: false,
        error: 'User is not a member of this brigade',
      };
    }

    // Check if membership is active
    if (membership.status !== 'active') {
      return {
        authorized: false,
        error: 'User membership is not active',
      };
    }

    // Check if role has required permission
    if (!hasPermission(membership.role, requiredPermission)) {
      return {
        authorized: false,
        error: `User role '${membership.role}' does not have '${requiredPermission}' permission`,
      };
    }

    return {
      authorized: true,
      membership,
    };

  } catch (error: unknown) {
    return {
      authorized: false,
      error: error instanceof Error ? error.message : 'Failed to check brigade permission',
    };
  }
}
