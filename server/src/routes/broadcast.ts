/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { rateLimit, clientIp } from '../utils/rateLimit.js';
import { validateToken, checkBrigadeAccess, type AuthResult } from '../utils/auth.js';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { notifyRunStartOnce } from '../utils/push.js';
import { hub } from '../realtime/hub.js';
import { alertOps } from '../utils/opsAlert.js';
import { emitMetric } from '../utils/telemetryMetrics.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://firesantarun.com.au';
const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';

// A handful of 500s is normal noise (a bad request body, a transient storage
// blip); a burst is not — it's the signal something's actually wrong with
// the path that moves Santa. Counts unexpected failures only (the catch
// blocks below, not ordinary 400/403/404 validation responses).
const FAILURE_WINDOW_MS = 5 * 60_000;
const FAILURE_ALERT_THRESHOLD = 10;
let failureWindowStart = Date.now();
let failureCount = 0;

function recordBroadcastFailure(context: string): void {
  const now = Date.now();
  if (now - failureWindowStart >= FAILURE_WINDOW_MS) {
    failureWindowStart = now;
    failureCount = 0;
  }
  failureCount++;
  if (failureCount >= FAILURE_ALERT_THRESHOLD) {
    alertOps(
      'broadcast-failure-rate',
      'Elevated broadcast failure rate',
      `${failureCount} broadcast-related requests failed with a 500 in the last ${FAILURE_WINDOW_MS / 60_000} minutes (most recent: ${context}).`,
    );
  }
}

interface LocationBroadcast {
  routeId: string;
  location: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
  currentWaypointIndex?: number;
  nextWaypointEta?: string;
}

export const broadcastRouter = new Hono<{ Variables: { authResult: AuthResult } }>();

// Launch hardening (#345): cap broadcast volume per client. Navigation sends
// a location every 5s (12/min) and presence heartbeats every 15s (4/min);
// 40/min leaves ample headroom for retries without allowing flooding.
broadcastRouter.use('/broadcast', rateLimit({ name: 'broadcast', limit: 40, windowMs: 60_000 }));
broadcastRouter.use('/broadcast/*', rateLimit({ name: 'broadcast', limit: 40, windowMs: 60_000 }));

// Every broadcast pushes a message to a route group — Santa's location, editor
// presence, or the run status — so it must come from a signed-in brigade user.
// This only checks that the caller holds *some* valid Station Manager token;
// it does NOT check they belong to the brigade that owns the target route —
// see requireRouteOwner below, applied per-handler once the route id is known.
async function requireAuth(c: Context, next: Next) {
  const authResult = await validateToken(c.req.raw);
  if (!authResult.authenticated) {
    return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
  }
  c.set('authResult', authResult);
  await next();
}
broadcastRouter.use('/broadcast', requireAuth);
broadcastRouter.use('/broadcast/*', requireAuth);

/**
 * Security fix (post-launch audit, 2026-09): requireAuth above only proves the
 * caller is SOME signed-in Station Manager user — any account, in any
 * organisation, anywhere in the StationKit suite, free to create. Nothing
 * previously checked that they belonged to the brigade running this specific
 * route, so any suite account could inject a false Santa position into, or
 * abort, a brigade it had no relationship to. Call this from each handler
 * once the target routeId is known, mirroring negotiate.ts's broadcaster/
 * editor checks (same permissions, same entitlement gate).
 */
