/**
 * Health & readiness endpoints for launch-night monitoring (#340).
 *
 * - GET /api/health — liveness. Cheap, no external calls. Point Azure Monitor
 *   availability tests here.
 * - GET /api/ready  — readiness. Probes dependencies (storage reachability,
 *   Web PubSub configuration). Returns 503 when a critical dependency is down.
 */

import { Hono } from 'hono';
import { pingStorage } from '../utils/storage.js';

const startedAt = Date.now();

// App version, surfaced for correlating deploys with incidents.
const VERSION = process.env.APP_VERSION ?? process.env.WEBSITE_DEPLOYMENT_ID ?? 'dev';

export const healthRouter = new Hono();

// Liveness — must stay cheap (no network calls).
healthRouter.get('/health', (c) =>
  c.json({
    status: 'ok',
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }),
);

// Readiness — checks the dependencies needed to serve real traffic.
healthRouter.get('/ready', async (c) => {
  const storage = await pingStorage();
  const webPubSub = { configured: !!process.env.AZURE_WEBPUBSUB_CONNECTION_STRING };

  // Storage is critical; Web PubSub being unconfigured only disables live
  // broadcasting, so it does not flip readiness to false on its own.
  const ready = storage.ok;

  return c.json(
    {
      status: ready ? 'ready' : 'not_ready',
      checks: { storage, webPubSub },
      version: VERSION,
      timestamp: new Date().toISOString(),
    },
    ready ? 200 : 503,
  );
});
