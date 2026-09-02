/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Platform-admin API — powers the /admin portal.
 *
 * Every route here is gated by `requirePlatformAdmin` (Station Manager's
 * `isPlatformAdmin` flag, or the local PLATFORM_ADMIN_EMAILS bridge — see
 * utils/auth.ts). Unlike the rest of the API these endpoints are NOT
 * brigade-scoped: a platform admin sees and can act on every brigade's data.
 *
 * Read endpoints project only what the portal renders. Destructive endpoints
 * ("clear out runs", delete a brigade) cascade to the dependent rows and
 * report what they removed.
 */

import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { requirePlatformAdmin } from '../utils/auth.js';
import { listFlags, getFlag, resolveFlag, type ModerationFlagStatus, type ModerationSubjectType } from '../utils/moderation.js';

const BRIGADES_TABLE = isDevMode ? 'devbrigades' : 'brigades';
const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';
const USERS_TABLE = isDevMode ? 'devusers' : 'users';
const MEMBERSHIPS_TABLE = isDevMode ? 'devmemberships' : 'memberships';
const VIEWER_SESSIONS_TABLE = isDevMode ? 'devviewersessions' : 'viewersessions';

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

export const adminRouter = new Hono<{ Variables: { adminEmail: string } }>();

/** Gate + stash the admin's identity for logging. 401/403 on failure. */
adminRouter.use('*', async (c, next) => {
  const gate = await requirePlatformAdmin(c.req.raw);
  if (!gate.ok) return c.json(gate.body, gate.status);
  c.set('adminEmail', gate.auth.email || gate.auth.userId || 'unknown');
  await next();
});

function adminEmail(c: { get: (k: 'adminEmail') => string | undefined }): string {
  return c.get('adminEmail') || 'unknown';
}

// ── Overview / stats ─────────────────────────────────────────────────────────

