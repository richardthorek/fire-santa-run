/**
 * /api/broadcast - Broadcast location updates to tracking viewers
 * 
 * This function receives location updates from the navigator device
 * and broadcasts them to all viewers watching the specific route.
 * 
 * Body Parameters:
 * - routeId (required): The route ID
 * - location (required): [lng, lat] coordinates
 * - timestamp (required): Unix timestamp
 * - heading (optional): Compass bearing (0-360)
 * - speed (optional): Speed in meters/second
 * - currentWaypointIndex (optional): Index of current/next waypoint
 * - nextWaypointEta (optional): ETA to next waypoint
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { checkRateLimit, clientIp } from './rateLimit';
import { validateToken, checkBrigadeAccess, type AuthResult } from './utils/auth';
import { getTableClient, isDevMode } from './utils/storage';
import { notifyRunStartOnce } from './utils/push';

const HUB_NAME = process.env.AZURE_WEBPUBSUB_HUB_NAME || 'santa_tracking';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://firesantarun.com.au';
const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

/** Resolve which brigade owns a route. Mirrors negotiate.ts's own copy. */
async function getRouteBrigadeId(routeId: string): Promise<string | null> {
  const client = await getTableClient(ROUTES_TABLE);
  const entities = client.listEntities({ queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` } });
  for await (const entity of entities) {
    return typeof entity.partitionKey === 'string' ? entity.partitionKey : null;
  }
  return null;
}

/**
 * Security fix (post-launch audit, 2026-09): the prior `validateToken()`-only
 * check proved the caller was SOME signed-in Station Manager user — any
 * account, any organisation, anywhere in the suite — but never that they
 * belonged to the brigade running this specific route. Mirrors
 * server/src/routes/broadcast.ts and negotiate.ts's broadcaster/editor checks.
 */
async function requireRouteOwner(
  authResult: AuthResult,
  routeId: string,
  permission: 'start_navigation' | 'manage_routes',
): Promise<{ brigadeId: string } | HttpResponseInit> {
  const brigadeId = await getRouteBrigadeId(routeId);
  if (!brigadeId) {
    return { status: 404, jsonBody: { error: 'Route not found' } };
  }
  const permissionCheck = checkBrigadeAccess(authResult, brigadeId, permission);
  if (!permissionCheck.authorized) {
    return { status: 403, jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' } };
  }
  if (!authResult.santaRunEnabled) {
    return { status: 402, jsonBody: { error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' } };
  }
  return { brigadeId };
}

function isHttpResponseInit(value: { brigadeId: string } | HttpResponseInit): value is HttpResponseInit {
  return !('brigadeId' in value);
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

export async function broadcast(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Launch hardening (#345): navigation sends a location every 5s (12/min)
    // plus presence heartbeats; 40/min blocks flooding with headroom to spare.
    const limited = checkRateLimit(request, 'broadcast', 40, 60_000);
    if (limited) return limited;

    // Broadcasting Santa's position pushes to every public viewer of the route,
    // so it must come from a signed-in brigade user, never an anonymous client.
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
    }

    // Parse request body
    const body = await request.json() as Partial<LocationBroadcast>;

    // Validate required fields
    if (!body.routeId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required field: routeId'
        }
      };
    }

    // Validate location coordinates
    if (!Array.isArray(body.location) || body.location.length !== 2) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid location. Must be [longitude, latitude]'
        }
      };
    }

    const [lng, lat] = body.location;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90'
        }
      };
    }

    if (!body.timestamp) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required field: timestamp'
        }
      };
    }

    const ownerCheck = await requireRouteOwner(authResult, body.routeId, 'start_navigation');
    if (isHttpResponseInit(ownerCheck)) return ownerCheck;

    // Get Web PubSub connection string from environment
    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    
    if (!connectionString) {
      context.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return {
        status: 500,
        jsonBody: {
          error: 'Web PubSub service is not configured'
        }
      };
    }

    // Create Web PubSub service client
    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);

    // Generate group name for route
    const groupName = `route_${body.routeId}`;

    // Prepare message payload
    const message: LocationBroadcast = {
      routeId: body.routeId,
      location: body.location,
      timestamp: body.timestamp,
      heading: body.heading,
      speed: body.speed,
      currentWaypointIndex: body.currentWaypointIndex,
      nextWaypointEta: body.nextWaypointEta,
    };

    // Get group client and broadcast to all group members
    const groupClient = serviceClient.group(groupName);
    await groupClient.sendToAll(message);

    // First broadcast of a run wakes the "notify me" subscribers. Deliberately
    // not awaited — pushes must never slow down or fail location updates.
    void notifyRunStartOnce(body.routeId, APP_BASE_URL);

    // Attribution trail for the broadcast-hijack fix above (see requireRouteOwner).
    context.log(
      `[broadcast] route=${body.routeId} brigade=${ownerCheck.brigadeId} user=${authResult.userId} ip=${clientIp(request)} group=${groupName}`,
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        routeId: body.routeId,
        groupName,
        timestamp: body.timestamp
      }
    };

  } catch (error) {
    context.error('Error broadcasting location:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to broadcast location',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Editor presence (#151): relays "who is editing this route" heartbeats to
 * the edit_{routeId} group. Kept separate from the public tracking group so
 * editor identities never reach anonymous viewers.
 */
export async function broadcastEditorPresence(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const limited = checkRateLimit(request, 'broadcast', 40, 60_000);
    if (limited) return limited;

    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
    }

    const body = await request.json() as {
      routeId?: string;
      userId?: string;
      userName?: string;
      action?: string;
    };

    if (!body.routeId || typeof body.routeId !== 'string') {
      return { status: 400, jsonBody: { error: 'Missing required field: routeId' } };
    }
    if (!body.userId || typeof body.userId !== 'string') {
      return { status: 400, jsonBody: { error: 'Missing required field: userId' } };
    }
    if (body.action !== 'editing' && body.action !== 'left') {
      return { status: 400, jsonBody: { error: 'Invalid action. Must be "editing" or "left"' } };
    }

    const ownerCheck = await requireRouteOwner(authResult, body.routeId, 'manage_routes');
    if (isHttpResponseInit(ownerCheck)) return ownerCheck;

    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    if (!connectionString) {
      context.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return { status: 500, jsonBody: { error: 'Web PubSub service is not configured' } };
    }

    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);
    const groupName = `edit_${body.routeId}`;

    const message = {
      type: 'editor-presence',
      routeId: body.routeId,
      userId: body.userId,
      userName: String(body.userName || 'A brigade member').slice(0, 80),
      action: body.action,
    };

    await serviceClient.group(groupName).sendToAll(message);
    return { status: 200, jsonBody: { success: true } };
  } catch (error) {
    context.error('Error broadcasting editor presence:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to broadcast editor presence',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Run status (#blind-spots): the navigator sets the live run state — paused,
 * aborted (called away), completed, or active (resume) — fanned out to the
 * route's viewer group. Local-dev parity with the production Hono endpoint.
 */
const VALID_RUN_STATUSES = ['active', 'paused', 'aborted', 'completed'];

export async function broadcastRunStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const limited = checkRateLimit(request, 'broadcast', 40, 60_000);
    if (limited) return limited;

    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
    }

    const body = await request.json() as { routeId?: string; status?: string; message?: string };

    if (!body.routeId || typeof body.routeId !== 'string') {
      return { status: 400, jsonBody: { error: 'Missing required field: routeId' } };
    }
    if (!body.status || !VALID_RUN_STATUSES.includes(body.status)) {
      return { status: 400, jsonBody: { error: `Invalid status. Must be one of: ${VALID_RUN_STATUSES.join(', ')}` } };
    }

    const ownerCheck = await requireRouteOwner(authResult, body.routeId, 'start_navigation');
    if (isHttpResponseInit(ownerCheck)) return ownerCheck;

    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    if (!connectionString) {
      context.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return { status: 500, jsonBody: { error: 'Web PubSub service is not configured' } };
    }

    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);
    const message = {
      type: 'run-status',
      routeId: body.routeId,
      status: body.status,
      message: body.message ? String(body.message).slice(0, 160) : undefined,
      timestamp: Date.now(),
    };

    await serviceClient.group(`route_${body.routeId}`).sendToAll(message);
    return { status: 200, jsonBody: { success: true, routeId: body.routeId, status: body.status } };
  } catch (error) {
    context.error('Error broadcasting run status:', error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to broadcast run status', message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

app.http('broadcast', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: broadcast
});

app.http('broadcast-run-status', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'broadcast/status',
  handler: broadcastRunStatus
});

app.http('broadcast-editor-presence', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'broadcast/editor-presence',
  handler: broadcastEditorPresence
});
