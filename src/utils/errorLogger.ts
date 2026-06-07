/**
 * errorLogger — minimal client-side error reporting seam.
 *
 * Today this logs to the console and exposes a hook (`window.__onClientError`)
 * so non-React code and future monitoring can subscribe. The ErrorBoundary and
 * global handlers route through here so there is a single place to wire up a
 * real sink (Application Insights / backend endpoint) in #340 (observability).
 */

export interface ClientErrorContext {
  /** Where the error originated, e.g. 'react-error-boundary', 'window.onerror'. */
  source: string;
  /** Optional React component stack or extra metadata. */
  componentStack?: string;
  /** Arbitrary extra context (route, brigadeId, etc.). */
  extra?: Record<string, unknown>;
}

type ClientErrorListener = (error: Error, context: ClientErrorContext) => void;

declare global {
  interface Window {
    /** Optional subscriber invoked for every reported client error. */
    __onClientError?: ClientErrorListener;
  }
}

/**
 * Report a client-side error. Safe to call from anywhere; never throws.
 */
export function logClientError(error: Error, context: ClientErrorContext): void {
  // Always surface in the console for local debugging.
  console.error(`[client-error:${context.source}]`, error, context.extra ?? '');

  // Hand off to an optional sink. Wrapped so a faulty listener can never
  // break the calling code (e.g. the ErrorBoundary fallback render).
  try {
    window.__onClientError?.(error, context);
  } catch (listenerError) {
    console.error('[client-error] listener threw:', listenerError);
  }
}

/**
 * Install global handlers for uncaught errors and unhandled promise
 * rejections. Idempotent — safe to call once at startup.
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __globalErrorHandlersInstalled?: boolean }).__globalErrorHandlersInstalled) {
    return;
  }
  (window as unknown as { __globalErrorHandlersInstalled?: boolean }).__globalErrorHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    logClientError(error, { source: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logClientError(error, { source: 'unhandledrejection' });
  });
}

/**
 * Decide whether a given error report should be sent, based on a sample rate
 * in [0, 1]. Exposed for testing. 1 = always, 0 = never.
 */
export function shouldSample(sampleRate: number, random: number = Math.random()): boolean {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  return random < sampleRate;
}

/**
 * Install a best-effort reporter that forwards client errors to the backend
 * sink (`POST /api/client-errors`), where App Service / App Insights captures
 * them. Safe to call once at startup.
 *
 * Guards against feedback loops: a failure inside the reporter is swallowed and
 * never re-reported, so a flaky network can't amplify into an error storm.
 */
export function installClientErrorReporter(options?: {
  endpoint?: string;
  sampleRate?: number;
}): void {
  if (typeof window === 'undefined') return;

  const endpoint = options?.endpoint ?? '/api/client-errors';
  const sampleRate = options?.sampleRate ?? 1;

  // Preserve any existing subscriber (e.g. a test or future App Insights hook).
  const existing = window.__onClientError;
  let reporting = false;

  window.__onClientError = (error, context) => {
    existing?.(error, context);

    // Never report while already inside a report (loop guard).
    if (reporting) return;
    if (!shouldSample(sampleRate)) return;

    reporting = true;
    try {
      const payload = JSON.stringify({
        message: error.message,
        stack: error.stack,
        source: context.source,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      // keepalive lets the request survive a page unload after a fatal error.
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        /* swallow — reporting failures must never re-trigger reporting */
      });
    } catch {
      /* never throw from the reporter */
    } finally {
      reporting = false;
    }
  };
}
