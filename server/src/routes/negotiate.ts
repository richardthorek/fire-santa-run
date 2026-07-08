/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { rateLimit } from '../utils/rateLimit.js';
import { validateToken, checkBrigadePermission } from '../utils/auth.js';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { isBrigadeEntitled } from '../utils/subscription.js';
import { signWsToken } from '../realtime/wsToken.js';
import type { BrigadeMembership } from '../types/membership.js';

const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';

/**
 * Build the wss:// base for this deployment from APP_BASE_URL (the public
 * origin). Falls back to the incoming request's host so it still works if
 * APP_BASE_URL is unset.
 */
function resolveWsBase(reqUrl: string, hostHeader: string | undefined): string {
  const appBase = process.env.APP_BASE_URL;
  if (appBase) {
    return appBase.replace(/^http/, 'ws').replace(/\/$/, '');
  }
  try {
    const u = new URL(reqUrl);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${hostHeader ?? u.host}`;
  } catch {
    return `ws://${hostHeader ?? 'localhost'}`;
  }
}

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

/** Resolve which brigade owns a route (routes are keyed by brigadeId partition). */
async function getRouteBrigadeId(routeId: string): Promise<string | null> {
  const client = await getTableClient(ROUTES_TABLE);
  const entities = client.listEntities({ queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` } });
  for await (const entity of entities) {
    return typeof entity.partitionKey === 'string' ? entity.partitionKey : null;
  }
  return null;
}

async function getUserMembership(userId: string, brigadeId: string): Promise<BrigadeMembership | null> {
  const client = await getTableClient(MEMBERSHIPS_TABLE);
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` },
  });
  for await (const entity of entities) {
    return { id: entity.rowKey, brigadeId: entity.partitionKey, userId: entity.userId, role: entity.role, status: entity.status } as unknown as BrigadeMembership;
  }
  return null;
}

export const negotiateRouter = new Hono();

// Launch hardening (#345): cap connection-token requests per client.
// Legitimate clients negotiate once per session (plus rare reconnects).
negotiateRouter.use('/negotiate', rateLimit({ name: 'negotiate', limit: 20, windowMs: 60_000 }));

async function handleNegotiate(c: any) {
  try {
    const routeId = c.req.query('routeId');
    const role = c.req.query('role') || 'viewer';

    if (!routeId) {
      return c.json({ error: 'Missing required parameter: routeId' }, 400);
    }

    if (role !== 'viewer' && role !== 'broadcaster' && role !== 'editor') {
      return c.json({ error: 'Invalid role. Must be "viewer", "broadcaster" or "editor"' }, 400);
    }

    // Anonymous public viewers may connect read-only, but a broadcaster token
    // carries sendToGroup rights (it can move Santa on the map) and an editor
    // token joins the private editing-presence group — both require a signed-in
    // brigade user. Viewer stays open so public tracking needs no login.
    if (role === 'broadcaster' || role === 'editor') {
      const authResult = await validateToken(c.req.raw);
      if (!authResult.authenticated) {
        return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
      }

      // A broadcaster is actively running a route, so it must belong to a brigade
      // the user can navigate for, and that brigade must be subscribed. Editor
      // (route planning presence) is gated the same way. Resolve the owning
      // brigade once here — negotiate happens once per session, not per update.
      const brigadeId = await getRouteBrigadeId(routeId);
      if (!brigadeId) {
        return c.json({ error: 'Route not found' }, 404);
      }
      const requiredPermission = role === 'broadcaster' ? 'start_navigation' : 'manage_routes';
      const permission = await checkBrigadePermission(authResult.userId!, brigadeId, requiredPermission, getUserMembership);
      if (!permission.authorized) {
        return c.json({ error: 'Forbidden', message: permission.error || 'Insufficient permissions' }, 403);
      }
      if (!(await isBrigadeEntitled(brigadeId))) {
        return c.json({ error: 'Payment required', message: 'An active brigade subscription is required to broadcast' }, 402);
      }
    }

    // Native WebSocket fan-out (in-process hub) — no managed Web PubSub. The URL
    // points at our own /api/ws endpoint. Viewers connect anonymously; broadcaster
    // and editor connections carry the signed token minted here (this call is
    // already authenticated), which the WS upgrade handler verifies.
    const wsBase = resolveWsBase(c.req.url, c.req.header('host'));
    const params = new URLSearchParams({ routeId, role });
    if (role === 'broadcaster' || role === 'editor') {
      params.set('token', signWsToken(routeId, role));
    }
    const url = `${wsBase}/api/ws?${params.toString()}`;

    return c.json({ url, role, routeId }, 200);
  } catch (error: any) {
    console.error('Error generating realtime connection URL:', error);
    return c.json({ error: 'Failed to generate connection URL', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}

negotiateRouter.get('/negotiate', handleNegotiate);
negotiateRouter.post('/negotiate', handleNegotiate);
