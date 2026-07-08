/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { rateLimit } from '../utils/rateLimit.js';
import { validateToken } from '../utils/auth.js';
import { notifyRunStartOnce } from '../utils/push.js';
import { hub } from '../realtime/hub.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://firesantarun.com.au';

interface LocationBroadcast {
  routeId: string;
  location: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
  currentWaypointIndex?: number;
  nextWaypointEta?: string;
}

export const broadcastRouter = new Hono();

// Launch hardening (#345): cap broadcast volume per client. Navigation sends
// a location every 5s (12/min) and presence heartbeats every 15s (4/min);
// 40/min leaves ample headroom for retries without allowing flooding.
broadcastRouter.use('/broadcast', rateLimit({ name: 'broadcast', limit: 40, windowMs: 60_000 }));
broadcastRouter.use('/broadcast/*', rateLimit({ name: 'broadcast', limit: 40, windowMs: 60_000 }));

// Every broadcast pushes a message to a route group — Santa's location, editor
// presence, or the viewer count. All must come from a signed-in brigade user so
// anonymous clients cannot inject fake positions to public viewers.
async function requireAuth(c: Context, next: Next) {
  const authResult = await validateToken(c.req.raw);
  if (!authResult.authenticated) {
    return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
  }
  await next();
}
broadcastRouter.use('/broadcast', requireAuth);
broadcastRouter.use('/broadcast/*', requireAuth);

broadcastRouter.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json() as Partial<LocationBroadcast>;

    if (!body.routeId) {
      return c.json({ error: 'Missing required field: routeId' }, 400);
    }

    if (!Array.isArray(body.location) || body.location.length !== 2) {
      return c.json({ error: 'Invalid location. Must be [longitude, latitude]' }, 400);
    }

    const [lng, lat] = body.location;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return c.json({ error: 'Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90' }, 400);
    }

    if (!body.timestamp) {
      return c.json({ error: 'Missing required field: timestamp' }, 400);
    }

    const message: LocationBroadcast = {
      routeId: body.routeId,
      location: body.location,
      timestamp: body.timestamp,
      heading: body.heading,
      speed: body.speed,
      currentWaypointIndex: body.currentWaypointIndex,
      nextWaypointEta: body.nextWaypointEta,
    };

    // Fan out in-process to every viewer's WebSocket (no managed Web PubSub,
    // no per-message billing).
    hub.broadcastLocation(body.routeId, message);

    // First broadcast of a run wakes the "notify me" subscribers. Deliberately
    // not awaited — pushes must never slow down or fail location updates.
    void notifyRunStartOnce(body.routeId, APP_BASE_URL);

    return c.json({ success: true, routeId: body.routeId, timestamp: body.timestamp }, 200);
  } catch (error: any) {
    console.error('Error broadcasting location:', error);
    return c.json({ error: 'Failed to broadcast location', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

/**
 * Editor presence (#151): relays "who is editing this route" heartbeats to
 * the edit_{routeId} group. Kept separate from the public tracking group so
 * editor identities never reach anonymous viewers.
 */
broadcastRouter.post('/broadcast/editor-presence', async (c) => {
  try {
    const body = await c.req.json() as {
      routeId?: string;
      userId?: string;
      userName?: string;
      action?: string;
    };

    if (!body.routeId || typeof body.routeId !== 'string') {
      return c.json({ error: 'Missing required field: routeId' }, 400);
    }
    if (!body.userId || typeof body.userId !== 'string') {
      return c.json({ error: 'Missing required field: userId' }, 400);
    }
    if (body.action !== 'editing' && body.action !== 'left') {
      return c.json({ error: 'Invalid action. Must be "editing" or "left"' }, 400);
    }

    const message = {
      type: 'editor-presence',
      routeId: body.routeId,
      userId: body.userId,
      userName: String(body.userName || 'A brigade member').slice(0, 80),
      action: body.action,
    };

    // Relay to the private editors set only (never to public viewers).
    hub.broadcastEditorPresence(body.routeId, message);
    return c.json({ success: true }, 200);
  } catch (error: any) {
    console.error('Error broadcasting editor presence:', error);
    return c.json({ error: 'Failed to broadcast editor presence', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

/**
 * Viewer count is now authoritative in the realtime hub (it knows exactly how
 * many sockets are connected per route) and pushed automatically on join/leave.
 * This endpoint is retained for backward compatibility and simply re-pushes the
 * live count; the client-provided value is ignored.
 */
broadcastRouter.post('/broadcast/viewer-count', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { routeId?: string };
    if (!body.routeId) {
      return c.json({ error: 'Missing required field: routeId' }, 400);
    }
    hub.pushViewerCount(body.routeId);
    return c.json({ success: true, routeId: body.routeId, count: hub.viewerCount(body.routeId) }, 200);
  } catch (error: any) {
    console.error('Error broadcasting viewer count:', error);
    return c.json({ error: 'Failed to broadcast viewer count', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
