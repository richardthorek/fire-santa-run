/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { validateToken, checkBrigadeAccess } from '../utils/auth.js';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { PUBLIC_ROUTE_STATUSES } from '../utils/routeVisibility.js';
import { guardTextContent } from '../utils/moderation.js';
import { emitMetric } from '../utils/telemetryMetrics.js';

const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

function entityToRoute(entity: any) {
  return {
    id: entity.rowKey,
    brigadeId: entity.partitionKey,
    name: entity.name,
    description: entity.description,
    date: entity.date,
    startTime: entity.startTime,
    endTime: entity.endTime,
    status: entity.status,
    waypoints: entity.waypoints ? JSON.parse(entity.waypoints) : [],
    geometry: entity.geometry ? JSON.parse(entity.geometry) : undefined,
    navigationSteps: entity.navigationSteps ? JSON.parse(entity.navigationSteps) : undefined,
    distance: entity.distance,
    estimatedDuration: entity.estimatedDuration,
    actualDuration: entity.actualDuration,
    createdAt: entity.createdAt,
    createdBy: entity.createdBy,
    publishedAt: entity.publishedAt,
    startedAt: entity.startedAt,
    completedAt: entity.completedAt,
    shareableLink: entity.shareableLink,
    qrCodeUrl: entity.qrCodeUrl,
    viewCount: entity.viewCount || 0,
    archivedAt: entity.archivedAt || undefined,
    navigationSettings: entity.navigationSettings ? JSON.parse(entity.navigationSettings) : undefined,
    rerouteCount: entity.rerouteCount || 0,
    updatedAt: entity.updatedAt || undefined,
    lastEditedBy: entity.lastEditedBy ? JSON.parse(entity.lastEditedBy) : undefined,
    comments: entity.comments ? JSON.parse(entity.comments) : undefined,
  };
}

function routeToEntity(route: any) {
  return {
    partitionKey: route.brigadeId,
    rowKey: route.id,
    name: route.name,
    description: route.description || '',
    date: route.date,
    startTime: route.startTime,
    endTime: route.endTime || '',
    status: route.status,
    waypoints: JSON.stringify(route.waypoints || []),
    geometry: route.geometry ? JSON.stringify(route.geometry) : '',
    navigationSteps: route.navigationSteps ? JSON.stringify(route.navigationSteps) : '',
    distance: route.distance || 0,
    estimatedDuration: route.estimatedDuration || 0,
    actualDuration: route.actualDuration || 0,
    createdAt: route.createdAt || new Date().toISOString(),
    createdBy: route.createdBy || '',
    publishedAt: route.publishedAt || '',
    startedAt: route.startedAt || '',
    completedAt: route.completedAt || '',
    shareableLink: route.shareableLink || '',
    qrCodeUrl: route.qrCodeUrl || '',
    viewCount: route.viewCount || 0,
    archivedAt: route.archivedAt || '',
    navigationSettings: route.navigationSettings ? JSON.stringify(route.navigationSettings) : '',
    rerouteCount: route.rerouteCount || 0,
    updatedAt: route.updatedAt || '',
    lastEditedBy: route.lastEditedBy ? JSON.stringify(route.lastEditedBy) : '',
    comments: route.comments ? JSON.stringify(route.comments) : '',
  };
}

export const routesRouter = new Hono();

// Payload bounds (Tier 1b hardening, post-launch audit 2026-09): POST/PUT
// previously accepted name/description/comments/waypoints with no length or
// shape checks at all, unlike broadcast.ts (lat/lng bounds) and push.ts
// (field length caps) elsewhere in this codebase. Mirrors those patterns.
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_WAYPOINTS = 200;
const MAX_COMMENTS = 500;
const MAX_COMMENT_TEXT_LENGTH = 1000;
const MAX_USERNAME_LENGTH = 80;
const VALID_ROUTE_STATUSES = new Set(['draft', 'published', 'active', 'completed', 'archived']);

// Statuses a route may be deleted from, and be freely edited from — mirrors
// canDeleteRoute/canEditRoute in src/utils/routeHelpers.ts (client-side gate;
// this is the server-side enforcement of the same rule so the API can't be
// hit directly to delete/mutate a live or public run).
const DELETABLE_STATUSES = new Set(['draft', 'completed', 'archived']);

