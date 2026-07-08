/**
 * /api/push — Web Push subscriptions for "notify me when Santa starts".
 *
 * Public viewers are anonymous, so subscribe requires no auth — but it is
 * rate-limited, validates the subscription shape, and only accepts routes
 * that exist. The push itself is sent from the broadcast path (see
 * utils/push.ts) the first time a route starts broadcasting.
 */

import { Hono } from 'hono';
import { rateLimit } from '../utils/rateLimit.js';
import { getTableClient, isDevMode } from '../utils/storage.js';
import {
  getVapidPublicKey,
  isPushConfigured,
  saveSubscription,
  deleteSubscription,
} from '../utils/push.js';

const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function routeExists(routeId: string): Promise<boolean> {
  const client = await getTableClient(ROUTES_TABLE);
  const entities = client.listEntities({
    queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` },
  });
  for await (const _ of entities) {
    void _;
    return true;
  }
  return false;
}

export const pushRouter = new Hono();

// Subscriptions are one-tap per viewer; 10/min per IP blocks scripted floods.
pushRouter.use('/subscribe', rateLimit({ name: 'push-subscribe', limit: 10, windowMs: 60_000 }));
pushRouter.use('/unsubscribe', rateLimit({ name: 'push-subscribe', limit: 10, windowMs: 60_000 }));

/** Client feature-detects push support: 404 here hides the notify UI. */
pushRouter.get('/public-key', (c) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey || !isPushConfigured()) {
    return c.json({ error: 'Push notifications are not configured' }, 404);
  }
  return c.json({ publicKey });
});

pushRouter.post('/subscribe', async (c) => {
  try {
    if (!isPushConfigured()) {
      return c.json({ error: 'Push notifications are not configured' }, 404);
    }

    const body = await c.req.json() as {
      routeId?: string;
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };

    const routeId = body.routeId;
    const sub = body.subscription;
    if (!routeId || typeof routeId !== 'string' || routeId.length > 100) {
      return c.json({ error: 'Missing or invalid routeId' }, 400);
    }
    if (
      !sub ||
      typeof sub.endpoint !== 'string' ||
      !sub.endpoint.startsWith('https://') ||
      sub.endpoint.length > 1000 ||
      typeof sub.keys?.p256dh !== 'string' ||
      typeof sub.keys?.auth !== 'string' ||
      sub.keys.p256dh.length > 200 ||
      sub.keys.auth.length > 100
    ) {
      return c.json({ error: 'Invalid push subscription' }, 400);
    }

    if (!(await routeExists(routeId))) {
      return c.json({ error: 'Route not found' }, 404);
    }

    await saveSubscription(routeId, {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    });

    return c.json({ success: true }, 201);
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return c.json({ error: 'Failed to save subscription' }, 500);
  }
});

pushRouter.post('/unsubscribe', async (c) => {
  try {
    const body = await c.req.json() as { routeId?: string; endpoint?: string };
    if (!body.routeId || typeof body.routeId !== 'string' || typeof body.endpoint !== 'string') {
      return c.json({ error: 'Missing routeId or endpoint' }, 400);
    }
    await deleteSubscription(body.routeId, body.endpoint);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return c.json({ error: 'Failed to remove subscription' }, 500);
  }
});
