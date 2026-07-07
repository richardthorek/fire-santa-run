// StrictMode removed temporarily to diagnose remount loop in ProfilePage
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import './index.css'
import App from './App.tsx'
import { AuthProvider, BrigadeProvider } from './context'
// Direct module import: the components barrel re-exports MapView, which would
// pull mapbox-gl into the entry chunk for every visitor.
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorHandlers, installClientErrorReporter } from './utils/errorLogger'
import { validateClientEnv, EnvironmentConfigError, isProductionMode } from './config/env'
import { msalConfig, isMsalConfigured } from './auth/msalConfig'
import './utils/fontLoader' // Initialize async font loading (CSP-compliant)

// Capture uncaught errors and unhandled promise rejections app-wide.
installGlobalErrorHandlers();

// In production, forward client errors to the backend sink for monitoring.
if (isProductionMode()) {
  installClientErrorReporter();
}

// Create MSAL instance
// In dev mode or when MSAL is not configured, we create a minimal instance
// that won't be used (AuthContext will bypass MSAL in these cases)
const msalInstance = isMsalConfigured() 
  ? new PublicClientApplication(msalConfig)
  : new PublicClientApplication({
      auth: {
        clientId: 'dev-mode-bypass',
        authority: 'https://login.microsoftonline.com/common',
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    });

// Expose MSAL instance globally so non-React modules (e.g., HTTP storage adapter)
// can acquire tokens for API calls in production mode.
// This is a safe, minimal bridge and only used when VITE_DEV_MODE=false.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__msalInstance = msalInstance;

/**
 * Render a minimal, dependency-free fatal-configuration screen directly into
 * #root. Used when environment validation fails in production so operators see
 * a clear message instead of a blank white page.
 */
function renderFatalConfigError(error: unknown): void {
  const problems =
    error instanceof EnvironmentConfigError
      ? error.problems
      : [error instanceof Error ? error.message : String(error)];

  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:system-ui,sans-serif;background:#FAFAFA;color:#212121;">
        <div style="max-width:34rem;width:100%;background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2);padding:2rem;">
          <div style="font-size:3rem;margin-bottom:0.5rem;">🎅🔧</div>
          <h1 style="color:#D32F2F;font-size:1.4rem;margin:0 0 0.75rem;">Configuration problem</h1>
          <p style="margin:0 0 1rem;line-height:1.6;">Fire Santa Run can't start because some required settings are missing or invalid:</p>
          <ul style="margin:0 0 1rem;padding-left:1.25rem;line-height:1.6;">
            ${problems.map((p) => `<li>${p.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</li>`).join('')}
          </ul>
          <p style="margin:0;color:#616161;font-size:0.9rem;">See <code>.env.example</code> and <code>docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md</code>.</p>
        </div>
      </div>`;
  }

  try {
    document.getElementById('msal-loading')?.remove();
  } catch {
    /* no-op */
  }
}

// Initialize MSAL and render app
// CRITICAL: We must wait for handleRedirectPromise() to complete BEFORE rendering React
// This prevents race conditions on iOS Safari where the app renders before auth completes
async function initializeApp() {
  // Fail fast on invalid configuration with a clear, user-visible message.
  try {
    validateClientEnv();
  } catch (error) {
    console.error('[env] Fatal configuration error:', error);
    renderFatalConfigError(error);
    return;
  }

  if (isMsalConfigured()) {
    try {
      // Initialize MSAL instance
      await msalInstance.initialize();
      
      // Account selection logic is app dependent
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }

      // Optional - Listen to authentication events
      msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
          // @ts-expect-error - MSAL event payload types are complex
          const account = event.payload.account;
          msalInstance.setActiveAccount(account);
        }
      });

      // Handle redirect promise after login/logout and set active account from the result
      // CRITICAL: Wait for this to complete before rendering React
      const result = await msalInstance.handleRedirectPromise();
      if (result?.account) {
        msalInstance.setActiveAccount(result.account);
        if (import.meta.env.DEV) {
          console.log('[MSAL] Redirect handled successfully, account:', result.account.homeAccountId);
        }
      }
    } catch (error) {
      console.error('[MSAL] Error during initialization:', error);
    }
  }

  // Render React app after MSAL initialization completes
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[App] Root element not found. Cannot render application.');
    return;
  }

  createRoot(rootElement).render(
    <ErrorBoundary fullScreen>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <BrigadeProvider>
            <App />
          </BrigadeProvider>
        </AuthProvider>
      </MsalProvider>
    </ErrorBoundary>,
  );

  // Remove the loading screen after React has mounted
  try {
    document.getElementById('msal-loading')?.remove();
  } catch (error) {
    console.warn('[App] Failed to remove loading screen:', error);
  }
}

// Start the app
initializeApp();
