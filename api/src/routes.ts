/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/routes - Routes CRUD API
 * 
 * Handles all route operations through Azure Table Storage backend.
 * Routes are stored in Azure Table Storage with brigadeId as partition key.
 * 
 * Endpoints:
 * - GET /api/routes?brigadeId=xxx - List all routes for a brigade
 * - GET /api/routes/{id}?brigadeId=xxx - Get single route
 * - POST /api/routes - Create new route
 * - PUT /api/routes/{id} - Update existing route
 * - DELETE /api/routes/{id}?brigadeId=xxx - Delete route
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateToken, checkBrigadeAccess } from './utils/auth';
import { getTableClient, isDevMode } from './utils/storage';

const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';

async function getRoutesTableClient() {
  return getTableClient(ROUTES_TABLE);
}

// Helper to convert Table entity to Route object
function entityToRoute(entity: any) {
  const route = {
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
  return route;
}

// Helper to convert Route to Table entity
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

// Statuses visible to anyone who is not an actual member of the owning
// brigade. Keep aligned with server/src/routes/routes.ts.
const PUBLIC_ROUTE_STATUSES = new Set(['published', 'active', 'completed', 'archived']);

// Payload bounds (Tier 1b hardening, post-launch audit 2026-09). Mirrors
// server/src/routes/routes.ts's validateRoutePayload.
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_WAYPOINTS = 200;
const MAX_COMMENTS = 500;
const MAX_COMMENT_TEXT_LENGTH = 1000;
const MAX_USERNAME_LENGTH = 80;
const VALID_ROUTE_STATUSES = new Set(['draft', 'published', 'active', 'completed', 'archived']);

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

// GET /api/routes?brigadeId=xxx OR GET /api/routes/{id}[?brigadeId=xxx]
//
// Hardening fix (post-launch audit, 2026-09): the brigadeId-scoped branches
// below used to carry no auth check whatsoever — despite the "(members)"
// comment, supplying any brigadeId returned every route for that brigade
// (list) or a specific route regardless of status (single), to anyone, since
// brigadeId is not a secret (GET /brigades/public hands every one out).
async function getRoutes(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.query.get('brigadeId');
    const routeId = request.params.id;

    if (!brigadeId && !routeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: brigadeId' }
      };
    }

    const client = await getRoutesTableClient();
    const authResult = brigadeId ? await validateToken(request) : null;
    const isMember = !!(authResult?.authenticated && authResult.organizationId === brigadeId);

    // Get single route
    if (routeId) {
      // Brigade-scoped lookup: fast point read, then the same membership
      // check the list branch below applies.
      if (brigadeId) {
        try {
          const entity = await client.getEntity(brigadeId, routeId);
          const route = entityToRoute(entity);
          if (isMember || PUBLIC_ROUTE_STATUSES.has(route.status)) {
            return { status: 200, jsonBody: route };
          }
          return { status: 404, jsonBody: { error: 'Route not found' } };
        } catch (error: any) {
          if (error.statusCode === 404) {
            return {
              status: 404,
              jsonBody: { error: 'Route not found' }
            };
          }
          throw error;
        }
      }

      // Anonymous lookup (public /track/:id): route IDs are globally unique,
      // so a RowKey scan finds at most one. Only public statuses are served.
      const matches = client.listEntities({
        queryOptions: { filter: `RowKey eq '${routeId.replace(/'/g, "''")}'` }
      });
      for await (const entity of matches) {
        const route = entityToRoute(entity);
        if (PUBLIC_ROUTE_STATUSES.has(route.status)) {
          return { status: 200, jsonBody: route };
        }
        break;
      }
      return { status: 404, jsonBody: { error: 'Route not found' } };
    }

    // List all routes for brigade — a member (any role) sees every status
    // since they're the ones planning; anyone else only sees what's public.
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}'` }
    });

    const routes = [];
    for await (const entity of entities) {
      const route = entityToRoute(entity);
      if (isMember || PUBLIC_ROUTE_STATUSES.has(route.status)) routes.push(route);
    }

    return {
      status: 200,
      jsonBody: routes
    };

  } catch (error) {
    context.error('Error fetching routes:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to fetch routes',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/routes
async function createRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      context.error('Authentication failed during route create:', authResult);
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const route = await request.json() as any;

    if (!route.id || !route.brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, brigadeId' }
      };
    }

    const validationError = validateRoutePayload(route);
    if (validationError) {
      return { status: 400, jsonBody: { error: 'Invalid route payload', message: validationError } };
    }

    // Check brigade permission
    const permissionCheck = checkBrigadeAccess(authResult, route.brigadeId, 'manage_routes');

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    if (!authResult.santaRunEnabled) {
      return {
        status: 402,
        jsonBody: { error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' }
      };
    }

    const client = await getRoutesTableClient();
    const entity = routeToEntity(route);

    await client.createEntity(entity);

    context.log(`Created route: ${route.id} for brigade: ${route.brigadeId} by user: ${authResult.userId}`);

    return {
      status: 201,
      jsonBody: route
    };

  } catch (error: any) {
    context.error('Error creating route:', error);
    
    if (error.statusCode === 409) {
      return {
        status: 409,
        jsonBody: { error: 'Route already exists' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to create route',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// PUT /api/routes/{id}
async function updateRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      context.error('Authentication failed during route update:', authResult);
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const routeId = request.params.id;
    const route = await request.json() as any;

    if (!routeId || !route.brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, brigadeId' }
      };
    }

    const validationError = validateRoutePayload(route);
    if (validationError) {
      return { status: 400, jsonBody: { error: 'Invalid route payload', message: validationError } };
    }

    // Check brigade permission
    const permissionCheck = checkBrigadeAccess(authResult, route.brigadeId, 'manage_routes');

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    if (!authResult.santaRunEnabled) {
      return {
        status: 402,
        jsonBody: { error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' }
      };
    }

    const client = await getRoutesTableClient();
    const entity = routeToEntity({ ...route, id: routeId });

    await client.updateEntity(entity, 'Merge');

    context.log(`Updated route: ${routeId} for brigade: ${route.brigadeId} by user: ${authResult.userId}`);

    return {
      status: 200,
      jsonBody: route
    };

  } catch (error: any) {
    context.error('Error updating route:', error);
    
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Route not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to update route',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// DELETE /api/routes/{id}?brigadeId=xxx
async function deleteRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      context.error('Authentication failed during route delete:', authResult);
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const routeId = request.params.id;
    const brigadeId = request.query.get('brigadeId');

    if (!routeId || !brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: id, brigadeId' }
      };
    }

    // Check brigade permission
    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'manage_routes');

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    const client = await getRoutesTableClient();
    await client.deleteEntity(brigadeId, routeId);

    context.log(`Deleted route: ${routeId} for brigade: ${brigadeId} by user: ${authResult.userId}`);

    return {
      status: 204,
      body: ''
    };

  } catch (error: any) {
    context.error('Error deleting route:', error);
    
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Route not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to delete route',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('routes-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'routes',
  handler: getRoutes
});

app.http('routes-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'routes/{id}',
  handler: getRoutes
});

app.http('routes-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'routes',
  handler: createRoute
});

app.http('routes-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'routes/{id}',
  handler: updateRoute
});

app.http('routes-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'routes/{id}',
  handler: deleteRoute
});
