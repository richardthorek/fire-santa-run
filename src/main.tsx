import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import './index.css'
import App from './App.tsx'
import { AuthProvider, BrigadeProvider } from './context'
import { msalConfig, isMsalConfigured, initializeMsalConfig } from './auth/msalConfig'

// Initialize and validate MSAL configuration
initializeMsalConfig();

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

// Initialize MSAL and render app
// CRITICAL: We must wait for handleRedirectPromise() to complete BEFORE rendering React
// This prevents race conditions on iOS Safari where the app renders before auth completes
async function initializeApp() {
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
        console.log('[MSAL] Redirect handled successfully, account set:', result.account.username);
      }
    } catch (error) {
      console.error('[MSAL] Error during initialization:', error);
    }
  }

  // Render React app after MSAL initialization completes
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <BrigadeProvider>
            <App />
          </BrigadeProvider>
        </AuthProvider>
      </MsalProvider>
    </StrictMode>,
  );

  // Remove the loading screen after React has mounted
  const loadingElement = document.getElementById('msal-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
}

// Start the app
initializeApp();
