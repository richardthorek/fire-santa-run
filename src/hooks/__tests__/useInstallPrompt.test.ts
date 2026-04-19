/**
 * Tests for useInstallPrompt hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstallPrompt } from '../useInstallPrompt';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Fire a BeforeInstallPromptEvent-like event on window. */
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.preventDefault = vi.fn();
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

/** Set navigator.userAgent to an iOS Safari UA. */
function setIOSSafariUA() {
  Object.defineProperty(navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    configurable: true,
  });
}

/** Restore navigator.userAgent to a non-iOS UA. */
function resetUA() {
  Object.defineProperty(navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    configurable: true,
  });
}

/** Set window.matchMedia to simulate standalone / browser display mode. */
function setDisplayMode(mode: 'standalone' | 'browser') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: mode === 'standalone' && query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('useInstallPrompt', () => {
  beforeEach(() => {
    resetUA();
    setDisplayMode('browser');
    localStorage.clear();
    // Silence PWA log output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isInstallable=false and isInstalled=false initially on a non-iOS browser', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isIOS).toBe(false);
    expect(result.current.isDismissed).toBe(false);
  });

  it('sets isInstallable=true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      fireBeforeInstallPrompt();
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it('sets isInstalled=true and isInstallable=false when appinstalled fires', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.isInstallable).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('detects already-installed (standalone) mode on initialisation', () => {
    setDisplayMode('standalone');
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstalled).toBe(true);
  });

  it('detects iOS Safari and sets isIOS=true', () => {
    setIOSSafariUA();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(true);
    // iOS Safari can't fire beforeinstallprompt, but hook marks it as installable
    expect(result.current.isInstallable).toBe(true);
  });

  it('does not set isIOS=true for Chrome on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(false);
  });

  it('dismiss() sets isDismissed=true and stores expiry in localStorage', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isDismissed).toBe(true);
    const stored = localStorage.getItem('pwa-install-dismissed-until');
    expect(stored).not.toBeNull();
    expect(parseInt(stored!, 10)).toBeGreaterThan(Date.now());
  });

  it('reads existing dismiss expiry from localStorage on mount', () => {
    const future = Date.now() + 60_000;
    localStorage.setItem('pwa-install-dismissed-until', String(future));

    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isDismissed).toBe(true);
  });

  it('does not treat an expired dismiss entry as dismissed', () => {
    const past = Date.now() - 60_000;
    localStorage.setItem('pwa-install-dismissed-until', String(past));

    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isDismissed).toBe(false);
  });

  it('promptInstall() calls prompt() on the deferred event and updates state on accept', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let capturedEvent: ReturnType<typeof fireBeforeInstallPrompt> | undefined;

    act(() => {
      capturedEvent = fireBeforeInstallPrompt('accepted');
    });

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(capturedEvent!.prompt).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(false);
  });

  it('promptInstall() keeps isInstallable=true when user declines', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      fireBeforeInstallPrompt('dismissed');
    });

    await act(async () => {
      await result.current.promptInstall();
    });

    // Declined — should still be considered installable (user may try again)
    expect(result.current.isInstallable).toBe(true);
  });

  it('promptInstall() is a no-op when no deferred prompt is available', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    // Should not throw
    await act(async () => {
      await result.current.promptInstall();
    });
  });

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => useInstallPrompt());
    unmount();

    // Firing events after unmount should not throw or update state
    act(() => {
      fireBeforeInstallPrompt();
      window.dispatchEvent(new Event('appinstalled'));
    });
  });
});