/** Brigades operate on Australian local time regardless of the server's own timezone. */
const BRIGADE_TIMEZONE = 'Australia/Sydney';

/** Today's date as `YYYY-MM-DD` in Australian local time (en-CA formats that way natively). */
function todayInBrigadeTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRIGADE_TIMEZONE }).format(new Date());
}

/** Whether a `route.date` string (`YYYY-MM-DD`) is strictly before today, in Australian local time. */
function isDateBeforePublishToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return dateStr < todayInBrigadeTimezone();
}

/**
 * Core identity of a waypoint for the purposes of detecting a structural
 * edit (added/removed/reordered/moved/relabelled stop) vs. a progress update
 * (isCompleted/actualArrival/estimatedArrival) that the navigator writes via
 * the same PUT while a run is active.
 */
function waypointCoreEqual(a: any, b: any): boolean {
  const coordsA = Array.isArray(a?.coordinates) ? a.coordinates : [];
  const coordsB = Array.isArray(b?.coordinates) ? b.coordinates : [];
  return (
    a?.id === b?.id &&
    a?.order === b?.order &&
    coordsA[0] === coordsB[0] &&
    coordsA[1] === coordsB[1] &&
    (a?.address || '') === (b?.address || '') &&
    (a?.name || '') === (b?.name || '') &&
    (a?.notes || '') === (b?.notes || '')
  );
}

function waypointsStructurallyChanged(oldWaypoints: any[], newWaypoints: any[]): boolean {
  if (oldWaypoints.length !== newWaypoints.length) return true;
  return oldWaypoints.some((wp, i) => !waypointCoreEqual(wp, newWaypoints[i]));
}

/** Returns an error message, or null if the payload's bounds are acceptable. */
function validateRoutePayload(route: any): string | null {
  if (route.name !== undefined && (typeof route.name !== 'string' || route.name.length > MAX_NAME_LENGTH)) {
    return `name must be a string up to ${MAX_NAME_LENGTH} characters`;
  }
  if (route.description !== undefined && (typeof route.description !== 'string' || route.description.length > MAX_DESCRIPTION_LENGTH)) {
    return `description must be a string up to ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  if (route.status !== undefined && !VALID_ROUTE_STATUSES.has(route.status)) {
    return `status must be one of: ${[...VALID_ROUTE_STATUSES].join(', ')}`;
  }
  if (route.waypoints !== undefined) {
    if (!Array.isArray(route.waypoints) || route.waypoints.length > MAX_WAYPOINTS) {
      return `waypoints must be an array of at most ${MAX_WAYPOINTS} entries`;
    }
    for (const wp of route.waypoints) {
      const coords = wp?.coordinates;
      const [lng, lat] = Array.isArray(coords) ? coords : [undefined, undefined];
      if (typeof lng !== 'number' || typeof lat !== 'number' || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return 'each waypoint requires coordinates [longitude, latitude] within valid ranges';
      }
    }
  }
  if (route.comments !== undefined) {
    if (!Array.isArray(route.comments) || route.comments.length > MAX_COMMENTS) {
      return `comments must be an array of at most ${MAX_COMMENTS} entries`;
    }
    for (const comment of route.comments) {
      if (typeof comment?.text === 'string' && comment.text.length > MAX_COMMENT_TEXT_LENGTH) {
        return `each comment's text must be at most ${MAX_COMMENT_TEXT_LENGTH} characters`;
      }
      if (typeof comment?.userName === 'string' && comment.userName.length > MAX_USERNAME_LENGTH) {
        return `each comment's userName must be at most ${MAX_USERNAME_LENGTH} characters`;
      }
    }
  }
  return null;
}

/**
 * Content-safety gate for a route save. The **name** is checked on every save,
 * including drafts: it is the run's identity and gives the brigade immediate
 * feedback rather than a surprise block at publish time (route saves are
 * explicit button clicks, not autosave, so this is ~one text call per click).
 * The **description** is longer and changes more, so it is only checked once
 * the route is (being made) publicly visible. Returns a 422 JSON response to
 * send, or null to proceed.
 */
