/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { rateLimit } from '../utils/rateLimit.js';

const HUB_NAME = process.env.AZURE_WEBPUBSUB_HUB_NAME || 'santa_tracking';

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
