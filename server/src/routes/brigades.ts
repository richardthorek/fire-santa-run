/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken, checkBrigadeAccess } from '../utils/auth.js';
import { guardTextContent, guardImageContent } from '../utils/moderation.js';
import { isCurrentOrUpcomingRun } from '../utils/routeVisibility.js';

const BRIGADES_TABLE = isDevMode ? 'devbrigades' : 'brigades';
const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
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
    logo: entity.logo,
    themeColor: entity.themeColor,
    publicListing: entity.publicListing === 'shown' || entity.publicListing === 'hidden' ? entity.publicListing : 'auto',
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
    fireStationId: brigade.fireStationId || '',
    contact: brigade.contact ? JSON.stringify(brigade.contact) : JSON.stringify({}),
    contactEmail: brigade.contact?.email || brigade.contactEmail || '',
    contactPhone: brigade.contact?.phone || brigade.contactPhone || '',
    logo: brigade.logo || '',
    themeColor: brigade.themeColor || '',
    publicListing: brigade.publicListing === 'shown' || brigade.publicListing === 'hidden' ? brigade.publicListing : 'auto',
    createdAt: brigade.createdAt || new Date().toISOString(),
    updatedAt: brigade.updatedAt || new Date().toISOString(),
  };
}

/**
 * Filter a list of brigade entities to those that belong in the public
 * directory: `publicListing: 'shown'` always; `'hidden'` never; `'auto'`
 * (the default) only when the brigade has a current or upcoming run.
 */
async function directoryVisibleBrigades(entities: any[]): Promise<any[]> {
  const auto = entities.filter((e) => (e.publicListing || 'auto') === 'auto');
  const shown = entities.filter((e) => e.publicListing === 'shown');
  if (auto.length === 0) return shown;

  const withUpcomingRun = new Set<string>();
  const routesClient = await getTableClient(ROUTES_TABLE);
  // Only 'published'/'active' routes can qualify — scan just those.
  for await (const r of routesClient.listEntities<any>({
    queryOptions: { filter: `status eq 'published' or status eq 'active'` },
  })) {
    if (isCurrentOrUpcomingRun({ status: r.status, date: r.date })) {
      withUpcomingRun.add(r.partitionKey as string);
    }
  }
  return [...shown, ...auto.filter((e) => withUpcomingRun.has(e.rowKey))];
}

export const brigadesRouter = new Hono();

// Public list — sanitised projection only, no auth required.
// Used by the brigade discovery page (/brigades).
brigadesRouter.get('/public', async (c) => {
  try {
    const client = await getTableClient(BRIGADES_TABLE);
    const entities = [];
    for await (const entity of client.listEntities()) entities.push(entity);
    const visible = await directoryVisibleBrigades(entities);
    return c.json(visible.map(toPublicBrigade));
  } catch (error) {
    console.error('Error fetching public brigades:', error);
    return c.json({ error: 'Failed to fetch brigades', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Hardening fix (post-launch audit, 2026-09): this list (and by-station/:id
// and :id below) used to return entityToBrigade() — the full raw entity,
// unauthenticated. In practice the only genuinely private fields it added
// over toPublicBrigade() were a couple of redundant flat contactEmail/
// contactPhone properties (contact.email/contact.phone are already public by
// design — PublicBrigadePage renders them as mailto:/tel: links on every
// brigade's own public page) plus an internal updatedAt timestamp, so this
// was never the severe PII leak it first looked like — but there's no reason
// an unauthenticated bulk list needs the raw entity shape either, and the
// only real caller (BrigadeDiscoveryPage) already only reads public fields.
brigadesRouter.get('/', async (c) => {
  try {
    const client = await getTableClient(BRIGADES_TABLE);
    const entities = [];
    for await (const entity of client.listEntities()) entities.push(entity);
    const visible = await directoryVisibleBrigades(entities);
    return c.json(visible.map(toPublicBrigade));
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
      return c.json(toPublicBrigade(entity));
    }
    return c.json({ error: 'Brigade not found' }, 404);
  } catch (error) {
    console.error('Error fetching brigade by station ID:', error);
    return c.json({ error: 'Failed to fetch brigade by station ID' }, 500);
  }
});

// Public-safe projection for the unauthenticated /brigade/:slug page (and,
// per the hardening note above, every other unauthenticated brigade read).
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
    publicListing: b.publicListing,
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
      return c.json(toPublicBrigade(entity));
    } catch (error: any) {
      if (error.statusCode === 404) return c.json({ error: 'Brigade not found' }, 404);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching brigade:', error);
    return c.json({ error: 'Failed to fetch brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Create (or auto-provision) a brigade. brigade.id must equal the caller's own
// Station Manager organizationId — a brigade is 1:1 with an SM Organization,
// so there is no separate "claiming" step; the first Santa-entitled member of
// an org to open the app provisions its brigade row.
brigadesRouter.post('/', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    const brigade = await c.req.json() as any;
    if (!brigade.id || !brigade.name) return c.json({ error: 'Missing required fields: id, name' }, 400);
    if (brigade.id !== authResult.organizationId) {
      return c.json({ error: 'Forbidden', message: 'A brigade id must match your own organization' }, 403);
    }

    // Content safety: the brigade name shows on public, unauthenticated pages.
    const nameGuard = await guardTextContent({
      subjectType: 'brigade',
      subjectId: brigade.id,
      brigadeId: brigade.id,
      field: 'name',
      value: brigade.name,
      actorEmail: authResult.email || authResult.userId || 'unknown',
    });
    if (nameGuard.blocked) {
      return c.json({ error: 'Content rejected', message: `${nameGuard.reason} If this is a mistake, contact support.` }, 422);
    }

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
    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'edit_settings');
    if (!permissionCheck.authorized) return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    const brigade = await c.req.json() as any;
    const client = await getTableClient(BRIGADES_TABLE);

    // Content safety: only re-check fields that actually changed — the brigade
    // name and logo both render on public, unauthenticated pages, but image
    // moderation is slow/metered so an unchanged logo must not pay for it.
    let existing: any = null;
    try {
      existing = entityToBrigade(await client.getEntity(brigadeId, brigadeId));
    } catch {
      // No existing row (first write via PUT) — treat every field as changed.
    }
    const actorEmail = authResult.email || authResult.userId || 'unknown';
    if (typeof brigade.name === 'string' && brigade.name !== existing?.name) {
      const g = await guardTextContent({ subjectType: 'brigade', subjectId: brigadeId, brigadeId, field: 'name', value: brigade.name, actorEmail });
      if (g.blocked) return c.json({ error: 'Content rejected', message: g.reason }, 422);
    }
    if (typeof brigade.logo === 'string' && brigade.logo && brigade.logo !== existing?.logo) {
      const g = await guardImageContent({ subjectType: 'brigade', subjectId: brigadeId, brigadeId, field: 'logo', value: brigade.logo, actorEmail });
      if (g.blocked) return c.json({ error: 'Content rejected', message: g.reason }, 422);
    }

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
    const permissionCheck = checkBrigadeAccess(authResult, brigadeId, 'edit_settings');
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
