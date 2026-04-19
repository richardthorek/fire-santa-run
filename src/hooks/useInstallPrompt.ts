/**
 * useInstallPrompt hook
 *
 * Manages PWA "Add to Home Screen" install prompt lifecycle:
 * - Captures the `beforeinstallprompt` event on Chrome/Android/Edge
 * - Detects iOS Safari for custom install instructions
 * - Detects already-installed (standalone) mode
 * - Persists dismiss state in localStorage for 7 days
 * - Tracks install analytics events
 *
 * Usage:
 *   const { isInstallable, isIOS, isInstalled, isDismissed, promptInstall, dismiss } = useInstallPrompt();
 */

import { useState, useEffect, useCallback } from 'react';

/** Browser-specific event type for the install prompt */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallPromptState {
  /** True if the app can be installed via native prompt (Chrome/Android/Edge) or iOS custom instructions */
  isInstallable: boolean;
  /** True if running on iOS Safari — requires custom step-by-step instructions */
  isIOS: boolean;
  /** True if the app is already running in standalone/installed mode */
  isInstalled: boolean;
  /** True if the user has dismissed the banner within the snooze window (7 days) */
  isDismissed: boolean;
}

const DISMISS_STORAGE_KEY = 'pwa-install-dismissed-until';
/** Snooze duration: 7 days in milliseconds */
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Detect iOS Safari based on user agent and navigator.standalone.
 * Returns true only for Safari on iOS/iPadOS, not Chrome-on-iOS.
 */
function detectIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  // Safari on iOS does not include 'CriOS' (Chrome iOS) or 'FxiOS' (Firefox iOS)
  const isSafari = isIOS && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
  return isSafari;
}

/**
 * Detect whether the app is already installed / running in standalone mode.
 */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Check whether the install banner is currently snoozed (dismissed by user).
 */
function checkDismissed(): boolean {
  try {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!stored) return false;
    return Date.now() < parseInt(stored, 10);
  } catch {
    return false;
  }
}

/**
 * Log a PWA install analytics event.
 * In development this prints to the console; in production it can be
 * wired up to an analytics/telemetry service.
 */
function logInstallEvent(event: string, metadata?: Record<string, unknown>): void {
  const payload = { timestamp: new Date().toISOString(), ...metadata };
  console.log(`[PWA] ${event}`, payload);

  // TODO: wire up to production analytics / telemetry service when available
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallPromptState>(() => {
    const isIOS = detectIOSSafari();
    const isInstalled = detectStandalone();
    return {
      // iOS Safari is always "installable" from our perspective because we show
      // custom step-by-step instructions (the browser never fires beforeinstallprompt).
      isInstallable: isIOS && !isInstalled,
      isIOS,
      isInstalled,
      isDismissed: checkDismissed(),
    };
  });

  useEffect(() => {
    // Nothing to do if already installed
    if (state.isInstalled) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState((prev) => ({ ...prev, isInstallable: true }));
      logInstallEvent('pwa.install_prompt_available');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setState((prev) => ({ ...prev, isInstallable: false, isInstalled: true }));
      logInstallEvent('pwa.app_installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
    // Only re-run if isInstalled changes (isIOS is stable after init)
  }, [state.isInstalled]);

  /**
   * Trigger the native browser install prompt (Chrome/Android/Edge).
   * No-op on iOS — the banner shows manual instructions instead.
   */
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    logInstallEvent('pwa.install_prompt_shown');
    await deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      logInstallEvent('pwa.install_accepted');
      setDeferredPrompt(null);
      setState((prev) => ({ ...prev, isInstallable: false }));
    } else {
      logInstallEvent('pwa.install_declined');
    }
  }, [deferredPrompt]);

  /**
   * Dismiss the install banner for 7 days.
   */
  const dismiss = useCallback(() => {
    const until = Date.now() + DISMISS_DURATION_MS;
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(until));
    } catch {
      // localStorage not available — just hide in-memory
    }
    setState((prev) => ({ ...prev, isDismissed: true }));
    logInstallEvent('pwa.install_banner_dismissed');
  }, []);

  return { ...state, promptInstall, dismiss };
}
