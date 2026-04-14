/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';

const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

function entityToBrigade(entity: any) {
  return {
    id: entity.rowKey,
    slug: entity.slug,
    name: entity.name,
    location: entity.location,
    rfsStationId: entity.rfsStationId,
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
  };
}

function brigadeToEntity(brigade: any) {
  return {
    partitionKey: brigade.id,
    rowKey: brigade.id,
    slug: brigade.slug,
    name: brigade.name,
    location: brigade.location || '',
    rfsStationId: brigade.rfsStationId || '',
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

brigadesRouter.get('/rfs/:rfsStationId', async (c) => {
  try {
    const rfsStationId = c.req.param('rfsStationId');
    const client = await getTableClient(BRIGADES_TABLE);
    const entities = client.listEntities({ queryOptions: { filter: `rfsStationId eq '${escapeODataValue(rfsStationId)}'` } });
    for await (const entity of entities) {
      return c.json(entityToBrigade(entity));
    }
    return c.json({ error: 'Brigade not found' }, 404);
  } catch (error) {
    console.error('Error fetching brigade by RFS ID:', error);
    return c.json({ error: 'Failed to fetch brigade by RFS ID' }, 500);
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
