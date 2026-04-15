import { useState, useEffect, useCallback, useRef } from 'react';
import { Workbox } from 'workbox-window';

export interface ServiceWorkerState {
  isRegistered: boolean;
  /** True when a new service worker version is waiting to activate */
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

/**
 * Registers the service worker and tracks its state.
 *
 * Service worker registration is skipped in development mode
 * (VITE_DEV_MODE=true) and in non-production builds to avoid
 * caching issues during development.
 *
 * Usage:
 *   const { isRegistered, isUpdateAvailable, applyUpdate } = useServiceWorker();
 */
export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isRegistered: false,
    isUpdateAvailable: false,
    registration: null,
  });

  const wbRef = useRef<Workbox | null>(null);

  // Apply a waiting service worker update and reload the page
  const applyUpdate = useCallback(() => {
    const wb = wbRef.current;
    if (!wb) return;

    // Tell the waiting SW to skip waiting, then reload once it takes control
    wb.addEventListener('controlling', () => {
      window.location.reload();
    });

    wb.messageSkipWaiting();
  }, []);

  useEffect(() => {
    // Only register in production builds and when not in dev mode
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD || isDevMode) {
      return;
    }

    const wb = new Workbox('/sw.js');
    wbRef.current = wb;

    wb.addEventListener('installed', (event) => {
      if (!event.isUpdate) {
        // First install – app is now ready for offline use
        console.log('[SW] App is ready to work offline.');
      }
    });

    wb.addEventListener('waiting', () => {
      // A new SW version is waiting to activate
      setState((prev) => ({ ...prev, isUpdateAvailable: true }));
    });

    wb.register()
      .then((reg) => {
        if (reg) {
          setState((prev) => ({
            ...prev,
            isRegistered: true,
            registration: reg,
          }));
        }
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err);
      });

    return () => {
      // Workbox does not expose an unregister API on the Workbox class;
      // cleanup is handled by the browser lifecycle.
    };
  }, []);

  return { ...state, applyUpdate };
}
