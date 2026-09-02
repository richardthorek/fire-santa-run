import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { validateServerEnv } from './utils/configValidation.js';
import { attachRealtime } from './realtime/wsServer.js';
import { initAppInsights } from './utils/appInsights.js';

// Fail fast on invalid configuration before accepting any traffic.
validateServerEnv();

// Before anything else logs: if APPLICATIONINSIGHTS_CONNECTION_STRING is
// configured, pipe console output (including the METRIC lines emitted by
// telemetryMetrics.ts) into Application Insights. No-op when unset.
initAppInsights();

// Path to the built React SPA, relative to process.cwd() (the deployment root).
// Start the server from the repository root so that './dist' resolves to the
// Vite build output.  Override with STATIC_FILES_PATH when needed.
const staticRoot = process.env.STATIC_FILES_PATH ?? './dist';

const port = parseInt(process.env.PORT ?? '8080', 10);

const app = createApp();

// Serve static frontend assets — registered after API routes to avoid shadowing /api/*.
// Vite emits content-hashed filenames under /assets, so they are immutable:
// long-lived caching means each browser downloads a chunk once, which matters
// on the F1/B1 App Service plans where every byte is served by this process.
app.use(
  '/assets/*',
  serveStatic({
    root: staticRoot,
    onFound: (_path, c) => {
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);
app.use('/favicon.ico', serveStatic({ root: staticRoot, path: '/favicon.ico' }));

// Service worker, manifest, and service worker registration script must
// revalidate so app updates roll out. Explicitly route these before the
// catch-all SPA fallback so they are not rewritten to index.html.
app.use(
  '/sw.js',
  serveStatic({
    root: staticRoot,
    path: '/sw.js',
    onFound: (_path, c) => {
      c.header('Cache-Control', 'no-cache');
    },
  }),
);
app.use(
  '/manifest.json',
  serveStatic({
    root: staticRoot,
    path: '/manifest.json',
    onFound: (_path, c) => {
      c.header('Cache-Control', 'no-cache');
    },
  }),
);
app.use(
  '/registerSW.js',
  serveStatic({
    root: staticRoot,
    path: '/registerSW.js',
    onFound: (_path, c) => {
      c.header('Cache-Control', 'no-cache');
    },
  }),
);

// Serve every other real file emitted at the root of the build: the PWA icons
// (icon.svg, icon-*.png, icon-maskable-*), apple-touch-icon, splash screens,
// og-image.svg, offline.html, landing-static.html/landing-signin.js. Without
// this, requests for those paths fell through to the SPA fallback below and
// returned index.html as text/html — which is why the home-page logo and the
// manifest's 144px icon failed to load in production. serveStatic calls
// next() when no file matches, so unknown paths still reach the SPA fallback.
app.use(
  '*',
  serveStatic({
    root: staticRoot,
    onFound: (path, c) => {
      // Root-level assets are not content-hashed (unlike /assets/*) and can
      // change between deploys, so they must revalidate rather than be cached
      // immutably; index.html must never be cached (it names the hashed chunks).
      c.header('Cache-Control', path.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
    },
  }),
);

// SPA fallback: all remaining GETs that are not API calls return index.html so
// that client-side routing (React Router) works on direct URL loads. index.html
// must never be cached — it references the current hashed asset names.
app.get(
  '*',
  serveStatic({
    root: staticRoot,
    rewriteRequestPath: () => '/index.html',
    onFound: (_path, c) => {
      c.header('Cache-Control', 'no-cache');
    },
  }),
);

console.log(`\u{1F385} Fire Santa Run server starting on port ${port}`);
console.log(`   Static files : ${staticRoot}`);
console.log(`   Dev mode     : ${process.env.DEV_MODE === 'true'}`);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\u2705 Server listening on http://localhost:${info.port}`);
}) as Server;

// Attach the native realtime WebSocket endpoint (/api/ws) to the same HTTP
// server. This replaces Azure Web PubSub: fan-out happens in-process, with no
// per-connection or per-message managed-service cost.
attachRealtime(server);
