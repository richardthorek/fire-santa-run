/// <reference lib="WebWorker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

/**
 * Normalise a Mapbox tile URL by removing the rotating `sku` query parameter.
 * Mapbox appends `sku` for billing attribution; stripping it ensures the same
 * tile always resolves to the same cache entry across requests.
 * Used by both the CacheFirst cache-key plugin and the PRECACHE_TILES handler.
 */
function stripMapboxSku(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('sku');
  return parsed.toString();
}

/**
 * Workbox cache-key plugin that strips the `sku` query parameter from Mapbox
 * tile URLs before they are used as cache keys.
 */
const stripMapboxSkuPlugin = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }): Promise<string> =>
    stripMapboxSku(request.url),
};

// Precache app shell (manifest injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Background sync plugin for location updates (queues failed POST requests)
const locationSyncPlugin = new BackgroundSyncPlugin('location-updates-queue', {
  maxRetentionTime: 24 * 60, // Retain for 24 hours (in minutes)
});

// Background sync plugin for location broadcasts - shorter retention as stale data is less useful
const broadcastSyncPlugin = new BackgroundSyncPlugin('location-broadcast-queue', {
  maxRetentionTime: 2 * 60, // Retain for 2 hours (in minutes)
});

// Location broadcast route - NetworkOnly with BackgroundSync (queue when offline, retry when online)
registerRoute(
  ({ url, request }) =>
    (url.pathname === '/api/broadcast' || url.pathname.endsWith('/api/broadcast')) &&
    request.method === 'POST',
  new NetworkOnly({
    plugins: [broadcastSyncPlugin],
  }),
  'POST'
);

// Location update routes - Network First with Background Sync fallback
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/location') && request.method === 'POST',
  new NetworkFirst({
    cacheName: 'api-location-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      locationSyncPlugin,
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
    ],
  }),
  'POST'
);

// Mapbox map tiles and API - Cache First for offline navigation
// Tiles are large but expire after 30 days; 1000 entries supports a typical
// Santa run route across multiple zoom levels and surrounding streets.
// The stripMapboxSkuPlugin normalises cache keys by removing the rotating
// `sku` parameter so pre-cached tiles are always matched on subsequent loads.
registerRoute(
  ({ url }) => url.origin === 'https://api.mapbox.com',
  new CacheFirst({
    cacheName: 'mapbox-tiles',
    plugins: [
      stripMapboxSkuPlugin,
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 1000,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// General API routes - Network First with cache fallback.
// Same-origin only: cross-origin services that happen to use an `/api/` path
// (Station Manager's auth endpoints on stationkit.com.au) must not be routed
// through this cache — their availability should only affect auth, and a
// cached session response could be served stale.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
    ],
  })
);

// Static assets (JS, CSS, workers) - Cache First
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Images - Cache First
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Google Fonts - Cache First (long TTL)
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);

// SPA navigation - serve index.html for all navigation requests
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  // Exclude API routes and static assets from navigation handling
  denylist: [/^\/api\//, /\.[a-z]+$/i],
});
registerRoute(navigationRoute);

// Offline fallback for failed requests
// /offline.html is included in the precache manifest (via globPatterns: '**/*.html'),
// so matchPrecache resolves the versioned cache entry correctly.
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const cached = await matchPrecache('/offline.html');
    return cached ?? Response.error();
  }
  return Response.error();
});

// Handle skip-waiting messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'PRECACHE_TILES') {
    // Pre-cache a list of tile URLs sent from the app. Tiles are stored in
    // the same `mapbox-tiles` Cache Storage entry used by the CacheFirst
    // strategy so they are served offline without any additional plumbing.
    const { urls } = event.data as { urls: string[] };
    if (!Array.isArray(urls) || urls.length === 0) return;

    event.waitUntil(
      (async () => {
        const cache = await caches.open('mapbox-tiles');
        for (const rawUrl of urls) {
          try {
            const cacheKey = stripMapboxSku(rawUrl);

            // Skip tiles that are already cached
            const existing = await cache.match(cacheKey);
            if (existing) continue;

            const response = await fetch(rawUrl, { credentials: 'omit' });
            // Cache transparent OK responses and opaque no-cors responses.
            // Opaque responses (response.type === 'opaque') always have ok=false,
            // so check type first.
            if (response.type === 'opaque' || response.ok) {
              await cache.put(cacheKey, response);
            }
          } catch {
            // Individual tile failures are silent; the app tracks progress
          }
        }
      })()
    );
  }
});

// ── Web Push: "notify me when Santa starts" ────────────────────────────────
// The server sends one push per route when its first location broadcast
// arrives (see server/src/utils/push.ts). Payload: { title, body, url }.

self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // Non-JSON payload — fall back to defaults below.
  }

  const title = payload.title || '🎅 Santa is on the way!';
  const options: NotificationOptions = {
    body: payload.body || 'Your Santa run has started — tap to watch live.',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      // Focus an existing tracking tab if one is open, otherwise open one.
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes('/track/') && 'focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
