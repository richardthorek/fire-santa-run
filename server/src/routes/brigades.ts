/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken, checkBrigadePermission } from '../utils/auth.js';

const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';
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
    allowedDomains: entity.allowedDomains ? JSON.parse(entity.allowedDomains) : [],
    allowedEmails: entity.allowedEmails ? JSON.parse(entity.allowedEmails) : [],
    requireManualApproval: entity.requireManualApproval === true,
    adminUserIds: entity.adminUserIds ? JSON.parse(entity.adminUserIds) : [],
    isClaimed: entity.isClaimed === true,
    claimedAt: entity.claimedAt,
    claimedBy: entity.claimedBy,
    logo: entity.logo,
    themeColor: entity.themeColor,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    // Entitlement state the UI needs to render the paywall. Non-sensitive, so
    // it is safe on the unauthenticated brigade GET. The Stripe customer/
    // subscription IDs are deliberately NOT projected here (they are read
    // straight off the table entity by the Stripe routes when needed), and
    // these fields are written only by the webhook — never by brigadeToEntity —
    // so a settings PUT (Merge) can never clobber them.
    subscriptionStatus: entity.subscriptionStatus || 'none',
    subscribedUntil: entity.subscribedUntil || undefined,
  };
}

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
    allowedDomains: JSON.stringify(brigade.allowedDomains || []),
    allowedEmails: JSON.stringify(brigade.allowedEmails || []),
    requireManualApproval: brigade.requireManualApproval ?? false,
    adminUserIds: JSON.stringify(brigade.adminUserIds || []),
    isClaimed: brigade.isClaimed ?? false,
    claimedAt: brigade.claimedAt || '',
    claimedBy: brigade.claimedBy || '',
    logo: brigade.logo || '',
    themeColor: brigade.themeColor || '',
    createdAt: brigade.createdAt || new Date().toISOString(),
    updatedAt: brigade.updatedAt || new Date().toISOString(),
  };
}

export const brigadesRouter = new Hono();

// Public list — sanitised projection only, no auth required.
// Used by the brigade discovery page (/brigades).
brigadesRouter.get('/public', async (c) => {
  try {
    const client = await getTableClient(BRIGADES_TABLE);
    const brigades = [];
    for await (const entity of client.listEntities()) {
      brigades.push(toPublicBrigade(entity));
    }
    return c.json(brigades);
  } catch (error) {
    console.error('Error fetching public brigades:', error);
    return c.json({ error: 'Failed to fetch brigades', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

brigadesRouter.get('/', async (c) => {
  try {
    const client = await getTableClient(BRIGADES_TABLE);
    const brigades = [];
    for await (const entity of client.listEntities()) {
      brigades.push(entityToBrigade(entity));
    }
    return c.json(brigades);
  } catch (error) {
    console.error('Error fetching brigades:', error);
    return c.json({ error: 'Failed to fetch brigades', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

brigadesRouter.get('/by-station/:fireStationId', async (c) => {
  try {
    const fireStationId = c.req.param('fireStationId');
    const client = await getTableClient(BRIGADES_TABLE);
    const entities = client.listEntities({ queryOptions: { filter: `fireStationId eq '${escapeODataValue(fireStationId)}'` } });
    for await (const entity of entities) {
      return c.json(entityToBrigade(entity));
    }
    return c.json({ error: 'Brigade not found' }, 404);
  } catch (error) {
    console.error('Error fetching brigade by station ID:', error);
    return c.json({ error: 'Failed to fetch brigade by station ID' }, 500);
  }
});

// Public-safe projection for the unauthenticated /brigade/:slug page — omits
// member emails, allowed domains, and admin user IDs.
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
    isClaimed: b.isClaimed,
    createdAt: b.createdAt,
  };
}

// Public lookup by slug. Registered before /:id so "by-slug" is not captured
// as an :id. Returns only public-safe fields.
brigadesRouter.get('/by-slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const client = await getTableClient(BRIGADES_TABLE);
    const entities = client.listEntities({ queryOptions: { filter: `slug eq '${escapeODataValue(slug)}'` } });
    for await (const entity of entities) {
      return c.json(toPublicBrigade(entity));
    }
    return c.json({ error: 'Brigade not found' }, 404);
  } catch (error) {
    console.error('Error fetching brigade by slug:', error);
    return c.json({ error: 'Failed to fetch brigade by slug' }, 500);
  }
});

brigadesRouter.get('/:id', async (c) => {
  try {
    const brigadeId = c.req.param('id');
    const client = await getTableClient(BRIGADES_TABLE);
    try {
      const entity = await client.getEntity(brigadeId, brigadeId);
      return c.json(entityToBrigade(entity));
    } catch (error: any) {
      if (error.statusCode === 404) return c.json({ error: 'Brigade not found' }, 404);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching brigade:', error);
    return c.json({ error: 'Failed to fetch brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

brigadesRouter.post('/', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const brigade = await c.req.json() as any;
    if (!brigade.id || !brigade.name) return c.json({ error: 'Missing required fields: id, name' }, 400);
    const client = await getTableClient(BRIGADES_TABLE);
    const now = new Date().toISOString();
    const entity = brigadeToEntity({ ...brigade, createdAt: brigade.createdAt || now, updatedAt: now });
    await client.createEntity(entity);
    console.log(`Created brigade: ${brigade.id}`);
    return c.json(brigade, 201);
  } catch (error: any) {
    console.error('Error creating brigade:', error);
    if (error.statusCode === 409) return c.json({ error: 'Brigade already exists' }, 409);
    return c.json({ error: 'Failed to create brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

brigadesRouter.put('/:id', async (c) => {
  try {
    const brigadeId = c.req.param('id');
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'edit_settings', getUserMembership);
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const brigade = await c.req.json() as any;
    const client = await getTableClient(BRIGADES_TABLE);
    const now = new Date().toISOString();
    const entity = brigadeToEntity({ ...brigade, id: brigadeId, updatedAt: now });
    await client.updateEntity(entity, 'Merge');
    console.log(`Updated brigade: ${brigadeId}`);
    return c.json(brigade);
  } catch (error: any) {
    console.error('Error updating brigade:', error);
    if (error.statusCode === 404) return c.json({ error: 'Brigade not found' }, 404);
    return c.json({ error: 'Failed to update brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

brigadesRouter.delete('/:id', async (c) => {
  try {
    const brigadeId = c.req.param('id');
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'edit_settings', getUserMembership);
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const client = await getTableClient(BRIGADES_TABLE);
    await client.deleteEntity(brigadeId, brigadeId);
    console.log(`Deleted brigade: ${brigadeId}`);
    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error('Error deleting brigade:', error);
    if (error.statusCode === 404) return c.json({ error: 'Brigade not found' }, 404);
    return c.json({ error: 'Failed to delete brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
