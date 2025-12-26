/**
 * Microsoft Authentication Library (MSAL) Configuration
 * 
 * This file configures MSAL for authentication with Microsoft Entra External ID.
 * 
 * Tenant Information:
 * - Name: Brigade Santa Run
 * - Tenant ID: 50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
 * - Domain: brigadesantarun.onmicrosoft.com
 * 
 * For setup instructions, see: docs/ENTRA_EXTERNAL_ID_SETUP.md
 */

import type { Configuration, RedirectRequest, SilentRequest } from '@azure/msal-browser';
import { LogLevel, BrowserCacheLocation } from '@azure/msal-browser';

type TokenRequestShape = Omit<SilentRequest, 'account'>;

/**
 * Validate MSAL configuration and throw helpful errors if misconfigured
 */
export function validateMsalConfig(): void {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  // In dev mode, MSAL is optional - bypass validation
  if (isDevMode) {
    return;
  }

  // In production mode, MSAL configuration is required
  const requiredVars = [
    'VITE_ENTRA_CLIENT_ID',
    'VITE_ENTRA_TENANT_ID',
    'VITE_ENTRA_AUTHORITY',
  ];

  const missing = requiredVars.filter(v => !import.meta.env[v]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required Entra External ID configuration:\n` +
      `${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please add these to your .env.local file or Azure Static Web App configuration.\n` +
      `See docs/ENTRA_EXTERNAL_ID_SETUP.md for setup instructions.`
    );
  }

  const authority = import.meta.env.VITE_ENTRA_AUTHORITY || '';
  const normalizedAuthority = authority.toLowerCase();
  if (/\/(common|organizations|consumers)\b/.test(normalizedAuthority)) {
    throw new Error(
      'VITE_ENTRA_AUTHORITY must be tenant-specific (no /common, /organizations, or /consumers). ' +
      'Set it to https://login.microsoftonline.com/<tenant-id> or your CIAM policy endpoint.'
    );
  }

  // CIAM/B2C authorities must point to the policy root, NOT the authorize endpoint
  // e.g. https://<tenant>.ciamlogin.com/<tenant>.onmicrosoft.com/<policy>
  if (/\/oauth2\//.test(normalizedAuthority) || /\/authorize/.test(normalizedAuthority)) {
    throw new Error(
      'VITE_ENTRA_AUTHORITY should not include /oauth2/v2.0/authorize. ' +
      'Use the policy root only, e.g. https://<tenant>.ciamlogin.com/<tenant>.onmicrosoft.com/<policy>'
    );
  }

  // Validate redirect URI is configured
  if (!import.meta.env.VITE_ENTRA_REDIRECT_URI) {
    console.warn(
      '[MSAL] VITE_ENTRA_REDIRECT_URI not configured. ' +
      'Using default redirect URI based on window.location.origin. ' +
      'Set VITE_ENTRA_REDIRECT_URI explicitly for production.'
    );
  }
}

/**
 * Get the redirect URI for MSAL authentication
 * Uses environment variable if set, otherwise constructs from current origin
 */
export function getRedirectUri(): string {
  if (import.meta.env.VITE_ENTRA_REDIRECT_URI) {
    return import.meta.env.VITE_ENTRA_REDIRECT_URI;
  }
  
  // Fallback to constructing from window location
  // In production, you should explicitly set VITE_ENTRA_REDIRECT_URI
  return `${window.location.origin}/auth/callback`;
}

/**
 * MSAL Configuration Object
 * 
 * This configuration is used by MsalProvider to initialize the MSAL instance.
 * It handles authentication with Microsoft Entra External ID using the
 * Authorization Code Flow with PKCE (recommended for SPAs).
 */
export const msalConfig: Configuration = {
  auth: {
    // Application (client) ID from Azure App Registration
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    
    // Authority URL: https://login.microsoftonline.com/{tenant-id}
    // For Brigade Santa Run: https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
    authority: import.meta.env.VITE_ENTRA_AUTHORITY || '',
    
    // Redirect URI after successful authentication
    // Must match exactly with URI configured in Azure App Registration
    redirectUri: getRedirectUri(),
    
    // Post-logout redirect URI (optional)
    // If not set, user is redirected to authority's default logout page
    postLogoutRedirectUri: window.location.origin,
    
    // Navigate to login request page after logout
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // Use sessionStorage for token cache
    // Options: 'sessionStorage' | 'localStorage' | 'memoryStorage'
    // sessionStorage: Tokens cleared when tab/browser closes (more secure)
    // localStorage: Tokens persist across browser sessions (better UX)
    cacheLocation: BrowserCacheLocation.SessionStorage,
    
    // Store auth state in cookies for SSO scenarios
    // Enables silent single sign-on across browser tabs
    storeAuthStateInCookie: false, // Set to true if supporting IE11 or Edge Legacy
  },
  system: {
    // Configure logging for debugging
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) {
          return; // Don't log messages containing PII
        }
        
        switch (level) {
          case LogLevel.Error:
            console.error(`[MSAL Error] ${message}`);
            return;
          case LogLevel.Warning:
            console.warn(`[MSAL Warning] ${message}`);
            return;
          case LogLevel.Info:
            // Only log info in development
            if (import.meta.env.DEV) {
              console.info(`[MSAL Info] ${message}`);
            }
            return;
          case LogLevel.Verbose:
            // Only log verbose in development
            if (import.meta.env.DEV) {
              console.debug(`[MSAL Verbose] ${message}`);
            }
            return;
          case LogLevel.Trace:
            // Only log trace in development with explicit flag
            if (import.meta.env.DEV && import.meta.env.VITE_MSAL_TRACE_LOGGING === 'true') {
              console.debug(`[MSAL Trace] ${message}`);
            }
            return;
        }
      },
      logLevel: import.meta.env.DEV ? LogLevel.Info : LogLevel.Warning,
      piiLoggingEnabled: false, // NEVER enable PII logging in production
    },
    
    // Window options for popup authentication (if using loginPopup)
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
    
    // Allow redirects to originate from iframe
    allowRedirectInIframe: false,
  },
};

/**
 * Scopes for API access
 * 
 * These scopes define what permissions the application requests from the user.
 * They should match the permissions configured in Azure App Registration.
 */
const domainHint = import.meta.env.VITE_ENTRA_DOMAIN_HINT;

export const loginRequest: RedirectRequest = {
  scopes: [
    'openid',      // Required for authentication
    'profile',     // Access to user's profile info (name, etc.)
    'email',       // Access to user's email address
    'User.Read',   // Microsoft Graph API - read user profile
  ],
  prompt: 'login',                // Force email entry instead of account picker
  ...(domainHint ? { domainHint } : {}),
};

/**
 * Scopes for silent token acquisition
 * 
 * These scopes are used when silently refreshing tokens without user interaction.
 * Should be a subset of loginRequest scopes.
 */
export const tokenRequest: TokenRequestShape = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
  ],
  // Force refresh to get a new token (useful for debugging)
  forceRefresh: false,
};

/**
 * Protected resource endpoints
 * 
 * Define API endpoints and their required scopes for easy reference.
 */
export const protectedResources = {
  // Microsoft Graph API
  graphMe: {
    endpoint: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['User.Read'],
  },
  
  // Fire Santa Run API (Azure Functions)
  api: {
    endpoint: '/api',
    scopes: [], // Custom API scopes if needed
  },
};

/**
 * MSAL Instance State Management
 * 
 * These constants help manage authentication state in the UI.
 */
export const msalAuthStates = {
  // Login redirect is in progress
  LOGIN_IN_PROGRESS: 'login_in_progress',
  
  // Logout redirect is in progress
  LOGOUT_IN_PROGRESS: 'logout_in_progress',
  
  // Silent token acquisition in progress
  ACQUIRE_TOKEN_IN_PROGRESS: 'acquire_token_in_progress',
  
  // Redirect callback is being processed
  HANDLING_REDIRECT: 'handling_redirect',
} as const;

/**
 * Helper function to check if MSAL is properly configured
 * Returns true if all required config values are present
 */
export function isMsalConfigured(): boolean {
  return !!(
    import.meta.env.VITE_ENTRA_CLIENT_ID &&
    import.meta.env.VITE_ENTRA_AUTHORITY
  );
}

/**
 * Helper function to get user-friendly error messages for MSAL errors
 */
export function getMsalErrorMessage(error: Error): string {
  const errorMessage = error.message.toLowerCase();
  
  // Common error scenarios with helpful messages
  if (errorMessage.includes('user_cancelled')) {
    return 'Login was cancelled. Please try again.';
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  if (errorMessage.includes('popup_window_error')) {
    return 'Pop-up was blocked. Please allow pop-ups for this site or use redirect login.';
  }
  
  if (errorMessage.includes('endpoints_resolution_error')) {
    return 'Authentication service configuration error. Please contact support.';
  }
  
  if (errorMessage.includes('token_renewal_error')) {
    return 'Session expired. Please log in again.';
  }
  
  // Default: return original error message for unexpected errors
  return `Authentication error: ${error.message}`;
}

/**
 * Export configuration validation function
 * Call this early in application initialization to validate config
 */
export function initializeMsalConfig(): void {
  // Validate configuration
  validateMsalConfig();
  
  // Log configuration status in development
  if (import.meta.env.DEV) {
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
    console.log('[MSAL] Configuration initialized');
    console.log(`[MSAL] Dev mode: ${isDevMode}`);
    console.log(`[MSAL] Configured: ${isMsalConfigured()}`);
    
    if (!isDevMode && !isMsalConfigured()) {
      console.warn(
        '[MSAL] Production mode detected but MSAL not configured. ' +
        'Authentication will fail until environment variables are set.'
      );
    }
  }
}
