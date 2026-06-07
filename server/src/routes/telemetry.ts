/**
 * Client telemetry ingestion (#340).
 *
 * Receives client-side error reports (from the ErrorBoundary / global handlers)
 * and writes them to the server log, where App Service / Application Insights
 * captures them. Intentionally minimal and best-effort: validates shape, caps
 * payload size, and never fails the caller in a way worth retrying.
 */

import { Hono } from 'hono';

export const telemetryRouter = new Hono();

interface ClientErrorPayload {
  message?: unknown;
  source?: unknown;
  stack?: unknown;
  url?: unknown;
  userAgent?: unknown;
}

const MAX_FIELD_LENGTH = 4000;

function clip(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, MAX_FIELD_LENGTH);
}

telemetryRouter.post('/client-errors', async (c) => {
  let body: ClientErrorPayload;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ status: 'ignored', reason: 'invalid json' }, 400);
  }

  const record = {
    message: clip(body.message) ?? '(no message)',
    source: clip(body.source) ?? 'unknown',
    stack: clip(body.stack),
    url: clip(body.url),
    userAgent: clip(body.userAgent) ?? c.req.header('user-agent'),
    receivedAt: new Date().toISOString(),
  };

  // Structured single-line log so it is greppable in App Service / App Insights.
  console.error(`[client-error] ${JSON.stringify(record)}`);

  return c.json({ status: 'received' }, 202);
});
