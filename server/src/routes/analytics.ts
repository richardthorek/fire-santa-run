/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';

const VIEWER_SESSIONS_TABLE = isDevMode ? 'devviewersessions' : 'viewersessions';
const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';

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

    // Get route details to verify it exists and get brigadeId
    let brigadeId = '';
    try {
      const routeEntity = await routesClient.getEntity('', routeId);
      brigadeId = (routeEntity as any).brigadeId || '';
    } catch (_error) {
      // If route not found, try to get sessions anyway but set empty brigadeId
      console.warn(`Route ${routeId} not found in routes table, continuing with analytics`);
    }

    // Get all viewer sessions for this route
    const sessions = viewerSessionsClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${routeId}'` }
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
 * GET /analytics/routes/:routeId/sessions
 * Get raw viewer sessions for a specific route (for admin debugging)
 */
analyticsRouter.get('/routes/:routeId/sessions', async (c) => {
  try {
    const routeId = c.req.param('routeId');
    if (!routeId) {
      return c.json({ error: 'Missing routeId parameter' }, 400);
    }

    const tableClient = await getTableClient(VIEWER_SESSIONS_TABLE);
    const sessions = tableClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${routeId}'` }
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
