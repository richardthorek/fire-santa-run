/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/brigades - Brigades CRUD API
 *
 * Handles all brigade operations through Azure Table Storage backend.
 * Brigades are stored with brigadeId as both partition and row key.
 * A brigade is 1:1 with a Station Manager Organization (brigade.id ===
 * organizationId) — see utils/auth.ts.
 *
 * Endpoints:
 * - GET /api/brigades - List all brigades
 * - GET /api/brigades/{id} - Get single brigade
 * - POST /api/brigades - Create new brigade
 * - PUT /api/brigades/{id} - Update existing brigade
 * - DELETE /api/brigades/{id} - Delete brigade
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTableClient, isDevMode } from './utils/storage';
import { validateToken, checkBrigadeAccess } from './utils/auth';
const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function resolveBrigadesClient() {
  return getTableClient(BRIGADES_TABLE);
}

// Helper to convert Table entity to Brigade object
function entityToBrigade(entity: any) {
  return {
    id: entity.rowKey,
    slug: entity.slug,
    name: entity.name,
    location: entity.location,
    fireStationId: entity.fireStationId,
    contact: entity.contact ? JSON.parse(entity.contact) : {},
    contactEmail: entity.contactEmail,
    contactPhone: entity.contactPhone,
    logo: entity.logo,
    themeColor: entity.themeColor,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

// Helper to convert Brigade to Table entity
function brigadeToEntity(brigade: any) {
  return {
    partitionKey: brigade.id,
    rowKey: brigade.id,
    slug: brigade.slug,
    name: brigade.name,
    location: brigade.location || '',
    fireStationId: brigade.fireStationId || '',
    contact: brigade.contact ? JSON.stringify(brigade.contact) : JSON.stringify({}),
    contactEmail: brigade.contact?.email || brigade.contactEmail || '',
    contactPhone: brigade.contact?.phone || brigade.contactPhone || '',
    logo: brigade.logo || '',
    themeColor: brigade.themeColor || '',
    createdAt: brigade.createdAt || new Date().toISOString(),
    updatedAt: brigade.updatedAt || new Date().toISOString(),
  };
}

// Public-safe projection — declared here (function declarations hoist) so
// getBrigades can use it too; see the hardening note on app.http('brigades-list', ...) below.
function toPublicBrigade(entity: any) {
  const b = entityToBrigade(entity);
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    location: b.location,
    fireStationId: b.fireStationId,
    logo: b.logo,
    themeColor: b.themeColor,
    contact: b.contact,
    createdAt: b.createdAt,
  };
}

// GET /api/brigades OR GET /api/brigades/{id}
//
// Hardening fix (post-launch audit, 2026-09): this used to return
// entityToBrigade() — the full raw entity, unauthenticated. In practice the
// only genuinely private fields it added over toPublicBrigade() were a
// couple of redundant flat contactEmail/contactPhone properties
// (contact.email/contact.phone are already public by design — the public
// brigade page renders them as mailto:/tel: links) plus an internal
// updatedAt timestamp, so this was never the severe PII leak it first
// looked like — but there's no reason an unauthenticated read needs the raw
// entity shape either.
async function getBrigades(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.params.id;
    const client = await resolveBrigadesClient();

    // Get single brigade
    if (brigadeId) {
      try {
        const entity = await client.getEntity(brigadeId, brigadeId);
        return {
          status: 200,
          jsonBody: toPublicBrigade(entity)
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
      brigades.push(toPublicBrigade(entity));
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

// POST /api/brigades — brigade.id must equal the caller's own Station
// Manager organizationId; a brigade is 1:1 with an SM Organization, so there
// is no separate "claiming" step.
async function createBrigade(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
    }
    const brigade = await request.json() as any;

    if (!brigade.id || !brigade.name) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: id, name' }
      };
    }
    if (brigade.id !== authResult.organizationId) {
      return { status: 403, jsonBody: { error: 'Forbidden', message: 'A brigade id must match your own organization' } };
    }

    const client = await resolveBrigadesClient();
    const now = new Date().toISOString();
    const entity = brigadeToEntity({ ...brigade, createdAt: brigade.createdAt || now, updatedAt: now });

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

    if (!brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: id' }
      };
    }

    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
    }
    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'edit_settings');
    if (!permissionCheck.authorized) {
      return { status: 403, jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' } };
    }

    const brigade = await request.json() as any;
    const client = await resolveBrigadesClient();
    const now = new Date().toISOString();
    const entity = brigadeToEntity({ ...brigade, id: brigadeId, updatedAt: now });

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

    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
    }
    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'edit_settings');
    if (!permissionCheck.authorized) {
      return { status: 403, jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' } };
    }

    const client = await resolveBrigadesClient();
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

app.http('brigades-get-by-station', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades/by-station/{fireStationId}',
  handler: async (request, context) => {
    try {
      const fireStationId = request.params.fireStationId;
      if (!fireStationId) {
        return { status: 400, jsonBody: { error: 'Missing required parameter: fireStationId' } };
      }

      const client = await resolveBrigadesClient();
      const entities = client.listEntities({ queryOptions: { filter: `fireStationId eq '${escapeODataValue(fireStationId)}'` } });
      for await (const entity of entities) {
        return { status: 200, jsonBody: toPublicBrigade(entity) };
      }
      return { status: 404, jsonBody: { error: 'Brigade not found' } };
    } catch (error: any) {
      context.error('Error fetching brigade by station ID:', error);
      return { status: 500, jsonBody: { error: 'Failed to fetch brigade by station ID' } };
    }
  }
});

app.http('brigades-get-by-slug', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades/by-slug/{slug}',
  handler: async (request, context) => {
    try {
      const slug = request.params.slug;
      if (!slug) {
        return { status: 400, jsonBody: { error: 'Missing required parameter: slug' } };
      }
      const client = await resolveBrigadesClient();
      const entities = client.listEntities({ queryOptions: { filter: `slug eq '${slug.replace(/'/g, "''")}'` } });
      for await (const entity of entities) {
        return { status: 200, jsonBody: toPublicBrigade(entity) };
      }
      return { status: 404, jsonBody: { error: 'Brigade not found' } };
    } catch (error: any) {
      context.error('Error fetching brigade by slug:', error);
      return { status: 500, jsonBody: { error: 'Failed to fetch brigade by slug' } };
    }
  }
});

// GET /api/brigades/public — sanitised list for the public discovery page.
app.http('brigades-get-public', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades/public',
  handler: async (request, context) => {
    try {
      const client = await resolveBrigadesClient();
      const entities = client.listEntities();
      const brigades = [];
      for await (const entity of entities) {
        brigades.push(toPublicBrigade(entity));
      }
      return { status: 200, jsonBody: brigades };
    } catch (error) {
      context.error('Error fetching public brigades:', error);
      return { status: 500, jsonBody: { error: 'Failed to fetch brigades' } };
    }
  }
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
