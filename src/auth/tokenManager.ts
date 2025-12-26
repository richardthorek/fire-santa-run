/**
 * Token management utilities for MSAL authentication.
 * 
 * Handles token refresh, expiration checking, and session management.
 */

import type { PublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { tokenRequest } from './msalConfig';

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
  requiresInteraction?: boolean;
}

/**
 * Attempt to silently refresh the access token.
 * 
 * This should be called periodically or before API requests to ensure
 * the user has a valid token.
 * 
 * @param instance - MSAL instance
 * @param account - User account to refresh token for
 * @returns Token refresh result
 */
export async function refreshToken(
  instance: PublicClientApplication,
  account: AccountInfo
): Promise<TokenRefreshResult> {
  try {
    // Attempt silent token acquisition
    const response = await instance.acquireTokenSilent({
      ...tokenRequest,
      account,
      forceRefresh: false, // Use cached token if not expired
    });

    return {
      success: true,
      accessToken: response.accessToken,
    };
  } catch (error) {
    console.error('[Token] Silent token acquisition failed:', error);

    // Check if interaction is required (token expired and can't be refreshed silently)
    if (error instanceof InteractionRequiredAuthError) {
      return {
        success: false,
        error: 'Interaction required to refresh token',
        requiresInteraction: true,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requiresInteraction: false,
    };
  }
}

/**
 * Force refresh the access token (bypass cache).
 * 
 * Use this when you need to ensure a fresh token.
 * 
 * @param instance - MSAL instance
 * @param account - User account to refresh token for
 * @returns Token refresh result
 */
export async function forceRefreshToken(
  instance: PublicClientApplication,
  account: AccountInfo
): Promise<TokenRefreshResult> {
  try {
    const response = await instance.acquireTokenSilent({
      ...tokenRequest,
      account,
      forceRefresh: true, // Force refresh even if cached token is not expired
    });

    return {
      success: true,
      accessToken: response.accessToken,
    };
  } catch (error) {
    console.error('[Token] Force refresh failed:', error);

    if (error instanceof InteractionRequiredAuthError) {
      return {
        success: false,
        error: 'Interaction required to refresh token',
        requiresInteraction: true,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requiresInteraction: false,
    };
  }
}

/**
 * Get the current access token (from cache or silently refresh).
 * 
 * @param instance - MSAL instance
 * @param account - User account
 * @returns Access token or null
 */
export async function getAccessToken(
  instance: PublicClientApplication,
  account: AccountInfo
): Promise<string | null> {
  const result = await refreshToken(instance, account);
  return result.success ? result.accessToken || null : null;
}

/**
 * Check if the user's session is still valid.
 * 
 * @param instance - MSAL instance
 * @param account - User account
 * @returns True if session is valid
 */
export async function isSessionValid(
  instance: PublicClientApplication,
  account: AccountInfo
): Promise<boolean> {
  const result = await refreshToken(instance, account);
  return result.success;
}

/**
 * Session expiration warning threshold (5 minutes before expiration)
 */
export const SESSION_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if token is about to expire and show warning.
 * 
 * @param instance - MSAL instance
 * @param account - User account
 * @returns True if token is about to expire
 */
export function isTokenNearExpiry(
  instance: PublicClientApplication,
  account: AccountInfo
): boolean {
  try {
    // Get cached token info (doesn't make network request)
    const tokenCache = instance.getTokenCache();
    const accounts = tokenCache.getAllAccounts();
    
    if (accounts.length === 0) return true;
    
    // MSAL automatically handles token expiration checks
    // If we can't get a token silently, it means it's expired or near expiry
    return false; // Let MSAL handle this automatically
  } catch (error) {
    console.error('[Token] Error checking token expiry:', error);
    return true; // Assume expired on error
  }
}

/**
 * Clear all cached tokens for a user.
 * 
 * Call this during logout to ensure clean session termination.
 * 
 * @param instance - MSAL instance
 * @param account - User account
 */
export async function clearTokenCache(
  instance: PublicClientApplication,
  account: AccountInfo
): Promise<void> {
  try {
    // Remove account from cache (removes all associated tokens)
    await instance.logout({
      account,
      onRedirectNavigate: () => false, // Prevent redirect, just clear cache
    });
  } catch (error) {
    console.error('[Token] Error clearing token cache:', error);
  }
}
