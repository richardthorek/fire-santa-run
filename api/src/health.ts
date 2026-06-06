/**
 * Health & readiness endpoints (#340) — Azure Functions parity with the Hono
 * server's /api/health and /api/ready.
 *
 * - health: liveness, cheap, no external calls.
 * - ready:  readiness, probes Azure Table Storage reachability.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableServiceClient } from '@azure/data-tables';
import { STORAGE_CONNECTION_STRING } from './utils/storage';

const startedAt = Date.now();
const VERSION = process.env.APP_VERSION ?? process.env.WEBSITE_DEPLOYMENT_ID ?? 'dev';

export async function health(): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: 'ok',
      version: VERSION,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
  };
}

async function pingStorage(): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  if (!STORAGE_CONNECTION_STRING) {
    return { configured: false, ok: false, error: 'connection string not configured' };
  }
  try {
    const serviceClient = TableServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
    await serviceClient.listTables().byPage({ maxPageSize: 1 }).next();
    return { configured: true, ok: true };
  } catch (error) {
    return { configured: true, ok: false, error: (error as Error).message };
  }
}

export async function ready(
  _request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const storage = await pingStorage();
  const webPubSub = { configured: !!process.env.AZURE_WEBPUBSUB_CONNECTION_STRING };
  const isReady = storage.ok;

  return {
    status: isReady ? 200 : 503,
    jsonBody: {
      status: isReady ? 'ready' : 'not_ready',
      checks: { storage, webPubSub },
      version: VERSION,
      timestamp: new Date().toISOString(),
    },
  };
}

app.http('health', { methods: ['GET'], authLevel: 'anonymous', handler: health });
app.http('ready', { methods: ['GET'], authLevel: 'anonymous', handler: ready });
