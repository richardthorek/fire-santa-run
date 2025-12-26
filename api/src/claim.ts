/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/brigades/{brigadeId}/claim - Brigade Claiming API
 * 
 * Handles the claiming of unclaimed brigades by users.
 * Users can claim a brigade if they have a .gov.au email OR approved verification.
 * 
 * Endpoints:
 * - POST /api/brigades/{brigadeId}/claim - Claim unclaimed brigade
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

// Get Azure Storage credentials
const STORAGE_CONNECTION_STRING = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING || '';

// Determine table name based on environment
const isDevMode = process.env.VITE_DEV_MODE === 'true';
const BRIGADES_TABLE = isDevMode ? 'devbrigades' : 'brigades';
const MEMBERSHIPS_TABLE = isDevMode ? 'devmemberships' : 'memberships';
const USERS_TABLE = isDevMode ? 'devusers' : 'users';

function getBrigadesTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, BRIGADES_TABLE);
}

function getMembershipsTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, MEMBERSHIPS_TABLE);
}

function getUsersTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, USERS_TABLE);
}

// Helper to convert Table entity to Brigade object
function entityToBrigade(entity: any) {
  return {
    id: entity.rowKey,
    name: entity.name,
    location: entity.location,
    contactEmail: entity.contactEmail,
    contactPhone: entity.contactPhone,
    allowedDomains: entity.allowedDomains ? JSON.parse(entity.allowedDomains) : [],
    adminUserIds: entity.adminUserIds ? JSON.parse(entity.adminUserIds) : [],
    isClaimed: entity.isClaimed === true,
    claimedAt: entity.claimedAt,
    claimedBy: entity.claimedBy,
    requireManualApproval: entity.requireManualApproval === true,
    rfsStationId: entity.rfsStationId,
    createdAt: entity.createdAt,
  };
}

// Helper to convert Brigade to Table entity
function brigadeToEntity(brigade: any) {
  return {
    partitionKey: brigade.id,
    rowKey: brigade.id,
    name: brigade.name,
    location: brigade.location,
    contactEmail: brigade.contactEmail,
    contactPhone: brigade.contactPhone,
    allowedDomains: JSON.stringify(brigade.allowedDomains || []),
    adminUserIds: JSON.stringify(brigade.adminUserIds || []),
    isClaimed: brigade.isClaimed,
    claimedAt: brigade.claimedAt,
    claimedBy: brigade.claimedBy,
    requireManualApproval: brigade.requireManualApproval,
    rfsStationId: brigade.rfsStationId,
    createdAt: brigade.createdAt,
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

// POST /api/brigades/{brigadeId}/claim
async function claimBrigade(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const brigadeId = request.params.brigadeId;
    const claimData = await request.json() as any;

    if (!brigadeId || !claimData.userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: brigadeId, userId' }
      };
    }

    const brigadesClient = getBrigadesTableClient();
    const membershipsClient = getMembershipsTableClient();
    const usersClient = getUsersTableClient();

    // Get brigade
    const brigadeEntity = await brigadesClient.getEntity(brigadeId, brigadeId);
    const brigade = entityToBrigade(brigadeEntity);

    // Check if already claimed
    if (brigade.isClaimed) {
      return {
        status: 409,
        jsonBody: { error: 'Brigade is already claimed' }
      };
    }

    // Get user
    const userEntity = await usersClient.getEntity(claimData.userId, claimData.userId);
    const user = {
      id: userEntity.rowKey as string,
      email: userEntity.email as string,
      verifiedBrigades: userEntity.verifiedBrigades ? JSON.parse(userEntity.verifiedBrigades as string) : [],
    };

    // Check eligibility: .gov.au email OR approved verification for this brigade
    const hasGovEmail = user.email.endsWith('.gov.au');
    const hasApprovedVerification = user.verifiedBrigades.includes(brigadeId);

    if (!hasGovEmail && !hasApprovedVerification) {
      return {
        status: 403,
        jsonBody: { 
          error: 'Not authorized to claim this brigade. Requires .gov.au email or approved verification.' 
        }
      };
    }

    // Claim brigade
    const now = new Date().toISOString();
    brigade.isClaimed = true;
    brigade.claimedAt = now;
    brigade.claimedBy = claimData.userId;
    brigade.adminUserIds = [claimData.userId];

    // Update brigade
    await brigadesClient.updateEntity(brigadeToEntity(brigade), 'Replace');

    // Create admin membership
    const membership = {
      id: `membership-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      brigadeId,
      userId: claimData.userId,
      role: 'admin',
      status: 'active',
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await membershipsClient.createEntity(membershipToEntity(membership));

    context.log(`Brigade ${brigadeId} claimed by user: ${claimData.userId}`);

    return {
      status: 200,
      jsonBody: {
        brigade,
        membership,
      }
    };

  } catch (error: any) {
    context.error('Error claiming brigade:', error);

    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Brigade or user not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to claim brigade',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoint
app.http('brigade-claim', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'brigades/{brigadeId}/claim',
  handler: claimBrigade
});
