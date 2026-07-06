/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { validateToken, checkBrigadePermission } from '../utils/auth.js';
import { getTableClient, isDevMode } from '../utils/storage.js';

const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getUserMembership(userId: string, brigadeId: string): Promise<any> {
  const client = await getTableClient(MEMBERSHIPS_TABLE);
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` }
  });
  for await (const entity of entities) {
    return { id: entity.rowKey, brigadeId: entity.partitionKey, userId: entity.userId, role: entity.role, status: entity.status };
  }
  return null;
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
  };
}

export const routesRouter = new Hono();

routesRouter.get('/', async (c) => {
  try {
    const brigadeId = c.req.query('brigadeId');
    if (!brigadeId) return c.json({ error: 'Missing required parameter: brigadeId' }, 400);
    const client = await getTableClient(ROUTES_TABLE);
    const entities = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}'` } });
    const routes = [];
    for await (const entity of entities) routes.push(entityToRoute(entity));
    return c.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return c.json({ error: 'Failed to fetch routes', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Statuses visible to anonymous viewers (public tracking page). Drafts are
// never served without a brigadeId.
const PUBLIC_ROUTE_STATUSES = new Set(['published', 'active', 'completed', 'archived']);

routesRouter.get('/:id', async (c) => {
  try {
    const brigadeId = c.req.query('brigadeId');
    const routeId = c.req.param('id');
    const client = await getTableClient(ROUTES_TABLE);

    // Brigade-scoped lookup (members): fast point read, any status.
    if (brigadeId) {
      try {
        const entity = await client.getEntity(brigadeId, routeId);
        return c.json(entityToRoute(entity));
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
    const permissionCheck = await checkBrigadePermission(authResult.userId!, route.brigadeId, 'manage_routes', getUserMembership);
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const client = await getTableClient(ROUTES_TABLE);
    await client.createEntity(routeToEntity(route));
    console.log(`Created route: ${route.id} for brigade: ${route.brigadeId} by user: ${authResult.userId}`);
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
    const permissionCheck = await checkBrigadePermission(authResult.userId!, route.brigadeId, 'manage_routes', getUserMembership);
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const client = await getTableClient(ROUTES_TABLE);
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
    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'manage_routes', getUserMembership);
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const client = await getTableClient(ROUTES_TABLE);
    await client.deleteEntity(brigadeId, routeId);
    console.log(`Deleted route: ${routeId} for brigade: ${brigadeId} by user: ${authResult.userId}`);
    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error('Error deleting route:', error);
    if (error.statusCode === 404) return c.json({ error: 'Route not found' }, 404);
    return c.json({ error: 'Failed to delete route', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
