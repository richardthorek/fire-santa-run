/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/invitations - Invitations API
 * 
 * Handles invitation management: viewing, accepting, declining, and cancelling invitations.
 * Invitations are stored in Azure Table Storage with brigadeId as partition key.
 * 
 * Endpoints:
 * - GET /api/invitations/{token} - Get invitation details
 * - POST /api/invitations/{token}/accept - Accept invitation
 * - POST /api/invitations/{token}/decline - Decline invitation
 * - DELETE /api/invitations/{invitationId} - Cancel invitation
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { getTableClient, isDevMode } from './utils/storage';

const INVITATIONS_TABLE = isDevMode ? 'devinvitations' : 'invitations';
const MEMBERSHIPS_TABLE = isDevMode ? 'devmemberships' : 'memberships';

async function getInvitationsTableClient(): Promise<TableClient> {
  return getTableClient(INVITATIONS_TABLE);
}

async function getMembershipsTableClient(): Promise<TableClient> {
  return getTableClient(MEMBERSHIPS_TABLE);
}

// Helper to convert Table entity to Invitation object
function entityToInvitation(entity: any) {
  return {
    id: entity.rowKey,
    brigadeId: entity.partitionKey,
    email: entity.email,
    role: entity.role,
    status: entity.status,
    invitedBy: entity.invitedBy,
    invitedAt: entity.invitedAt,
    expiresAt: entity.expiresAt,
    acceptedAt: entity.acceptedAt,
    declinedAt: entity.declinedAt,
    token: entity.token,
    personalMessage: entity.personalMessage,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

// Helper to convert Invitation to Table entity
function invitationToEntity(invitation: any) {
  return {
    partitionKey: invitation.brigadeId,
    rowKey: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedBy: invitation.invitedBy,
    invitedAt: invitation.invitedAt,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    declinedAt: invitation.declinedAt,
    token: invitation.token,
    personalMessage: invitation.personalMessage,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

// Helper to convert Membership to Table entity
function membershipToEntity(membership: any) {
  return {
    partitionKey: membership.brigadeId,
    rowKey: membership.id,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    invitedBy: membership.invitedBy,
    invitedAt: membership.invitedAt,
    approvedBy: membership.approvedBy,
    approvedAt: membership.approvedAt,
    joinedAt: membership.joinedAt,
    removedAt: membership.removedAt,
    removedBy: membership.removedBy,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

// Helper to find invitation by token
async function findInvitationByToken(client: TableClient, token: string): Promise<any> {
  const entities = client.listEntities({
    queryOptions: { filter: `token eq '${token}'` }
  });

  for await (const entity of entities) {
    return entityToInvitation(entity);
  }

  return null;
}

// GET /api/invitations/{token}
async function getInvitation(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const token = request.params.token;

    if (!token) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: token' }
      };
    }

    const client = await getInvitationsTableClient();
    const invitation = await findInvitationByToken(client, token);

    if (!invitation) {
      return {
        status: 404,
        jsonBody: { error: 'Invitation not found' }
      };
    }

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date() && invitation.status === 'pending') {
      invitation.status = 'expired';
      invitation.updatedAt = new Date().toISOString();
      await client.updateEntity(invitationToEntity(invitation), 'Replace');
    }

    context.log(`Retrieved invitation: ${invitation.id}`);

    return {
      status: 200,
      jsonBody: invitation
    };

  } catch (error: any) {
    context.error('Error retrieving invitation:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/invitations/{token}/accept
async function acceptInvitation(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const token = request.params.token;
    const acceptData = await request.json() as any;

    if (!token || !acceptData.userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: token, userId' }
      };
    }

    const invitationsClient = await getInvitationsTableClient();
    const membershipsClient = await getMembershipsTableClient();

    const invitation = await findInvitationByToken(invitationsClient, token);

    if (!invitation) {
      return {
        status: 404,
        jsonBody: { error: 'Invitation not found' }
      };
    }

    if (invitation.status !== 'pending') {
      return {
        status: 400,
        jsonBody: { error: `Invitation is ${invitation.status}, cannot accept` }
      };
    }

    // Check expiration
    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      invitation.updatedAt = new Date().toISOString();
      await invitationsClient.updateEntity(invitationToEntity(invitation), 'Replace');
      
      return {
        status: 400,
        jsonBody: { error: 'Invitation has expired' }
      };
    }

    // Accept invitation
    const now = new Date().toISOString();
    invitation.status = 'accepted';
    invitation.acceptedAt = now;
    invitation.updatedAt = now;

    await invitationsClient.updateEntity(invitationToEntity(invitation), 'Replace');

    // Create membership
    const membership = {
      id: `membership-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      brigadeId: invitation.brigadeId,
      userId: acceptData.userId,
      role: invitation.role,
      status: 'active',
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.invitedAt,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await membershipsClient.createEntity(membershipToEntity(membership));

    context.log(`Accepted invitation: ${invitation.id}, created membership for user: ${acceptData.userId}`);

    return {
      status: 200,
      jsonBody: {
        invitation,
        membership,
      }
    };

  } catch (error: any) {
    context.error('Error accepting invitation:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to accept invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/invitations/{token}/decline
async function declineInvitation(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const token = request.params.token;

    if (!token) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: token' }
      };
    }

    const client = await getInvitationsTableClient();
    const invitation = await findInvitationByToken(client, token);

    if (!invitation) {
      return {
        status: 404,
        jsonBody: { error: 'Invitation not found' }
      };
    }

    if (invitation.status !== 'pending') {
      return {
        status: 400,
        jsonBody: { error: `Invitation is ${invitation.status}, cannot decline` }
      };
    }

    // Decline invitation
    const now = new Date().toISOString();
    invitation.status = 'declined';
    invitation.declinedAt = now;
    invitation.updatedAt = now;

    await client.updateEntity(invitationToEntity(invitation), 'Replace');

    context.log(`Declined invitation: ${invitation.id}`);

    return {
      status: 200,
      jsonBody: invitation
    };

  } catch (error: any) {
    context.error('Error declining invitation:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to decline invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// DELETE /api/invitations/{invitationId}?brigadeId=xxx
async function cancelInvitation(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const invitationId = request.params.invitationId;
    const brigadeId = request.query.get('brigadeId');

    if (!invitationId || !brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: invitationId, brigadeId' }
      };
    }

    const client = await getInvitationsTableClient();
    
    // Get invitation to check status
    const entity = await client.getEntity(brigadeId, invitationId);
    const invitation = entityToInvitation(entity);

    if (invitation.status !== 'pending') {
      return {
        status: 400,
        jsonBody: { error: `Invitation is ${invitation.status}, cannot cancel` }
      };
    }

    // Mark as cancelled
    invitation.status = 'cancelled';
    invitation.updatedAt = new Date().toISOString();
    await client.updateEntity(invitationToEntity(invitation), 'Replace');

    context.log(`Cancelled invitation: ${invitationId}`);

    return {
      status: 200,
      jsonBody: { message: 'Invitation cancelled successfully' }
    };

  } catch (error: any) {
    context.error('Error cancelling invitation:', error);

    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Invitation not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to cancel invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('invitations-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invitations/{token}',
  handler: getInvitation
});

app.http('invitations-accept', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invitations/{token}/accept',
  handler: acceptInvitation
});

app.http('invitations-decline', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invitations/{token}/decline',
  handler: declineInvitation
});

app.http('invitations-cancel', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'invitations/{invitationId}',
  handler: cancelInvitation
});
