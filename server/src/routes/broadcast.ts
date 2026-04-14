/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { WebPubSubServiceClient } from '@azure/web-pubsub';

const HUB_NAME = 'santa-tracking';

interface LocationBroadcast {
  routeId: string;
  location: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
  currentWaypointIndex?: number;
  nextWaypointEta?: string;
}

export const broadcastRouter = new Hono();

broadcastRouter.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json() as Partial<LocationBroadcast>;

    if (!body.routeId) {
      return c.json({ error: 'Missing required field: routeId' }, 400);
    }

    if (!Array.isArray(body.location) || body.location.length !== 2) {
      return c.json({ error: 'Invalid location. Must be [longitude, latitude]' }, 400);
    }

    const [lng, lat] = body.location;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return c.json({ error: 'Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90' }, 400);
    }

    if (!body.timestamp) {
      return c.json({ error: 'Missing required field: timestamp' }, 400);
    }

    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    if (!connectionString) {
      console.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return c.json({ error: 'Web PubSub service is not configured' }, 500);
    }

    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);
    const groupName = `route_${body.routeId}`;

    const message: LocationBroadcast = {
      routeId: body.routeId,
      location: body.location,
      timestamp: body.timestamp,
      heading: body.heading,
      speed: body.speed,
      currentWaypointIndex: body.currentWaypointIndex,
      nextWaypointEta: body.nextWaypointEta,
    };

    const groupClient = serviceClient.group(groupName);
    await groupClient.sendToAll(message);

    console.log(`Broadcasted location update for route: ${body.routeId} to group: ${groupName}`);
    return c.json({ success: true, routeId: body.routeId, groupName, timestamp: body.timestamp }, 200);
  } catch (error: any) {
    console.error('Error broadcasting location:', error);
    return c.json({ error: 'Failed to broadcast location', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
