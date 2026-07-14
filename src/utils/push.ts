/**
 * Client helpers for "notify me when Santa starts" (Web Push).
 *
 * The server exposes its VAPID public key at GET /api/push/public-key; a 404
 * means push isn't configured for this deployment and the UI should hide the
 * notify button. Subscriptions are stored per-route server-side and fired on
 * the run's first location broadcast.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/** Local record of which routes this browser subscribed to (drives UI state). */
const SUBSCRIBED_KEY = 'santa_push_subscribed_routes';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** True when the page is running as an installed PWA (home-screen / standalone). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag for home-screen web apps.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh, so also treat a touch-capable Mac as iOS.
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Detect embedded webviews (Facebook, Instagram, Messenger, Twitter, TikTok,
 * LINE, Snapchat, Pinterest). Most shared links open here, and these webviews
 * support neither Web Push nor Add-to-Home-Screen — so we must point people out
 * to a real browser rather than silently showing nothing.
 */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Twitter|TikTok|musical_ly|Snapchat|Pinterest|GSA\//i.test(ua);
}

/**
 * Why a viewer can or can't sign up for the "notify me" push, so the UI can
 * either show the button or explain what to do instead of hiding silently:
 * - `supported`         — Web Push works here; show the button.
 * - `in-app-browser`    — open in Safari/Chrome first.
 * - `ios-needs-install` — iOS only allows push from a home-screen install.
 * - `unsupported`       — no push here (e.g. an older desktop browser).
 */
export type PushEnvironmentKind = 'supported' | 'in-app-browser' | 'ios-needs-install' | 'unsupported';

export function getPushEnvironment(): PushEnvironmentKind {
  if (isPushSupported()) return 'supported';
  if (isInAppBrowser()) return 'in-app-browser';
  if (isIOS() && !isStandalone()) return 'ios-needs-install';
  return 'unsupported';
}

export function hasSubscribedToRoute(routeId: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(SUBSCRIBED_KEY) || '[]') as string[];
    return stored.includes(routeId);
  } catch {
    return false;
  }
}

function rememberSubscription(routeId: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem(SUBSCRIBED_KEY) || '[]') as string[];
    if (!stored.includes(routeId)) {
      stored.push(routeId);
      localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(stored.slice(-20)));
    }
  } catch {
    // Best-effort only — losing this just re-shows the button.
  }
}

/** null = push not configured on the server (hide the UI). */
export async function getServerPublicKey(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/push/public-key`);
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload?.publicKey === 'string' ? payload.publicKey : null;
  } catch {
    return null;
  }
}

/** Convert a base64url VAPID key to the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Ask permission, subscribe this browser, and register the subscription for
 * the route. Throws with a user-presentable message on failure.
 */
export async function subscribeToRunStart(routeId: string, publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked — allow them in your browser settings to get Santa alerts.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const response = await fetch(`${API_BASE_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeId, subscription: subscription.toJSON() }),
  });

  if (!response.ok) {
    throw new Error('Could not set up notifications. Please try again.');
  }

  rememberSubscription(routeId);
}
