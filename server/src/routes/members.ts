/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken, checkBrigadePermission } from '../utils/auth.js';
import { shouldAutoApprove } from '../utils/emailValidation.js';

const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';
const INVITATIONS_TABLE = isDevMode ? 'dev-invitations' : 'invitations';
const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getMembershipsTableClient() {
  return getTableClient(MEMBERSHIPS_TABLE);
}

async function getInvitationsTableClient() {
  return getTableClient(INVITATIONS_TABLE);
}

function entityToMembership(entity: any) {
  return {
    id: entity.rowKey,
    brigadeId: entity.partitionKey,
    userId: entity.userId,
    role: entity.role,
    status: entity.status,
    invitedBy: entity.invitedBy,
    invitedAt: entity.invitedAt,
    approvedBy: entity.approvedBy,
    approvedAt: entity.approvedAt,
    joinedAt: entity.joinedAt,
    removedAt: entity.removedAt,
    removedBy: entity.removedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
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

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function getUserMembership(userId: string, brigadeId: string): Promise<any> {
  const client = await getMembershipsTableClient();
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` }
  });
  for await (const entity of entities) {
    return entityToMembership(entity);
  }
  return null;
}

async function getBrigadeDetails(brigadeId: string): Promise<any> {
  const client = await getTableClient(BRIGADES_TABLE);
  try {
    const entity = await client.getEntity(brigadeId, brigadeId);
    return {
      id: entity.rowKey,
      name: entity.name,
      allowedDomains: entity.allowedDomains ? JSON.parse(entity.allowedDomains as string) : [],
      allowedEmails: entity.allowedEmails ? JSON.parse(entity.allowedEmails as string) : [],
    };
  } catch (error: any) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export const membersRouter = new Hono();

// GET / - list brigade members
membersRouter.get('/', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }

    const brigadeId = c.req.param('brigadeId');
    if (!brigadeId) {
      return c.json({ error: 'Missing required parameter: brigadeId' }, 400);
    }

    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'view_members', getUserMembership);
    if (!permissionCheck.authorized) {
      return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}'` } });

    const members = [];
    for await (const entity of entities) {
      members.push(entityToMembership(entity));
    }

    console.log(`Retrieved ${members.length} members for brigade: ${brigadeId}`);
    return c.json(members, 200);
  } catch (error: any) {
    console.error('Error retrieving brigade members:', error);
    return c.json({ error: 'Failed to retrieve brigade members', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// GET /pending - must be before /:userId
membersRouter.get('/pending', async (c) => {
  try {
    const brigadeId = c.req.param('brigadeId');
    if (!brigadeId) {
      return c.json({ error: 'Missing required parameter: brigadeId' }, 400);
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and status eq 'pending'` }
    });

    const pendingMembers = [];
    for await (const entity of entities) {
      pendingMembers.push(entityToMembership(entity));
    }

    console.log(`Retrieved ${pendingMembers.length} pending members for brigade: ${brigadeId}`);
    return c.json(pendingMembers, 200);
  } catch (error: any) {
    console.error('Error retrieving pending members:', error);
    return c.json({ error: 'Failed to retrieve pending members', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /invite
membersRouter.post('/invite', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }

    const brigadeId = c.req.param('brigadeId');
    const invitationData = await c.req.json();

    if (!brigadeId || !invitationData.email || !invitationData.invitedBy) {
      return c.json({ error: 'Missing required fields: brigadeId, email, invitedBy' }, 400);
    }

    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'invite_members', getUserMembership);
    if (!permissionCheck.authorized) {
      return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    }

    const brigade = await getBrigadeDetails(brigadeId);
    const autoApprove = brigade ? shouldAutoApprove(invitationData.email, brigade) : false;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invitation = {
      id: `invitation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      brigadeId,
      email: invitationData.email,
      role: invitationData.role || 'operator',
      status: 'pending',
      invitedBy: invitationData.invitedBy,
      invitedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      token: generateToken(),
      personalMessage: invitationData.personalMessage,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const client = await getInvitationsTableClient();
    await client.createEntity(invitationToEntity(invitation));

    console.log(`Created invitation for ${invitationData.email} to brigade: ${brigadeId} (auto-approve: ${autoApprove})`);
    return c.json({ ...invitation, autoApprove }, 201);
  } catch (error: any) {
    console.error('Error creating invitation:', error);
    if (error.statusCode === 409) {
      return c.json({ error: 'Invitation already exists' }, 409);
    }
    return c.json({ error: 'Failed to create invitation', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /:userId/approve - must be before DELETE /:userId
membersRouter.post('/:userId/approve', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }

    const brigadeId = c.req.param('brigadeId');
    const userId = c.req.param('userId');
    const { approvedBy } = await c.req.json();

    if (!brigadeId || !userId || !approvedBy) {
      return c.json({ error: 'Missing required parameters: brigadeId, userId, approvedBy' }, 400);
    }

    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'approve_members', getUserMembership);
    if (!permissionCheck.authorized) {
      return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` }
    });

    let membership = null;
    for await (const entity of entities) {
      membership = entityToMembership(entity);
      break;
    }

    if (!membership) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    if (membership.status !== 'pending') {
      return c.json({ error: 'Membership is not pending approval' }, 400);
    }

    const now = new Date().toISOString();
    membership.status = 'active';
    membership.approvedBy = approvedBy;
    membership.approvedAt = now;
    membership.joinedAt = now;
    membership.updatedAt = now;

    await client.updateEntity(membershipToEntity(membership), 'Replace');

    console.log(`Approved member ${userId} for brigade: ${brigadeId}`);
    return c.json(membership, 200);
  } catch (error: any) {
    console.error('Error approving member:', error);
    return c.json({ error: 'Failed to approve member', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// PATCH /:userId/role
membersRouter.patch('/:userId/role', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }

    const brigadeId = c.req.param('brigadeId');
    const userId = c.req.param('userId');
    const { role } = await c.req.json();

    if (!brigadeId || !userId || !role) {
      return c.json({ error: 'Missing required parameters: brigadeId, userId, role' }, 400);
    }

    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role. Must be: admin, operator, or viewer' }, 400);
    }

    const requiredPermission = role === 'admin' ? 'promote_admin' : 'manage_members';
    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, requiredPermission, getUserMembership);
    if (!permissionCheck.authorized) {
      return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` }
    });

    let membership = null;
    for await (const entity of entities) {
      membership = entityToMembership(entity);
      break;
    }

    if (!membership) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    membership.role = role;
    membership.updatedAt = new Date().toISOString();

    await client.updateEntity(membershipToEntity(membership), 'Replace');

    console.log(`Changed role for member ${userId} in brigade ${brigadeId} to: ${role} by user: ${authResult.userId}`);
    return c.json(membership, 200);
  } catch (error: any) {
    console.error('Error changing member role:', error);
    return c.json({ error: 'Failed to change member role' }, 500);
  }
});

// DELETE /:userId
membersRouter.delete('/:userId', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }

    const brigadeId = c.req.param('brigadeId');
    const userId = c.req.param('userId');

    if (!brigadeId || !userId) {
      return c.json({ error: 'Missing required parameters: brigadeId, userId' }, 400);
    }

    const permissionCheck = await checkBrigadePermission(authResult.userId!, brigadeId, 'remove_members', getUserMembership);
    if (!permissionCheck.authorized) {
      return c.json({ error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }, 403);
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` }
    });

    let membershipId = null;
    for await (const entity of entities) {
      membershipId = entity.rowKey as string;
      break;
    }

    if (!membershipId) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    await client.deleteEntity(brigadeId, membershipId);

    console.log(`Removed member ${userId} from brigade: ${brigadeId} by user: ${authResult.userId}`);
    return c.json({ message: 'Member removed successfully' }, 200);
  } catch (error: any) {
    console.error('Error removing member:', error);
    return c.json({ error: 'Failed to remove member', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
