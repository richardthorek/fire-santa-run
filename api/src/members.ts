/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/brigades/{brigadeId}/members - Brigade Members API
 * 
 * Handles brigade membership management operations.
 * Memberships are stored in Azure Table Storage with brigadeId as partition key.
 * 
 * Endpoints:
 * - GET /api/brigades/{brigadeId}/members - List brigade members
 * - POST /api/brigades/{brigadeId}/members/invite - Invite member
 * - DELETE /api/brigades/{brigadeId}/members/{userId} - Remove member
 * - PATCH /api/brigades/{brigadeId}/members/{userId}/role - Change role
 * - GET /api/brigades/{brigadeId}/members/pending - Pending approvals
 * - POST /api/brigades/{brigadeId}/members/{userId}/approve - Approve member
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateToken, checkBrigadePermission } from './utils/auth';
import { shouldAutoApprove } from './utils/emailValidation';
import { getTableClient, isDevMode } from './utils/storage';

const MEMBERSHIPS_TABLE = isDevMode ? 'devmemberships' : 'memberships';
const INVITATIONS_TABLE = isDevMode ? 'devinvitations' : 'invitations';
const USERS_TABLE = isDevMode ? 'devusers' : 'users';
const BRIGADES_TABLE = isDevMode ? 'devbrigades' : 'brigades';

async function getMembershipsTableClient() {
  return getTableClient(MEMBERSHIPS_TABLE);
}

async function getInvitationsTableClient() {
  return getTableClient(INVITATIONS_TABLE);
}

async function getUsersTableClient() {
  return getTableClient(USERS_TABLE);
}

// Helper to convert Table entity to Membership object
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

// Helper to generate random token
function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper to get user's membership in a brigade
async function getUserMembership(userId: string, brigadeId: string): Promise<any> {
  const client = await getMembershipsTableClient();
  const entities = client.listEntities({
    queryOptions: { 
      filter: `PartitionKey eq '${brigadeId}' and userId eq '${userId}'` 
    }
  });

  for await (const entity of entities) {
    return entityToMembership(entity);
  }

  return null;
}

// Helper to get brigade details
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
    if (error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// GET /api/brigades/{brigadeId}/members
async function getBrigadeMembers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const brigadeId = request.params.brigadeId;

    if (!brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: brigadeId' }
      };
    }

    // Check brigade permission
    const permissionCheck = await checkBrigadePermission(
      authResult.userId!,
      brigadeId,
      'view_members',
      getUserMembership
    );

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}'` }
    });

    const members = [];
    for await (const entity of entities) {
      members.push(entityToMembership(entity));
    }

    context.log(`Retrieved ${members.length} members for brigade: ${brigadeId}`);

    return {
      status: 200,
      jsonBody: members
    };

  } catch (error: any) {
    context.error('Error retrieving brigade members:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve brigade members',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/brigades/{brigadeId}/members/invite
async function inviteMember(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const brigadeId = request.params.brigadeId;
    const invitationData = await request.json() as any;

    if (!brigadeId || !invitationData.email || !invitationData.invitedBy) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: brigadeId, email, invitedBy' }
      };
    }

    // Check brigade permission
    const permissionCheck = await checkBrigadePermission(
      authResult.userId!,
      brigadeId,
      'invite_members',
      getUserMembership
    );

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    // Get brigade details for domain whitelist checking
    const brigade = await getBrigadeDetails(brigadeId);
    
    // Check if email should be auto-approved
    const autoApprove = brigade ? shouldAutoApprove(invitationData.email, brigade) : false;

    // Generate invitation
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

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
    const entity = invitationToEntity(invitation);

    await client.createEntity(entity);

    context.log(`Created invitation for ${invitationData.email} to brigade: ${brigadeId} (auto-approve: ${autoApprove})`);

    return {
      status: 201,
      jsonBody: { ...invitation, autoApprove }
    };

  } catch (error: any) {
    context.error('Error creating invitation:', error);

    if (error.statusCode === 409) {
      return {
        status: 409,
        jsonBody: { error: 'Invitation already exists' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to create invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// DELETE /api/brigades/{brigadeId}/members/{userId}
async function removeMember(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const brigadeId = request.params.brigadeId;
    const userId = request.params.userId;

    if (!brigadeId || !userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: brigadeId, userId' }
      };
    }

    // Check brigade permission
    const permissionCheck = await checkBrigadePermission(
      authResult.userId!,
      brigadeId,
      'remove_members',
      getUserMembership
    );

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    const client = await getMembershipsTableClient();
    
    // Find the membership
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}' and userId eq '${userId}'` }
    });

    let membershipId = null;
    for await (const entity of entities) {
      membershipId = entity.rowKey as string;
      break;
    }

    if (!membershipId) {
      return {
        status: 404,
        jsonBody: { error: 'Membership not found' }
      };
    }

    await client.deleteEntity(brigadeId, membershipId);

    context.log(`Removed member ${userId} from brigade: ${brigadeId} by user: ${authResult.userId}`);

    return {
      status: 200,
      jsonBody: { message: 'Member removed successfully' }
    };

  } catch (error: any) {
    context.error('Error removing member:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to remove member',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// PATCH /api/brigades/{brigadeId}/members/{userId}/role
async function changeMemberRole(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const brigadeId = request.params.brigadeId;
    const userId = request.params.userId;
    const { role } = await request.json() as any;

    if (!brigadeId || !userId || !role) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: brigadeId, userId, role' }
      };
    }

    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid role. Must be: admin, operator, or viewer' }
      };
    }

    // Check brigade permission - need different permissions for promoting/demoting admins
    const requiredPermission = role === 'admin' ? 'promote_admin' : 'manage_members';
    const permissionCheck = await checkBrigadePermission(
      authResult.userId!,
      brigadeId,
      requiredPermission,
      getUserMembership
    );

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    const client = await getMembershipsTableClient();
    
    // Find the membership
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}' and userId eq '${userId}'` }
    });

    let membership = null;
    for await (const entity of entities) {
      membership = entityToMembership(entity);
      break;
    }

    if (!membership) {
      return {
        status: 404,
        jsonBody: { error: 'Membership not found' }
      };
    }

    // Update role
    membership.role = role;
    membership.updatedAt = new Date().toISOString();

    const entity = membershipToEntity(membership);
    await client.updateEntity(entity, 'Replace');

    context.log(`Changed role for member ${userId} in brigade ${brigadeId} to: ${role} by user: ${authResult.userId}`);

    return {
      status: 200,
      jsonBody: membership
    };

  } catch (error: any) {
    context.error('Error changing member role:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to change member role'
      }
    };
  }
}

