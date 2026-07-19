import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, BrigadeProvider } from './context'
// Direct module import: the components barrel re-exports MapView, which would
// pull mapbox-gl into the entry chunk for every visitor.
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorHandlers, installClientErrorReporter } from './utils/errorLogger'
import { validateClientEnv, EnvironmentConfigError, isProductionMode } from './config/env'

// Capture uncaught errors and unhandled promise rejections app-wide.
installGlobalErrorHandlers();

// In production, forward client errors to the backend sink for monitoring.
if (isProductionMode()) {
  installClientErrorReporter();
}

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
    document.getElementById('auth-loading')?.remove();
  } catch {
    /* no-op */
  }
}

function initializeApp(): void {
  // Fail fast on invalid configuration with a clear, user-visible message.
  try {
    validateClientEnv();
  } catch (error) {
    console.error('[env] Fatal configuration error:', error);
    renderFatalConfigError(error);
    return;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[App] Root element not found. Cannot render application.');
    return;
  }

  createRoot(rootElement).render(
    <ErrorBoundary fullScreen>
      <AuthProvider>
        <BrigadeProvider>
          <App />
        </BrigadeProvider>
      </AuthProvider>
    </ErrorBoundary>,
  );

  try {
    document.getElementById('auth-loading')?.remove();
  } catch (error) {
    console.warn('[App] Failed to remove loading screen:', error);
  }
}

initializeApp();
