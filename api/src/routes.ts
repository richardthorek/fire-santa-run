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
import { TableClient } from '@azure/data-tables';

// Get Azure Storage credentials
const STORAGE_CONNECTION_STRING = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING || '';

// Determine table name based on environment
const isDevMode = process.env.VITE_DEV_MODE === 'true';
const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';

function getTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, ROUTES_TABLE);
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
  };
}

// GET /api/routes?brigadeId=xxx OR GET /api/routes/{id}?brigadeId=xxx
async function getRoutes(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.query.get('brigadeId');
    const routeId = request.params.id;

    if (!brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: brigadeId' }
      };
    }

    const client = getTableClient();

    // Get single route
    if (routeId) {
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
    const route = await request.json() as any;

    if (!route.id || !route.brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, brigadeId' }
      };
    }

    const client = getTableClient();
    const entity = routeToEntity(route);

    await client.createEntity(entity);

    context.log(`Created route: ${route.id} for brigade: ${route.brigadeId}`);

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
    const routeId = request.params.id;
    const route = await request.json() as any;

    if (!routeId || !route.brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, brigadeId' }
      };
    }

    const client = getTableClient();
    const entity = routeToEntity({ ...route, id: routeId });

    await client.updateEntity(entity, 'Merge');

    context.log(`Updated route: ${routeId} for brigade: ${route.brigadeId}`);

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
    const routeId = request.params.id;
    const brigadeId = request.query.get('brigadeId');

    if (!routeId || !brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: id, brigadeId' }
      };
    }

    const client = getTableClient();
    await client.deleteEntity(brigadeId, routeId);

    context.log(`Deleted route: ${routeId} for brigade: ${brigadeId}`);

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
