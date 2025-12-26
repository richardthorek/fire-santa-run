/**
 * /api/broadcast - Broadcast location updates to tracking viewers
 * 
 * This function receives location updates from the navigator device
 * and broadcasts them to all viewers watching the specific route.
 * 
 * Body Parameters:
 * - routeId (required): The route ID
 * - location (required): [lng, lat] coordinates
 * - timestamp (required): Unix timestamp
 * - heading (optional): Compass bearing (0-360)
 * - speed (optional): Speed in meters/second
 * - currentWaypointIndex (optional): Index of current/next waypoint
 * - nextWaypointEta (optional): ETA to next waypoint
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
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

export async function broadcast(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Parse request body
    const body = await request.json() as Partial<LocationBroadcast>;

    // Validate required fields
    if (!body.routeId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required field: routeId'
        }
      };
    }

    // Validate location coordinates
    if (!Array.isArray(body.location) || body.location.length !== 2) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid location. Must be [longitude, latitude]'
        }
      };
    }

    const [lng, lat] = body.location;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90'
        }
      };
    }

    if (!body.timestamp) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required field: timestamp'
        }
      };
    }

    // Get Web PubSub connection string from environment
    const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;
    
    if (!connectionString) {
      context.error('AZURE_WEBPUBSUB_CONNECTION_STRING is not configured');
      return {
        status: 500,
        jsonBody: {
          error: 'Web PubSub service is not configured'
        }
      };
    }

    // Create Web PubSub service client
    const serviceClient = new WebPubSubServiceClient(connectionString, HUB_NAME);

    // Generate group name for route
    const groupName = `route_${body.routeId}`;

    // Prepare message payload
    const message: LocationBroadcast = {
      routeId: body.routeId,
      location: body.location,
      timestamp: body.timestamp,
      heading: body.heading,
      speed: body.speed,
      currentWaypointIndex: body.currentWaypointIndex,
      nextWaypointEta: body.nextWaypointEta,
    };

    // Get group client and broadcast to all group members
    const groupClient = serviceClient.group(groupName);
    await groupClient.sendToAll(message);

    context.log(`Broadcasted location update for route: ${body.routeId} to group: ${groupName}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        routeId: body.routeId,
        groupName,
        timestamp: body.timestamp
      }
    };

  } catch (error) {
    context.error('Error broadcasting location:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to broadcast location',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

app.http('broadcast', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: broadcast
});
