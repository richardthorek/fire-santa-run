/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken } from '../utils/auth.js';

const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';
const USERS_TABLE = isDevMode ? 'dev-users' : 'users';

async function getBrigadesTableClient() {
  return getTableClient(BRIGADES_TABLE);
}

async function getMembershipsTableClient() {
  return getTableClient(MEMBERSHIPS_TABLE);
}

async function getUsersTableClient() {
  return getTableClient(USERS_TABLE);
}

function entityToBrigade(entity: any) {
  return {
    id: entity.rowKey,
    slug: entity.slug,
    name: entity.name,
    location: entity.location,
    contact: entity.contact ? JSON.parse(entity.contact) : {},
    contactEmail: entity.contactEmail,
    contactPhone: entity.contactPhone,
    allowedDomains: entity.allowedDomains ? JSON.parse(entity.allowedDomains) : [],
    allowedEmails: entity.allowedEmails ? JSON.parse(entity.allowedEmails) : [],
    adminUserIds: entity.adminUserIds ? JSON.parse(entity.adminUserIds) : [],
    isClaimed: entity.isClaimed === true,
    claimedAt: entity.claimedAt,
    claimedBy: entity.claimedBy,
    requireManualApproval: entity.requireManualApproval === true,
    rfsStationId: entity.rfsStationId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    logo: entity.logo,
    themeColor: entity.themeColor,
  };
}

function brigadeToEntity(brigade: any) {
  return {
    partitionKey: brigade.id,
    rowKey: brigade.id,
    slug: brigade.slug,
    name: brigade.name,
    location: brigade.location,
    contact: brigade.contact ? JSON.stringify(brigade.contact) : JSON.stringify({}),
    contactEmail: brigade.contact?.email || brigade.contactEmail,
    contactPhone: brigade.contact?.phone || brigade.contactPhone,
    allowedDomains: JSON.stringify(brigade.allowedDomains || []),
    allowedEmails: JSON.stringify(brigade.allowedEmails || []),
    adminUserIds: JSON.stringify(brigade.adminUserIds || []),
    isClaimed: brigade.isClaimed,
    claimedAt: brigade.claimedAt,
    claimedBy: brigade.claimedBy,
    requireManualApproval: brigade.requireManualApproval,
    rfsStationId: brigade.rfsStationId,
    createdAt: brigade.createdAt,
    updatedAt: brigade.updatedAt,
    logo: brigade.logo || '',
    themeColor: brigade.themeColor || '',
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

export const claimRouter = new Hono();

// POST /claim
claimRouter.post('/claim', async (c) => {
  try {
    const authResult = await validateToken(c.req.raw);
    if (!authResult.authenticated) {
      return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
    }

    const brigadeId = c.req.param('brigadeId');
    const claimData = await c.req.json();

    if (!brigadeId || !claimData.userId) {
      return c.json({ error: 'Missing required fields: brigadeId, userId' }, 400);
    }

    // A user may only claim a brigade as themselves — never on behalf of another
    // account whose email/verification happens to satisfy the eligibility check.
    if (claimData.userId !== authResult.userId) {
      return c.json({ error: 'Forbidden', message: 'You can only claim a brigade for your own account' }, 403);
    }

    const brigadesClient = await getBrigadesTableClient();
    const membershipsClient = await getMembershipsTableClient();
    const usersClient = await getUsersTableClient();

    const brigadeEntity = await brigadesClient.getEntity(brigadeId, brigadeId);
    const brigade = entityToBrigade(brigadeEntity);

    if (brigade.isClaimed) {
      return c.json({ error: 'Brigade is already claimed' }, 409);
    }

    const userEntity = await usersClient.getEntity(claimData.userId, claimData.userId);
    const user = {
      id: userEntity.rowKey as string,
      email: userEntity.email as string,
      verifiedBrigades: userEntity.verifiedBrigades ? JSON.parse(userEntity.verifiedBrigades as string) : [],
    };

    const hasGovEmail = user.email.endsWith('.gov.au');
    const hasApprovedVerification = user.verifiedBrigades.includes(brigadeId);

    if (!hasGovEmail && !hasApprovedVerification) {
      return c.json({ error: 'Not authorized to claim this brigade. Requires .gov.au email or approved verification.' }, 403);
    }

    const now = new Date().toISOString();
    brigade.isClaimed = true;
    brigade.claimedAt = now;
    brigade.claimedBy = claimData.userId;
    brigade.adminUserIds = [claimData.userId];
    brigade.updatedAt = now;

    await brigadesClient.updateEntity(brigadeToEntity(brigade), 'Replace');

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

    // Set the user's brigadeId so BrigadeContext can load it automatically
    userEntity.brigadeId = brigadeId;
    // partitionKey and rowKey are guaranteed to exist on retrieved entities
    await usersClient.updateEntity({
      ...userEntity,
      partitionKey: userEntity.partitionKey!,
      rowKey: userEntity.rowKey!,
    }, 'Replace');

    console.log(`Brigade ${brigadeId} claimed by user: ${claimData.userId}`);
    return c.json({ brigade, membership }, 200);
  } catch (error: any) {
    console.error('Error claiming brigade:', error);
    if (error.statusCode === 404) {
      return c.json({ error: 'Brigade or user not found' }, 404);
    }
    return c.json({ error: 'Failed to claim brigade', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
