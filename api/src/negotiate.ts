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
import { checkRateLimit } from './rateLimit';
import { validateToken, checkBrigadeAccess } from './utils/auth';
import { getTableClient, isDevMode } from './utils/storage';

const HUB_NAME = process.env.AZURE_WEBPUBSUB_HUB_NAME || 'santa_tracking';
const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getRouteBrigadeId(routeId: string): Promise<string | null> {
  const client = await getTableClient(ROUTES_TABLE);
  const entities = client.listEntities({ queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` } });
  for await (const entity of entities) {
    return typeof entity.partitionKey === 'string' ? entity.partitionKey : null;
  }
  return null;
}

export async function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Launch hardening (#345): clients negotiate once per session, so 20/min
    // per IP is generous while blocking token-minting floods.
    const limited = checkRateLimit(request, 'negotiate', 20, 60_000);
    if (limited) return limited;

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
    if (role !== 'viewer' && role !== 'broadcaster' && role !== 'editor') {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid role. Must be "viewer", "broadcaster" or "editor"'
        }
      };
    }

    // Anonymous public viewers may connect read-only, but a broadcaster token
    // carries sendToGroup rights (it can move Santa on the map) and an editor
    // token joins the private editing-presence group — both require a signed-in
    // brigade user. Viewer stays open so public tracking needs no login.
    if (role === 'broadcaster' || role === 'editor') {
      const authResult = await validateToken(request);
      if (!authResult.authenticated) {
        return { status: 401, jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' } };
      }

      // Broadcaster/editor tokens are privileged: the route must belong to a
      // brigade the user can act on, and that brigade's organisation must have
      // Fire Santa Run enabled. Resolved once per session (negotiate), not per
      // location update.
      const brigadeId = await getRouteBrigadeId(routeId);
      if (!brigadeId) {
        return { status: 404, jsonBody: { error: 'Route not found' } };
      }
      const requiredPermission = role === 'broadcaster' ? 'start_navigation' : 'manage_routes';
      const permission = checkBrigadeAccess(authResult, brigadeId, requiredPermission);
      if (!permission.authorized) {
        return { status: 403, jsonBody: { error: 'Forbidden', message: permission.error || 'Insufficient permissions' } };
      }
      if (!authResult.santaRunEnabled) {
        return { status: 402, jsonBody: { error: 'Payment required', message: 'Fire Santa Run is not enabled for your organisation' } };
      }
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

    // Generate group name for route. Editors join a separate presence group
    // so editor identities are never delivered to anonymous public viewers.
    const groupName = role === 'editor' ? `edit_${routeId}` : `route_${routeId}`;

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
