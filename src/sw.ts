/// <reference lib="WebWorker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

/**
 * Workbox cache-key plugin that strips the `sku` query parameter from Mapbox
 * tile URLs before they are used as cache keys. Mapbox appends a rotating
 * `sku` value for billing attribution; stripping it ensures that the same
 * map tile is always resolved to the same cache entry regardless of the
 * random `sku` suffix present in the original request URL.
 */
const stripMapboxSkuPlugin = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }): Promise<string> => {
    const url = new URL(request.url);
    url.searchParams.delete('sku');
    return url.toString();
  },
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

// General API routes - Network First with cache fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
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
            const url = new URL(rawUrl);
            url.searchParams.delete('sku');
            const cacheKey = url.toString();

            // Skip tiles that are already cached
            const existing = await cache.match(cacheKey);
            if (existing) continue;

            const response = await fetch(rawUrl, { credentials: 'omit' });
            if (response.ok || response.type === 'opaque') {
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
