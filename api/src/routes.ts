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

// Statuses visible to anonymous viewers (public tracking page). Drafts are
// never served without a brigadeId. Keep aligned with server/src/routes/routes.ts.
const PUBLIC_ROUTE_STATUSES = new Set(['published', 'active', 'completed', 'archived']);

// GET /api/routes?brigadeId=xxx OR GET /api/routes/{id}[?brigadeId=xxx]
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

    // Get single route
    if (routeId) {
      // Brigade-scoped lookup (members): fast point read, any status.
      if (brigadeId) {
        try {
          const entity = await client.getEntity(brigadeId, routeId);
          return {
            status: 200,
            jsonBody: entityToRoute(entity)
          };
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

    // List all routes for brigade
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}'` }
    });

    const routes = [];
    for await (const entity of entities) {
      routes.push(entityToRoute(entity));
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
