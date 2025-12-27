/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/brigades - Brigades CRUD API
 * 
 * Handles all brigade operations through Azure Table Storage backend.
 * Brigades are stored with brigadeId as both partition and row key.
 * 
 * Endpoints:
 * - GET /api/brigades - List all brigades
 * - GET /api/brigades/{id} - Get single brigade
 * - POST /api/brigades - Create new brigade
 * - PUT /api/brigades/{id} - Update existing brigade
 * - DELETE /api/brigades/{id} - Delete brigade
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { STORAGE_CONNECTION_STRING, isDevMode } from './utils/storage';
const BRIGADES_TABLE = isDevMode ? 'devbrigades' : 'brigades';

function getTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, BRIGADES_TABLE);
}

// Helper to convert Table entity to Brigade object
function entityToBrigade(entity: any) {
  return {
    id: entity.rowKey,
    name: entity.name,
    location: entity.location,
    contactEmail: entity.contactEmail,
    contactPhone: entity.contactPhone,
    allowedDomains: entity.allowedDomains ? JSON.parse(entity.allowedDomains) : [],
    createdAt: entity.createdAt,
  };
}

// Helper to convert Brigade to Table entity
function brigadeToEntity(brigade: any) {
  return {
    partitionKey: brigade.id,
    rowKey: brigade.id,
    name: brigade.name,
    location: brigade.location || '',
    contactEmail: brigade.contactEmail || '',
    contactPhone: brigade.contactPhone || '',
    allowedDomains: JSON.stringify(brigade.allowedDomains || []),
    createdAt: brigade.createdAt || new Date().toISOString(),
  };
}

// GET /api/brigades OR GET /api/brigades/{id}
async function getBrigades(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.params.id;
    const client = getTableClient();

    // Get single brigade
    if (brigadeId) {
      try {
        const entity = await client.getEntity(brigadeId, brigadeId);
        return {
          status: 200,
          jsonBody: entityToBrigade(entity)
        };
      } catch (error: any) {
        if (error.statusCode === 404) {
          return {
            status: 404,
            jsonBody: { error: 'Brigade not found' }
          };
        }
        throw error;
      }
    }

    // List all brigades
    const entities = client.listEntities();
    const brigades = [];
    for await (const entity of entities) {
      brigades.push(entityToBrigade(entity));
    }

    return {
      status: 200,
      jsonBody: brigades
    };

  } catch (error) {
    context.error('Error fetching brigades:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to fetch brigades',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/brigades
async function createBrigade(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigade = await request.json() as any;

    if (!brigade.id || !brigade.name) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, name' }
      };
    }

    const client = getTableClient();
    const entity = brigadeToEntity(brigade);

    await client.createEntity(entity);

    context.log(`Created brigade: ${brigade.id}`);

    return {
      status: 201,
      jsonBody: brigade
    };

  } catch (error: any) {
    context.error('Error creating brigade:', error);
    
    if (error.statusCode === 409) {
      return {
        status: 409,
        jsonBody: { error: 'Brigade already exists' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to create brigade',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// PUT /api/brigades/{id}
async function updateBrigade(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.params.id;
    const brigade = await request.json() as any;

    if (!brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: id' }
      };
    }

    const client = getTableClient();
    const entity = brigadeToEntity({ ...brigade, id: brigadeId });

    await client.updateEntity(entity, 'Merge');

    context.log(`Updated brigade: ${brigadeId}`);

    return {
      status: 200,
      jsonBody: brigade
    };

  } catch (error: any) {
    context.error('Error updating brigade:', error);
    
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Brigade not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to update brigade',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// DELETE /api/brigades/{id}
async function deleteBrigade(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.params.id;

    if (!brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: id' }
      };
    }

    const client = getTableClient();
    await client.deleteEntity(brigadeId, brigadeId);

    context.log(`Deleted brigade: ${brigadeId}`);

    return {
      status: 204,
      body: ''
    };

  } catch (error: any) {
    context.error('Error deleting brigade:', error);
    
    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Brigade not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to delete brigade',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('brigades-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades',
  handler: getBrigades
});

app.http('brigades-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades/{id}',
  handler: getBrigades
});

app.http('brigades-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'brigades',
  handler: createBrigade
});

app.http('brigades-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'brigades/{id}',
  handler: updateBrigade
});

app.http('brigades-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'brigades/{id}',
  handler: deleteBrigade
});
