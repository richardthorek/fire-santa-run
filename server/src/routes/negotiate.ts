/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { WebPubSubServiceClient } from '@azure/web-pubsub';

const HUB_NAME = 'santa-tracking';

export const negotiateRouter = new Hono();

async function handleNegotiate(c: any) {
  try {
    const routeId = c.req.query('routeId');
    const role = c.req.query('role') || 'viewer';

    if (!routeId) {
      return c.json({ error: 'Missing required parameter: routeId' }, 400);
    }

    if (role !== 'viewer' && role !== 'broadcaster') {
      return c.json({ error: 'Invalid role. Must be "viewer" or "broadcaster"' }, 400);
    }

    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    if (!connectionString) {
      console.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return c.json({ error: 'Web PubSub service is not configured' }, 500);
    }

    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);
    const groupName = `route_${routeId}`;

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
