/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken, checkBrigadeAccess } from '../utils/auth.js';
import { hub } from '../realtime/hub.js';
import { emitMetric } from '../utils/telemetryMetrics.js';

// Two bugs found here during the 2026-09 api/ removal:
// 1. This file's dev table names didn't match the rest of server/src/, so in
//    dev mode it silently read/wrote a different, always-empty pair of
//    tables — harmless in production (isDevMode is false there), but it
//    meant the brigade-ownership check just added to GET /sessions could
//    never find the route locally, and analytics/viewer-count read nothing.
// 2. Fixing #1 to match the rest of server/src/ surfaced a second, deeper
//    bug shared by every 'dev-'-prefixed table name in the codebase: Azure
//    Table Storage table names may contain only letters and digits (no
//    hyphens), so 'dev-routes' etc. always threw InvalidResourceName once
//    actually queried. This had never been exercised before — server/ had
//    never been booted against real/emulated Table Storage in dev mode
//    until now. Fixed everywhere to the unhyphenated form ('devroutes',
//    'devbrigades', 'devviewersessions', 'devusers', 'devpushsubscriptions').
const VIEWER_SESSIONS_TABLE = isDevMode ? 'devviewersessions' : 'viewersessions';
const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';

/** Escape single quotes in OData filter values to prevent injection. */
function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

interface ViewerSession {
  id: string;
  routeId: string;
  sessionId: string;
  joinedAt: string;
  leftAt?: string;
  viewDuration?: number;
  userAgent?: string;
  ipAddress?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    coordinates?: [number, number];
  };
  shareSource?: string;
}

interface RouteAnalytics {
  routeId: string;
  brigadeId: string;
  totalViews: number;
  uniqueViewers: number;
  peakConcurrentViewers: number;
  averageViewDuration: number;
  totalViewDuration: number;
  viewersBySource: Record<string, number>;
  viewersByLocation: Array<{
    city?: string;
    region?: string;
    country: string;
    count: number;
    coordinates?: [number, number];
  }>;
  viewsOverTime: Array<{
    timestamp: string;
    count: number;
  }>;
  lastUpdated: string;
}

export const analyticsRouter = new Hono();

/**
 * POST /analytics/viewer-session
 * Log a viewer session (join/leave event)
 */