async function requireRouteOwner(
  c: Context<{ Variables: { authResult: AuthResult } }>,
  routeId: string,
  permission: 'start_navigation' | 'manage_routes',
): Promise<{ brigadeId: string } | Response> {
  const authResult = c.get('authResult');
  const brigadeId = authResult.organizationId;
  if (!brigadeId) {
    return c.json({ error: 'Route not found' }, 404);
  }
  // Point-read the route in the caller's own brigade partition rather than a
  // cross-partition RowKey scan: checkBrigadeAccess below already requires the
  // route's brigade to equal authResult.organizationId, so a route in any
  // other partition would be rejected anyway — and this runs on every location
  // broadcast (12/min per navigator).
  const client = await getTableClient(ROUTES_TABLE);
  try {
    await client.getEntity(brigadeId, routeId);
  } catch (err: any) {
    if (err?.statusCode === 404) {
      return c.json({ error: 'Route not found' }, 404);
    }
    throw err;
  }
  const permissionCheck = checkBrigadeAccess(authResult, brigadeId, permission);
  if (!permissionCheck.authorized) {
    return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
  }
  if (!authResult.santaRunEnabled) {
    return c.json({ error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' }, 402);
  }
  return { brigadeId };
}

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

    const ownerCheck = await requireRouteOwner(c, body.routeId, 'start_navigation');
    if (ownerCheck instanceof Response) return ownerCheck;

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

    // Attribution trail for the broadcast-hijack fix above: nothing else in
    // this codebase records who actually moved Santa on a given route, so a
    // falsified run couldn't previously be told apart from a bug after the
    // fact. Application-log only (no Table Storage write) — this must never
    // slow down or fail a location update.
    const authResult = c.get('authResult');
    console.log(
      `[broadcast] route=${body.routeId} brigade=${ownerCheck.brigadeId} user=${authResult.userId} ip=${clientIp(c)}`,
    );

    // First broadcast of a run wakes the "notify me" subscribers. Deliberately
    // not awaited — pushes must never slow down or fail location updates. Skip
    // it if the run has been called away: nobody should be told "Santa's
    // starting" moments after an emergency abort.
    if (hub.getRunStatus(body.routeId) !== 'aborted') {
      void notifyRunStartOnce(body.routeId, APP_BASE_URL);
    }

    return c.json({ success: true, routeId: body.routeId, timestamp: body.timestamp }, 200);
  } catch (error: any) {
    console.error('Error broadcasting location:', error);
    recordBroadcastFailure('POST /broadcast');
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

    const ownerCheck = await requireRouteOwner(c, body.routeId, 'manage_routes');
    if (ownerCheck instanceof Response) return ownerCheck;

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
    recordBroadcastFailure('POST /broadcast/editor-presence');
    return c.json({ error: 'Failed to broadcast editor presence', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

/**
 * Run status (#blind-spots): the navigator sets the live run state — paused
 * (temporary hold), aborted (truck called away to a real emergency), completed,
 * or active (resume). Cached in the hub and fanned out to viewers so tracking
 * pages react instantly and new joiners see the current state immediately.
 */
const VALID_RUN_STATUSES = ['active', 'paused', 'aborted', 'completed'] as const;
type RunStatusValue = (typeof VALID_RUN_STATUSES)[number];

broadcastRouter.post('/broadcast/status', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { routeId?: string; status?: string; message?: string };

    if (!body.routeId || typeof body.routeId !== 'string') {
      return c.json({ error: 'Missing required field: routeId' }, 400);
    }
    if (!body.status || !VALID_RUN_STATUSES.includes(body.status as RunStatusValue)) {
      return c.json({ error: `Invalid status. Must be one of: ${VALID_RUN_STATUSES.join(', ')}` }, 400);
    }

    const ownerCheck = await requireRouteOwner(c, body.routeId, 'start_navigation');
    if (ownerCheck instanceof Response) return ownerCheck;

    // Captured before setRunStatus overwrites it, so a true "go live" (no
    // prior status on this route) can be told apart from a resume-from-pause.
    const previousStatus = hub.getRunStatus(body.routeId);

    const message = {
      type: 'run-status' as const,
      routeId: body.routeId,
      status: body.status as RunStatusValue,
      // Trim any operator note to a safe length before it reaches public viewers.
      message: body.message ? String(body.message).slice(0, 160) : undefined,
      timestamp: Date.now(),
    };

    hub.setRunStatus(body.routeId, message);

    if (message.status === 'active' && previousStatus === undefined) {
      emitMetric('tracking_session_started', { routeId: body.routeId, brigadeId: ownerCheck.brigadeId });
    }

    return c.json({ success: true, routeId: body.routeId, status: message.status }, 200);
  } catch (error: any) {
    console.error('Error broadcasting run status:', error);
    recordBroadcastFailure('POST /broadcast/status');
    return c.json({ error: 'Failed to broadcast run status', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
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