async function moderateRoute(
  c: any,
  route: any,
  actorEmail: string,
): Promise<Response | null> {
  const isPublic = PUBLIC_ROUTE_STATUSES.has(route.status);
  const fields: ('name' | 'description')[] = isPublic ? ['name', 'description'] : ['name'];
  for (const field of fields) {
    const value = route[field];
    if (typeof value !== 'string' || !value.trim()) continue;
    const guard = await guardTextContent({
      subjectType: 'route',
      subjectId: route.id,
      brigadeId: route.brigadeId,
      field,
      value,
      actorEmail,
    });
    if (guard.blocked) {
      return c.json(
        { error: 'Content rejected', message: `${guard.reason} Edit the run ${field} and save again.` },
        422,
      );
    }
  }
  return null;
}

routesRouter.get('/', async (c) => {
  try {
    const brigadeId = c.req.query('brigadeId');
    if (!brigadeId) return c.json({ error: 'Missing required parameter: brigadeId' }, 400);
    const client = await getTableClient(ROUTES_TABLE);
    const entities = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}'` } });

    // Hardening fix (post-launch audit, 2026-09): this had no auth check at
    // all — anyone who could guess or look up a brigadeId got every one of
    // its routes, published or not, comments and real names included. A
    // member of this brigade (any role — this is a read, not a management
    // action) still sees everything, since they're the ones planning; anyone
    // else only sees what's already public, same bar as the single-route
    // lookup below.
    const authResult = await validateToken(c.req.raw);
    const isMember = authResult.authenticated && authResult.organizationId === brigadeId;

    const routes = [];
    for await (const entity of entities) {
      const route = entityToRoute(entity);
      if (isMember || PUBLIC_ROUTE_STATUSES.has(route.status)) routes.push(route);
    }
    return c.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return c.json({ error: 'Failed to fetch routes', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

routesRouter.get('/:id', async (c) => {
  try {
    const brigadeId = c.req.query('brigadeId');
    const routeId = c.req.param('id');
    const client = await getTableClient(ROUTES_TABLE);

    // Brigade-scoped lookup: fast point read, then the same membership check
    // as the list above. Hardening fix (post-launch audit, 2026-09): despite
    // the "(members)" comment this used to carry no auth check whatsoever —
    // supplying any brigadeId returned that brigade's route regardless of
    // status, to anyone.
    if (brigadeId) {
      try {
        const entity = await client.getEntity(brigadeId, routeId);
        const route = entityToRoute(entity);
        const authResult = await validateToken(c.req.raw);
        const isMember = authResult.authenticated && authResult.organizationId === brigadeId;
        if (isMember || PUBLIC_ROUTE_STATUSES.has(route.status)) {
          return c.json(route);
        }
        return c.json({ error: 'Route not found' }, 404);
      } catch (error: any) {
        if (error.statusCode === 404) return c.json({ error: 'Route not found' }, 404);
        throw error;
      }
    }

    // Anonymous lookup (public /track/:id): route IDs are globally unique, so
    // a RowKey scan finds at most one. Only publicly visible statuses are served.
    const entities = client.listEntities({
      queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` }
    });
    for await (const entity of entities) {
      const route = entityToRoute(entity);
      if (PUBLIC_ROUTE_STATUSES.has(route.status)) return c.json(route);
      break;
    }
    return c.json({ error: 'Route not found' }, 404);
  } catch (error) {
    console.error('Error fetching route:', error);
    return c.json({ error: 'Failed to fetch route', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

routesRouter.post('/', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const route = await c.req.json() as any;
    if (!route.id || !route.brigadeId) return c.json({ error: 'Missing required fields: id, brigadeId' }, 400);
    const validationError = validateRoutePayload(route);
    if (validationError) return c.json({ error: 'Invalid route payload', message: validationError }, 400);
    const permissionCheck = checkBrigadeAccess(authResult, route.brigadeId, 'manage_routes');
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    if (!authResult.santaRunEnabled) {
      return c.json({ error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' }, 402);
    }
    if (route.status === 'published' && isDateBeforePublishToday(route.date)) {
      return c.json(
        { error: 'Invalid publish date', message: 'This route\'s date is in the past — update the date before publishing.' },
        422,
      );
    }
    const blocked = await moderateRoute(c, route, authResult.email || authResult.userId || 'unknown');
    if (blocked) return blocked;
    const client = await getTableClient(ROUTES_TABLE);
    await client.createEntity(routeToEntity(route));
    console.log(`Created route: ${route.id} for brigade: ${route.brigadeId} by user: ${authResult.userId}`);
    emitMetric('route_created', { routeId: route.id, brigadeId: route.brigadeId });
    return c.json(route, 201);
  } catch (error: any) {
    console.error('Error creating route:', error);
    if (error.statusCode === 409) return c.json({ error: 'Route already exists' }, 409);
    return c.json({ error: 'Failed to create route', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

routesRouter.put('/:id', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const routeId = c.req.param('id');
    const route = await c.req.json() as any;
    if (!routeId || !route.brigadeId) return c.json({ error: 'Missing required fields: id, brigadeId' }, 400);
    const validationError = validateRoutePayload(route);
    if (validationError) return c.json({ error: 'Invalid route payload', message: validationError }, 400);
    const permissionCheck = checkBrigadeAccess(authResult, route.brigadeId, 'manage_routes');
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    if (!authResult.santaRunEnabled) {
      return c.json({ error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' }, 402);
    }
    const client = await getTableClient(ROUTES_TABLE);

    // Look up the currently-stored route (if any) to enforce lifecycle rules
    // that depend on the *previous* state — a live/active run's waypoints
    // can't be restructured, and a route can't be newly published with a
    // date that's already passed. Best-effort: a route that doesn't exist
    // yet (PUT-as-create) or a lookup failure skips these state-dependent
    // checks rather than blocking the write.
    let existingRoute: ReturnType<typeof entityToRoute> | null = null;
    try {
      const existingEntity = await client.getEntity(route.brigadeId, routeId);
      existingRoute = entityToRoute(existingEntity);
    } catch {
      existingRoute = null;
    }

    if (existingRoute?.status === 'active' && Array.isArray(route.waypoints)) {
      if (waypointsStructurallyChanged(existingRoute.waypoints, route.waypoints)) {
        return c.json(
          {
            error: 'Route is live',
            message: 'This run is currently active on the road — waypoints can\'t be changed while live. End the run first.',
          },
          409,
        );
      }
    }

    if (route.status === 'published' && existingRoute?.status !== 'published' && isDateBeforePublishToday(route.date)) {
      return c.json(
        { error: 'Invalid publish date', message: 'This route\'s date is in the past — update the date before publishing.' },
        422,
      );
    }

    const blocked = await moderateRoute(c, { ...route, id: routeId }, authResult.email || authResult.userId || 'unknown');
    if (blocked) return blocked;
    await client.updateEntity(routeToEntity({ ...route, id: routeId }), 'Merge');
    console.log(`Updated route: ${routeId} for brigade: ${route.brigadeId} by user: ${authResult.userId}`);
    return c.json(route);
  } catch (error: any) {
    console.error('Error updating route:', error);
    if (error.statusCode === 404) return c.json({ error: 'Route not found' }, 404);
    return c.json({ error: 'Failed to update route', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

routesRouter.delete('/:id', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const routeId = c.req.param('id');
    const brigadeId = c.req.query('brigadeId');
    if (!routeId || !brigadeId) return c.json({ error: 'Missing required parameters: id, brigadeId' }, 400);
    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'manage_routes');
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const client = await getTableClient(ROUTES_TABLE);

    try {
      const existingEntity = await client.getEntity(brigadeId, routeId);
      const existingRoute = entityToRoute(existingEntity);
      if (!DELETABLE_STATUSES.has(existingRoute.status)) {
        const message = existingRoute.status === 'active'
          ? 'This run is currently live — end it before deleting.'
          : 'This run is published and public — it can\'t be deleted while published.';
        return c.json({ error: 'Route cannot be deleted', message }, 409);
      }
    } catch (error: any) {
      if (error.statusCode === 404) return c.json({ error: 'Route not found' }, 404);
      throw error;
    }

    await client.deleteEntity(brigadeId, routeId);
    console.log(`Deleted route: ${routeId} for brigade: ${brigadeId} by user: ${authResult.userId}`);
    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error('Error deleting route:', error);
    if (error.statusCode === 404) return c.json({ error: 'Route not found' }, 404);
    return c.json({ error: 'Failed to delete route', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