adminRouter.get('/overview', async (c) => {
  try {
    const [brigadesClient, routesClient, usersClient, sessionsClient] = await Promise.all([
      getTableClient(BRIGADES_TABLE),
      getTableClient(ROUTES_TABLE),
      getTableClient(USERS_TABLE),
      getTableClient(VIEWER_SESSIONS_TABLE),
    ]);

    let brigadeCount = 0;
    for await (const _ of brigadesClient.listEntities()) brigadeCount++;

    let routeCount = 0;
    const routesByStatus: Record<string, number> = {};
    for await (const e of routesClient.listEntities<any>()) {
      routeCount++;
      const s = (e.status as string) || 'unknown';
      routesByStatus[s] = (routesByStatus[s] || 0) + 1;
    }

    let userCount = 0;
    for await (const _ of usersClient.listEntities()) userCount++;

    let viewerSessionCount = 0;
    for await (const _ of sessionsClient.listEntities()) viewerSessionCount++;

    const flags = await listFlags();
    const flagsByStatus: Record<string, number> = {};
    for (const f of flags) flagsByStatus[f.status] = (flagsByStatus[f.status] || 0) + 1;

    return c.json({
      brigades: brigadeCount,
      users: userCount,
      routes: { total: routeCount, byStatus: routesByStatus },
      viewerSessions: viewerSessionCount,
      moderation: { total: flags.length, byStatus: flagsByStatus, openForReview: (flagsByStatus.pending || 0) + (flagsByStatus.blocked || 0) },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin] overview failed:', error);
    return c.json({ error: 'Failed to build overview', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// ── Brigades ─────────────────────────────────────────────────────────────────

adminRouter.get('/brigades', async (c) => {
  try {
    const [brigadesClient, routesClient] = await Promise.all([
      getTableClient(BRIGADES_TABLE),
      getTableClient(ROUTES_TABLE),
    ]);

    const routeCountByBrigade: Record<string, number> = {};
    for await (const e of routesClient.listEntities<any>()) {
      const b = e.partitionKey as string;
      routeCountByBrigade[b] = (routeCountByBrigade[b] || 0) + 1;
    }

    const brigades = [];
    for await (const e of brigadesClient.listEntities<any>()) {
      brigades.push({
        id: e.rowKey,
        slug: e.slug,
        name: e.name,
        location: e.location || '',
        fireStationId: e.fireStationId || '',
        contactEmail: e.contactEmail || '',
        contactPhone: e.contactPhone || '',
        hasLogo: Boolean(e.logo),
        themeColor: e.themeColor || '',
        publicListing: e.publicListing === 'shown' || e.publicListing === 'hidden' ? e.publicListing : 'auto',
        createdAt: e.createdAt || '',
        updatedAt: e.updatedAt || '',
        routeCount: routeCountByBrigade[e.rowKey] || 0,
      });
    }
    brigades.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return c.json(brigades);
  } catch (error) {
    console.error('[admin] list brigades failed:', error);
    return c.json({ error: 'Failed to list brigades' }, 500);
  }
});

/** Full brigade record including the logo data URL — for the detail drawer. */
adminRouter.get('/brigades/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const client = await getTableClient(BRIGADES_TABLE);
    try {
      const e = await client.getEntity<any>(id, id);
      return c.json({
        id: e.rowKey,
        slug: e.slug,
        name: e.name,
        location: e.location || '',
        fireStationId: e.fireStationId || '',
        contact: e.contact ? JSON.parse(e.contact) : {},
        contactEmail: e.contactEmail || '',
        contactPhone: e.contactPhone || '',
        logo: e.logo || '',
        themeColor: e.themeColor || '',
        createdAt: e.createdAt || '',
        updatedAt: e.updatedAt || '',
      });
    } catch (err: any) {
      if (err.statusCode === 404) return c.json({ error: 'Brigade not found' }, 404);
      throw err;
    }
  } catch (error) {
    console.error('[admin] get brigade failed:', error);
    return c.json({ error: 'Failed to get brigade' }, 500);
  }
});

/**
 * Admin edit of any brigade — used to fix a flagged name or clear a flagged
 * logo without going through the brigade's own membership check or the content
 * gate (the admin is the authority). Merge semantics: only supplied fields change.
 */
adminRouter.put('/brigades/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const patch = await c.req.json() as any;
    const client = await getTableClient(BRIGADES_TABLE);
    const allowed = ['name', 'location', 'logo', 'themeColor', 'contactEmail', 'contactPhone', 'publicListing'];
    const entity: any = { partitionKey: id, rowKey: id, updatedAt: new Date().toISOString() };
    for (const k of allowed) if (patch[k] !== undefined) entity[k] = patch[k];
    if (patch.contact !== undefined) entity.contact = JSON.stringify(patch.contact);
    await client.updateEntity(entity, 'Merge');
    console.log(`[admin] ${adminEmail(c)} edited brigade ${id} (${Object.keys(entity).filter((k) => !['partitionKey', 'rowKey', 'updatedAt'].includes(k)).join(', ')})`);
    return c.json({ ok: true });
  } catch (error: any) {
    if (error.statusCode === 404) return c.json({ error: 'Brigade not found' }, 404);
    console.error('[admin] edit brigade failed:', error);
    return c.json({ error: 'Failed to edit brigade' }, 500);
  }
});

/** Delete a brigade and everything scoped to it: routes, their viewer sessions, memberships. */
adminRouter.delete('/brigades/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const [brigadesClient, routesClient, sessionsClient, membershipsClient] = await Promise.all([
      getTableClient(BRIGADES_TABLE),
      getTableClient(ROUTES_TABLE),
      getTableClient(VIEWER_SESSIONS_TABLE),
      getTableClient(MEMBERSHIPS_TABLE),
    ]);

    const removed = { routes: 0, viewerSessions: 0, memberships: 0, brigade: 0 };

    const routeIds: string[] = [];
    for await (const e of routesClient.listEntities<any>({ queryOptions: { filter: `PartitionKey eq '${escapeOData(id)}'` } })) {
      routeIds.push(e.rowKey);
    }
    for (const routeId of routeIds) {
      for await (const s of sessionsClient.listEntities<any>({ queryOptions: { filter: `PartitionKey eq '${escapeOData(routeId)}'` } })) {
        await sessionsClient.deleteEntity(s.partitionKey, s.rowKey);
        removed.viewerSessions++;
      }
      await routesClient.deleteEntity(id, routeId);
      removed.routes++;
    }

    for await (const m of membershipsClient.listEntities<any>({ queryOptions: { filter: `PartitionKey eq '${escapeOData(id)}'` } })) {
      await membershipsClient.deleteEntity(m.partitionKey, m.rowKey);
      removed.memberships++;
    }

    try {
      await brigadesClient.deleteEntity(id, id);
      removed.brigade = 1;
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;
    }

    console.log(`[admin] ${adminEmail(c)} deleted brigade ${id}: ${JSON.stringify(removed)}`);
    return c.json({ ok: true, removed });
  } catch (error) {
    console.error('[admin] delete brigade failed:', error);
    return c.json({ error: 'Failed to delete brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// ── Routes ("runs") ──────────────────────────────────────────────────────────

adminRouter.get('/routes', async (c) => {
  try {
    const statusFilter = c.req.query('status');
    const brigadeFilter = c.req.query('brigadeId');
    const [routesClient, brigadesClient] = await Promise.all([
      getTableClient(ROUTES_TABLE),
      getTableClient(BRIGADES_TABLE),
    ]);

    const brigadeNames: Record<string, string> = {};
    for await (const b of brigadesClient.listEntities<any>()) brigadeNames[b.rowKey] = b.name;

    const routes = [];
    for await (const e of routesClient.listEntities<any>()) {
      if (statusFilter && e.status !== statusFilter) continue;
      if (brigadeFilter && e.partitionKey !== brigadeFilter) continue;
      routes.push({
        id: e.rowKey,
        brigadeId: e.partitionKey,
        brigadeName: brigadeNames[e.partitionKey] || '(unknown brigade)',
        name: e.name,
        status: e.status,
        date: e.date || '',
        createdAt: e.createdAt || '',
        createdBy: e.createdBy || '',
        publishedAt: e.publishedAt || '',
        viewCount: e.viewCount || 0,
      });
    }
    routes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return c.json(routes);
  } catch (error) {
    console.error('[admin] list routes failed:', error);
    return c.json({ error: 'Failed to list routes' }, 500);
  }
});

/** Take a run offline without deleting it (flagged content, or a mistaken publish). */
adminRouter.post('/routes/:id/unpublish', async (c) => {
  try {
    const id = c.req.param('id');
    const brigadeId = c.req.query('brigadeId');
    if (!brigadeId) return c.json({ error: 'Missing brigadeId' }, 400);
    const client = await getTableClient(ROUTES_TABLE);
    await client.updateEntity({ partitionKey: brigadeId, rowKey: id, status: 'draft' }, 'Merge');
    console.log(`[admin] ${adminEmail(c)} unpublished route ${id} (brigade ${brigadeId})`);
    return c.json({ ok: true });
  } catch (error: any) {
    if (error.statusCode === 404) return c.json({ error: 'Route not found' }, 404);
    console.error('[admin] unpublish route failed:', error);
    return c.json({ error: 'Failed to unpublish route' }, 500);
  }
});

/** Delete a run and its viewer sessions. */
adminRouter.delete('/routes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const brigadeId = c.req.query('brigadeId');
    if (!brigadeId) return c.json({ error: 'Missing brigadeId' }, 400);
    const [routesClient, sessionsClient] = await Promise.all([
      getTableClient(ROUTES_TABLE),
      getTableClient(VIEWER_SESSIONS_TABLE),
    ]);
    let viewerSessions = 0;
    for await (const s of sessionsClient.listEntities<any>({ queryOptions: { filter: `PartitionKey eq '${escapeOData(id)}'` } })) {
      await sessionsClient.deleteEntity(s.partitionKey, s.rowKey);
      viewerSessions++;
    }
    try {
      await routesClient.deleteEntity(brigadeId, id);
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;
    }
    console.log(`[admin] ${adminEmail(c)} deleted route ${id} (brigade ${brigadeId}, ${viewerSessions} viewer sessions)`);
    return c.json({ ok: true, removed: { route: 1, viewerSessions } });
  } catch (error) {
    console.error('[admin] delete route failed:', error);
    return c.json({ error: 'Failed to delete route', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

adminRouter.get('/users', async (c) => {
  try {
    const client = await getTableClient(USERS_TABLE);
    const users = [];
    for await (const e of client.listEntities<any>()) {
      users.push({
        id: e.rowKey,
        email: e.email || '',
        name: e.name || '',
        createdAt: e.createdAt || '',
        lastSeenAt: e.timestamp || (e as any).Timestamp || '',
      });
    }
    users.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    return c.json(users);
  } catch (error) {
    console.error('[admin] list users failed:', error);
    return c.json({ error: 'Failed to list users' }, 500);
  }
});

// ── Moderation queue ─────────────────────────────────────────────────────────

adminRouter.get('/moderation', async (c) => {
  try {
    const status = c.req.query('status') as ModerationFlagStatus | undefined;
    const flags = await listFlags(status);
    return c.json(flags);
  } catch (error) {
    console.error('[admin] list moderation flags failed:', error);
    return c.json({ error: 'Failed to list moderation flags' }, 500);
  }
});

/**
 * Resolve a flag.
 *  - approve  → the exact value is allowed on the brigade's next save (false positive)
 *  - remove   → you have taken the content down (via PUT /brigades or DELETE/unpublish route)
 *  - dismiss  → no action needed
 */
adminRouter.post('/moderation/:subjectType/:id/resolve', async (c) => {
  try {
    const subjectType = c.req.param('subjectType') as ModerationSubjectType;
    const id = c.req.param('id');
    const { action, note } = await c.req.json() as { action?: string; note?: string };
    const map: Record<string, 'approved' | 'removed' | 'dismissed'> = {
      approve: 'approved',
      remove: 'removed',
      dismiss: 'dismissed',
    };
    const status = action ? map[action] : undefined;
    if (!status) return c.json({ error: 'action must be one of: approve, remove, dismiss' }, 400);
    if (subjectType !== 'brigade' && subjectType !== 'route') return c.json({ error: 'Invalid subjectType' }, 400);

    const existing = await getFlag(subjectType, id);
    if (!existing) return c.json({ error: 'Flag not found' }, 404);

    const updated = await resolveFlag(subjectType, id, { status, resolvedBy: adminEmail(c), note });
    console.log(`[admin] ${adminEmail(c)} resolved flag ${id} → ${status}`);
    return c.json(updated);
  } catch (error) {
    console.error('[admin] resolve flag failed:', error);
    return c.json({ error: 'Failed to resolve flag' }, 500);
  }
});
