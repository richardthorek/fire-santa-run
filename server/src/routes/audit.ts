import { Hono } from 'hono';

const auditRouter = new Hono();

// Accept audit log batches from the client (production only).
// Logs are silently accepted; integration with Application Insights or
// a real audit table can be added here if needed later.
auditRouter.post('/batch', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const logs = Array.isArray(body?.logs) ? body.logs : [];

  if (logs.length === 0) {
    return c.json({ received: 0 }, 200);
  }

  // TODO: Send to Application Insights or Azure Table Storage for compliance.
  // For now, just acknowledge receipt so the client stops retrying.

  return c.json({ received: logs.length }, 200);
});

export { auditRouter };