// GET /api/brigades/{brigadeId}/members/pending
async function getPendingMembers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.params.brigadeId;

    if (!brigadeId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: brigadeId' }
      };
    }

    const client = await getMembershipsTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}' and status eq 'pending'` }
    });

    const pendingMembers = [];
    for await (const entity of entities) {
      pendingMembers.push(entityToMembership(entity));
    }

    context.log(`Retrieved ${pendingMembers.length} pending members for brigade: ${brigadeId}`);

    return {
      status: 200,
      jsonBody: pendingMembers
    };

  } catch (error: any) {
    context.error('Error retrieving pending members:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve pending members',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/brigades/{brigadeId}/members/{userId}/approve
async function approveMember(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Validate authentication
    const authResult = await validateToken(request);
    if (!authResult.authenticated) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: authResult.error || 'Authentication required' }
      };
    }

    const brigadeId = request.params.brigadeId;
    const userId = request.params.userId;
    const { approvedBy } = await request.json() as any;

    if (!brigadeId || !userId || !approvedBy) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: brigadeId, userId, approvedBy' }
      };
    }

    // Check brigade permission
    const permissionCheck = await checkBrigadePermission(
      authResult.userId!,
      brigadeId,
      'approve_members',
      getUserMembership
    );

    if (!permissionCheck.authorized) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: permissionCheck.error || 'Insufficient permissions' }
      };
    }

    const client = await getMembershipsTableClient();
    
    // Find the membership
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${brigadeId}' and userId eq '${userId}'` }
    });

    let membership = null;
    for await (const entity of entities) {
      membership = entityToMembership(entity);
      break;
    }

    if (!membership) {
      return {
        status: 404,
        jsonBody: { error: 'Membership not found' }
      };
    }

    if (membership.status !== 'pending') {
      return {
        status: 400,
        jsonBody: { error: 'Membership is not pending approval' }
      };
    }

    // Approve membership
    const now = new Date().toISOString();
    membership.status = 'active';
    membership.approvedBy = approvedBy;
    membership.approvedAt = now;
    membership.joinedAt = now;
    membership.updatedAt = now;

    const entity = membershipToEntity(membership);
    await client.updateEntity(entity, 'Replace');

    context.log(`Approved member ${userId} for brigade: ${brigadeId}`);

    return {
      status: 200,
      jsonBody: membership
    };

  } catch (error: any) {
    context.error('Error approving member:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to approve member',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('members-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/members',
  handler: getBrigadeMembers
});

app.http('members-invite', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/members/invite',
  handler: inviteMember
});

app.http('members-remove', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/members/{userId}',
  handler: removeMember
});

app.http('members-change-role', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/members/{userId}/role',
  handler: changeMemberRole
});

app.http('members-pending', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/members/pending',
  handler: getPendingMembers
});

app.http('members-approve', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/members/{userId}/approve',
  handler: approveMember
});
