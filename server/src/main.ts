import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { validateServerEnv } from './utils/configValidation.js';

// Fail fast on invalid configuration before accepting any traffic.
validateServerEnv();

// Path to the built React SPA, relative to process.cwd() (the deployment root).
// Start the server from the repository root so that './dist' resolves to the
// Vite build output.  Override with STATIC_FILES_PATH when needed.
const staticRoot = process.env.STATIC_FILES_PATH ?? './dist';

const port = parseInt(process.env.PORT ?? '8080', 10);

const app = createApp();

// Serve static frontend assets — registered after API routes to avoid shadowing /api/*.
app.use('/assets/*', serveStatic({ root: staticRoot }));
app.use('/favicon.ico', serveStatic({ root: staticRoot, path: '/favicon.ico' }));

// SPA fallback: all remaining GETs that are not API calls return index.html so
// that client-side routing (React Router) works on direct URL loads.
app.get('*', serveStatic({ root: staticRoot, rewriteRequestPath: () => '/index.html' }));

console.log(`\u{1F385} Fire Santa Run server starting on port ${port}`);
console.log(`   Static files : ${staticRoot}`);
console.log(`   Dev mode     : ${process.env.DEV_MODE === 'true'}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\u2705 Server listening on http://localhost:${info.port}`);
});
