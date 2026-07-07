/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { rateLimit } from '../utils/rateLimit.js';
import { validateToken, checkBrigadePermission } from '../utils/auth.js';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { isBrigadeEntitled } from '../utils/subscription.js';
import type { BrigadeMembership } from '../types/membership.js';

const HUB_NAME = process.env.AZURE_WEBPUBSUB_HUB_NAME || 'santa_tracking';
const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';

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

    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    if (!connectionString) {
      console.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return c.json({ error: 'Web PubSub service is not configured' }, 500);
    }

    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);
    // Editors join a separate presence group so editor identities are never
    // delivered to anonymous public viewers on the tracking group.
    const groupName = role === 'editor' ? `edit_${routeId}` : `route_${routeId}`;

    const tokenOptions = {
      groups: [groupName],
      roles: role === 'broadcaster'
        ? ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup']
        : [],
      expirationTimeInMinutes: 120,
    };

    const token = await serviceClient.getClientAccessToken(tokenOptions);

    console.log(`Generated ${role} token for route: ${routeId}, group: ${groupName}`);
    return c.json({ url: token.url, role, routeId, groupName }, 200);
  } catch (error: any) {
    console.error('Error generating Web PubSub token:', error);
    return c.json({ error: 'Failed to generate connection token', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}

negotiateRouter.get('/negotiate', handleNegotiate);
negotiateRouter.post('/negotiate', handleNegotiate);
