/**
 * /api/negotiate - Generate Azure Web PubSub connection token
 * 
 * This function generates connection tokens for clients to connect to Azure Web PubSub.
 * It supports two types of connections:
 * - Viewer: Can receive messages from a specific route group (read-only)
 * - Broadcaster: Can send messages to a specific route group (for navigator device)
 * 
 * Query Parameters:
 * - routeId (required): The route ID to connect to
 * - role (optional): 'viewer' (default) or 'broadcaster'
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebPubSubServiceClient } from '@azure/web-pubsub';

const HUB_NAME = 'santa-tracking';

export async function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Get query parameters
    const routeId = request.query.get('routeId');
    const role = request.query.get('role') || 'viewer';

    // Validate routeId
    if (!routeId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required parameter: routeId'
        }
      };
    }

    // Validate role
    if (role !== 'viewer' && role !== 'broadcaster') {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid role. Must be "viewer" or "broadcaster"'
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
    const groupName = `route_${routeId}`;

    // Configure token options based on role
    const tokenOptions = {
      groups: [groupName],
      roles: role === 'broadcaster' 
        ? ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup']
        : [], // Viewers get default permissions (can receive messages)
      expirationTimeInMinutes: 120, // 2 hours
    };

    // Generate access token
    const token = await serviceClient.getClientAccessToken(tokenOptions);

    context.log(`Generated ${role} token for route: ${routeId}, group: ${groupName}`);

    // Return connection URL
    return {
      status: 200,
      jsonBody: {
        url: token.url,
        role,
        routeId,
        groupName
      }
    };

  } catch (error) {
    context.error('Error generating Web PubSub token:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to generate connection token',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

app.http('negotiate', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: negotiate
});
