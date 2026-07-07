/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { TableClient } from '@azure/data-tables';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken } from '../utils/auth.js';

const INVITATIONS_TABLE = isDevMode ? 'dev-invitations' : 'invitations';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getInvitationsTableClient(): Promise<TableClient> {
  return getTableClient(INVITATIONS_TABLE);
}

async function getMembershipsTableClient(): Promise<TableClient> {
  return getTableClient(MEMBERSHIPS_TABLE);
}

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

async function findInvitationByToken(client: TableClient, token: string): Promise<any> {
  const entities = client.listEntities({
    queryOptions: { filter: `token eq '${escapeODataValue(token)}'` }
  });
  for await (const entity of entities) {
    return entityToInvitation(entity);
  }
  return null;
}

export const invitationsRouter = new Hono<{ Variables: { userId?: string } }>();

// Accepting an invitation creates a brigade membership, and cancelling one is a
// management action — both require a signed-in user. Requiring auth also stops
// anonymous callers from probing invitation tokens.
invitationsRouter.use('*', async (c, next) => {
  const authResult = await validateToken(c.req.raw);
  if (!authResult.authenticated) {
    return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
  }
  c.set('userId', authResult.userId);
  await next();
});

// GET /:token
invitationsRouter.get('/:token', async (c) => {
  try {
    const token = c.req.param('token');
    if (!token) {
      return c.json({ error: 'Missing required parameter: token' }, 400);
    }

    const client = await getInvitationsTableClient();
    const invitation = await findInvitationByToken(client, token);

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (new Date(invitation.expiresAt) < new Date() && invitation.status === 'pending') {
      invitation.status = 'expired';
      invitation.updatedAt = new Date().toISOString();
      await client.updateEntity(invitationToEntity(invitation), 'Replace');
    }

    console.log(`Retrieved invitation: ${invitation.id}`);
    return c.json(invitation, 200);
  } catch (error: any) {
    console.error('Error retrieving invitation:', error);
    return c.json({ error: 'Failed to retrieve invitation', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /:token/accept
invitationsRouter.post('/:token/accept', async (c) => {
  try {
    const token = c.req.param('token');
    const acceptData = await c.req.json();

    if (!token || !acceptData.userId) {
      return c.json({ error: 'Missing required fields: token, userId' }, 400);
    }

    if (acceptData.userId !== c.get('userId')) {
      return c.json({ error: 'Forbidden', message: 'You can only accept an invitation for your own account' }, 403);
    }

    const invitationsClient = await getInvitationsTableClient();
    const membershipsClient = await getMembershipsTableClient();
    const invitation = await findInvitationByToken(invitationsClient, token);

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.status !== 'pending') {
      return c.json({ error: `Invitation is ${invitation.status}, cannot accept` }, 400);
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      invitation.updatedAt = new Date().toISOString();
      await invitationsClient.updateEntity(invitationToEntity(invitation), 'Replace');
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    const now = new Date().toISOString();
    invitation.status = 'accepted';
    invitation.acceptedAt = now;
    invitation.updatedAt = now;
    await invitationsClient.updateEntity(invitationToEntity(invitation), 'Replace');

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

    console.log(`Accepted invitation: ${invitation.id}, created membership for user: ${acceptData.userId}`);
    return c.json({ invitation, membership }, 200);
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: 'Failed to accept invitation', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /:token/decline
invitationsRouter.post('/:token/decline', async (c) => {
  try {
    const token = c.req.param('token');
    if (!token) {
      return c.json({ error: 'Missing required parameter: token' }, 400);
    }

    const client = await getInvitationsTableClient();
    const invitation = await findInvitationByToken(client, token);

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.status !== 'pending') {
      return c.json({ error: `Invitation is ${invitation.status}, cannot decline` }, 400);
    }

    const now = new Date().toISOString();
    invitation.status = 'declined';
    invitation.declinedAt = now;
    invitation.updatedAt = now;
    await client.updateEntity(invitationToEntity(invitation), 'Replace');

    console.log(`Declined invitation: ${invitation.id}`);
    return c.json(invitation, 200);
  } catch (error: any) {
    console.error('Error declining invitation:', error);
    return c.json({ error: 'Failed to decline invitation', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// DELETE /:invitationId
invitationsRouter.delete('/:invitationId', async (c) => {
  try {
    const invitationId = c.req.param('invitationId');
    const brigadeId = c.req.query('brigadeId');

    if (!invitationId || !brigadeId) {
      return c.json({ error: 'Missing required parameters: invitationId, brigadeId' }, 400);
    }

    const client = await getInvitationsTableClient();
    const entity = await client.getEntity(brigadeId, invitationId);
    const invitation = entityToInvitation(entity);

    if (invitation.status !== 'pending') {
      return c.json({ error: `Invitation is ${invitation.status}, cannot cancel` }, 400);
    }

    invitation.status = 'cancelled';
    invitation.updatedAt = new Date().toISOString();
    await client.updateEntity(invitationToEntity(invitation), 'Replace');

    console.log(`Cancelled invitation: ${invitationId}`);
    return c.json({ message: 'Invitation cancelled successfully' }, 200);
  } catch (error: any) {
    console.error('Error cancelling invitation:', error);
    if (error.statusCode === 404) {
      return c.json({ error: 'Invitation not found' }, 404);
    }
    return c.json({ error: 'Failed to cancel invitation', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