analyticsRouter.post('/viewer-session', async (c) => {
  try {
    const body = await c.req.json() as Partial<ViewerSession>;

    if (!body.routeId || !body.sessionId) {
      return c.json({ error: 'Missing required fields: routeId, sessionId' }, 400);
    }

    const tableClient = await getTableClient(VIEWER_SESSIONS_TABLE);

    const sessionId = body.sessionId;
    const entity = {
      partitionKey: body.routeId,
      rowKey: sessionId,
      routeId: body.routeId,
      sessionId: body.sessionId,
      joinedAt: body.joinedAt || new Date().toISOString(),
      leftAt: body.leftAt,
      viewDuration: body.viewDuration,
      userAgent: body.userAgent,
      ipAddress: body.ipAddress,
      location: body.location ? JSON.stringify(body.location) : undefined,
      shareSource: body.shareSource,
    };

    await tableClient.upsertEntity(entity);

    // Only the join half of this endpoint's join/leave upsert is a distinct
    // usage event — a leave update (leftAt set) re-upserts the same session.
    if (!body.leftAt) {
      emitMetric('tracking_viewer_joined', { routeId: body.routeId });
    }

    return c.json({ success: true, sessionId }, 201);
  } catch (error: any) {
    console.error('Error logging viewer session:', error);
    return c.json({
      error: 'Failed to log viewer session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /analytics/routes/:routeId
 * Get analytics for a specific route
 */
analyticsRouter.get('/routes/:routeId', async (c) => {
  try {
    const routeId = c.req.param('routeId');
    if (!routeId) {
      return c.json({ error: 'Missing routeId parameter' }, 400);
    }

    const viewerSessionsClient = await getTableClient(VIEWER_SESSIONS_TABLE);
    const routesClient = await getTableClient(ROUTES_TABLE);

    // Get route details to verify it exists and get brigadeId.
    // Routes use brigadeId as partitionKey, so scan by rowKey to find it.
    let brigadeId = '';
    try {
      const routeEntities = routesClient.listEntities({
        queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` }
      });
      for await (const entity of routeEntities) {
        brigadeId = typeof entity.partitionKey === 'string' ? entity.partitionKey : '';
        break;
      }
    } catch (_error) {
      // If lookup fails, continue with empty brigadeId
      console.warn(`Could not determine brigadeId for route ${routeId}, continuing with analytics`);
    }

    // Get all viewer sessions for this route
    const sessions = viewerSessionsClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(routeId)}'` }
    });

    const sessionList: ViewerSession[] = [];
    for await (const session of sessions) {
      sessionList.push({
        id: session.rowKey as string,
        routeId: session.routeId as string,
        sessionId: session.sessionId as string,
        joinedAt: session.joinedAt as string,
        leftAt: session.leftAt as string | undefined,
        viewDuration: session.viewDuration as number | undefined,
        userAgent: session.userAgent as string | undefined,
        ipAddress: session.ipAddress as string | undefined,
        location: session.location ? JSON.parse(session.location as string) : undefined,
        shareSource: session.shareSource as string | undefined,
      });
    }

    // Calculate analytics
    const totalViews = sessionList.length;
    const uniqueViewers = new Set(sessionList.map(s => s.sessionId)).size;

    // Calculate view durations
    const durationsInSeconds = sessionList
      .filter(s => s.viewDuration !== undefined && s.viewDuration > 0)
      .map(s => s.viewDuration!);

    const totalViewDuration = durationsInSeconds.reduce((sum, d) => sum + d, 0);
    const averageViewDuration = durationsInSeconds.length > 0
      ? totalViewDuration / durationsInSeconds.length
      : 0;

    // Calculate peak concurrent viewers
    const events: Array<{ timestamp: number; delta: number }> = [];
    sessionList.forEach(session => {
      const joinTime = new Date(session.joinedAt).getTime();
      events.push({ timestamp: joinTime, delta: 1 });

      if (session.leftAt) {
        const leaveTime = new Date(session.leftAt).getTime();
        events.push({ timestamp: leaveTime, delta: -1 });
      }
    });

    events.sort((a, b) => a.timestamp - b.timestamp);
    let currentViewers = 0;
    let peakConcurrentViewers = 0;
    events.forEach(event => {
      currentViewers += event.delta;
      peakConcurrentViewers = Math.max(peakConcurrentViewers, currentViewers);
    });

    // Calculate viewers by source
    const viewersBySource: Record<string, number> = {};
    sessionList.forEach(session => {
      const source = session.shareSource || 'direct';
      viewersBySource[source] = (viewersBySource[source] || 0) + 1;
    });

    // Calculate viewers by location
    const locationCounts: Map<string, {
      city?: string;
      region?: string;
      country: string;
      count: number;
      coordinates?: [number, number];
    }> = new Map();

    sessionList.forEach(session => {
      if (session.location?.country) {
        const key = `${session.location.country}-${session.location.region || ''}-${session.location.city || ''}`;
        const existing = locationCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          locationCounts.set(key, {
            city: session.location.city,
            region: session.location.region,
            country: session.location.country,
            coordinates: session.location.coordinates,
            count: 1,
          });
        }
      }
    });

    const viewersByLocation = Array.from(locationCounts.values());

    // Calculate views over time (grouped by hour)
    const viewsByHour: Map<string, number> = new Map();
    sessionList.forEach(session => {
      const hourKey = new Date(session.joinedAt).toISOString().substring(0, 13) + ':00:00.000Z';
      viewsByHour.set(hourKey, (viewsByHour.get(hourKey) || 0) + 1);
    });

    const viewsOverTime = Array.from(viewsByHour.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const analytics: RouteAnalytics = {
      routeId,
      brigadeId,
      totalViews,
      uniqueViewers,
      peakConcurrentViewers,
      averageViewDuration,
      totalViewDuration,
      viewersBySource,
      viewersByLocation,
      viewsOverTime,
      lastUpdated: new Date().toISOString(),
    };

    emitMetric('route_analytics_viewed', { routeId, brigadeId });
    return c.json(analytics, 200);
  } catch (error: any) {
    console.error('Error fetching route analytics:', error);
    return c.json({
      error: 'Failed to fetch route analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /analytics/routes/:routeId/viewer-count
 * Get current live viewer count for a specific route
 */
// Viewer counts are polled by every open tracking page, so an uncached
// implementation costs one table scan per viewer per poll — a quota killer on
// small App Service plans during a busy run. A short in-memory TTL cache
// collapses that to at most one scan per route per window, no matter how many
// people are watching.
const VIEWER_COUNT_TTL_MS = 15 * 1000;
const viewerCountCache = new Map<string, { count: number; expires: number }>();

analyticsRouter.get('/routes/:routeId/viewer-count', async (c) => {
  try {
    const routeId = c.req.param('routeId');
    if (!routeId) {
      return c.json({ error: 'Missing routeId parameter' }, 400);
    }

    // The realtime hub knows exactly how many sockets are connected right now —
    // authoritative and free. Prefer it; fall back to the analytics-session
    // estimate only when this process holds no live sockets for the route.
    const liveCount = hub.viewerCount(routeId);
    if (liveCount > 0) {
      return c.json({ routeId, count: liveCount, timestamp: new Date().toISOString() }, 200);
    }

    const cached = viewerCountCache.get(routeId);
    if (cached && cached.expires > Date.now()) {
      return c.json({
        routeId,
        count: cached.count,
        timestamp: new Date().toISOString()
      }, 200);
    }

    const tableClient = await getTableClient(VIEWER_SESSIONS_TABLE);
    const sessions = tableClient.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${escapeODataValue(routeId)}'`,
        select: ['joinedAt', 'leftAt']
      }
    });

    // Count sessions that have joined but not left yet (active viewers)
    let activeCount = 0;
    const now = Date.now();
    const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

    for await (const session of sessions) {
      const leftAt = session.leftAt as string | undefined;
      const joinedAt = session.joinedAt as string;

      // If no leftAt, check if session is still recent (within timeout)
      if (!leftAt) {
        const joinedTime = new Date(joinedAt).getTime();
        if (now - joinedTime < SESSION_TIMEOUT_MS) {
          activeCount++;
        }
      }
    }

    viewerCountCache.set(routeId, { count: activeCount, expires: Date.now() + VIEWER_COUNT_TTL_MS });

    return c.json({
      routeId,
      count: activeCount,
      timestamp: new Date().toISOString()
    }, 200);
  } catch (error: any) {
    console.error('Error fetching viewer count:', error);
    return c.json({
      error: 'Failed to fetch viewer count',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /analytics/routes/:routeId/sessions
 * Get raw viewer sessions for a specific route (for admin debugging)
 *
 * Security fix (post-launch audit, 2026-09): this returned every viewer's raw
 * IP address and user agent with NO auth check at all — reachable by anyone
 * holding the route's public tracking link (not a secret; it's the QR code on
 * the brigade's own flyer). Now brigade-scoped, same bar as editing the route.
 */
analyticsRouter.get('/routes/:routeId/sessions', async (c) => {
  try {
    const routeId = c.req.param('routeId');
    if (!routeId) {
      return c.json({ error: 'Missing routeId parameter' }, 400);
    }

    // Authenticate before touching storage: this endpoint used to run a
    // cross-partition RowKey scan of the routes table (the broadcast hot
    // path's account) before any auth check, so an unauthenticated caller
    // could force one scan per request with rotating fake routeIds. Now the
    // token is validated first, and the route is resolved by a point read in
    // the caller's own brigade partition — a route in another brigade (or a
    // fake id) is a 404 either way, no scan, no brigade enumeration.
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }
    const brigadeId = authResult.organizationId;
    if (!brigadeId) {
      return c.json({ error: 'Route not found' }, 404);
    }

    const routesClient = await getTableClient(ROUTES_TABLE);
    try {
      await routesClient.getEntity(brigadeId, routeId);
    } catch (routeError: any) {
      if (routeError?.statusCode === 404) {
        return c.json({ error: 'Route not found' }, 404);
      }
      throw routeError;
    }

    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'manage_routes');
    if (!permissionCheck.authorized) {
      return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    }

    const tableClient = await getTableClient(VIEWER_SESSIONS_TABLE);
    const sessions = tableClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(routeId)}'` }
    });

    const sessionList: ViewerSession[] = [];
    for await (const session of sessions) {
      sessionList.push({
        id: session.rowKey as string,
        routeId: session.routeId as string,
        sessionId: session.sessionId as string,
        joinedAt: session.joinedAt as string,
        leftAt: session.leftAt as string | undefined,
        viewDuration: session.viewDuration as number | undefined,
        userAgent: session.userAgent as string | undefined,
        ipAddress: session.ipAddress as string | undefined,
        location: session.location ? JSON.parse(session.location as string) : undefined,
        shareSource: session.shareSource as string | undefined,
      });
    }

    return c.json({ sessions: sessionList, count: sessionList.length }, 200);
  } catch (error: any) {
    console.error('Error fetching viewer sessions:', error);
    return c.json({
      error: 'Failed to fetch viewer sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
