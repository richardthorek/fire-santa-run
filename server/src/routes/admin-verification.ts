/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { TableClient } from '@azure/data-tables';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken, isSiteAdmin } from '../utils/auth.js';

const VERIFICATION_TABLE = isDevMode ? 'dev-verificationrequests' : 'verificationrequests';
const USERS_TABLE = isDevMode ? 'dev-users' : 'users';

async function getVerificationTableClient(): Promise<TableClient> {
  return getTableClient(VERIFICATION_TABLE);
}

async function getUsersTableClient(): Promise<TableClient> {
  return getTableClient(USERS_TABLE);
}

function entityToVerificationRequest(entity: any) {
  return {
    id: entity.rowKey,
    userId: entity.partitionKey,
    brigadeId: entity.brigadeId,
    email: entity.email,
    evidenceFiles: entity.evidenceFiles ? JSON.parse(entity.evidenceFiles) : [],
    explanation: entity.explanation,
    status: entity.status,
    reviewedBy: entity.reviewedBy,
    reviewedAt: entity.reviewedAt,
    reviewNotes: entity.reviewNotes,
    submittedAt: entity.submittedAt,
    expiresAt: entity.expiresAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function verificationRequestToEntity(request: any) {
  return {
    partitionKey: request.userId,
    rowKey: request.id,
    brigadeId: request.brigadeId,
    email: request.email,
    evidenceFiles: JSON.stringify(request.evidenceFiles || []),
    explanation: request.explanation,
    status: request.status,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    reviewNotes: request.reviewNotes,
    submittedAt: request.submittedAt,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export const adminVerificationRouter = new Hono();

// Every route here reviews or approves brigade-membership verification — a
// site-admin-only capability. Approving a request grants a user the ability to
// claim a brigade as admin, so this must never be reachable anonymously.
adminVerificationRouter.use('*', async (c, next) => {
  const authResult = await validateToken(c.req.raw);
  if (!authResult.authenticated) {
    return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);
  }
  if (!isSiteAdmin(authResult.userId)) {
    return c.json({ error: 'Forbidden', message: 'Site administrator access required' }, 403);
  }
  await next();
});

// GET /pending
adminVerificationRouter.get('/pending', async (c) => {
  try {
    const client = await getVerificationTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `status eq 'pending'` }
    });

    const pendingRequests = [];
    for await (const entity of entities) {
      const verificationRequest = entityToVerificationRequest(entity);

      if (new Date(verificationRequest.expiresAt) < new Date()) {
        verificationRequest.status = 'expired';
        verificationRequest.updatedAt = new Date().toISOString();
        await client.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');
      } else {
        pendingRequests.push(verificationRequest);
      }
    }

    console.log(`Retrieved ${pendingRequests.length} pending verification requests`);
    return c.json(pendingRequests, 200);
  } catch (error: any) {
    console.error('Error retrieving pending verifications:', error);
    return c.json({ error: 'Failed to retrieve pending verifications', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// GET /requests/:requestId
adminVerificationRouter.get('/requests/:requestId', async (c) => {
  try {
    const requestId = c.req.param('requestId');
    const userId = c.req.query('userId');

    if (!requestId || !userId) {
      return c.json({ error: 'Missing required parameters: requestId, userId' }, 400);
    }

    const client = await getVerificationTableClient();
    const entity = await client.getEntity(userId, requestId);

    console.log(`Retrieved verification request details: ${requestId}`);
    return c.json(entityToVerificationRequest(entity), 200);
  } catch (error: any) {
    console.error('Error retrieving verification request details:', error);
    if (error.statusCode === 404) {
      return c.json({ error: 'Verification request not found' }, 404);
    }
    return c.json({ error: 'Failed to retrieve verification request details', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /requests/:requestId/approve
adminVerificationRouter.post('/requests/:requestId/approve', async (c) => {
  try {
    const requestId = c.req.param('requestId');
    const userId = c.req.query('userId');
    const approvalData = await c.req.json();

    if (!requestId || !userId || !approvalData.reviewedBy) {
      return c.json({ error: 'Missing required parameters: requestId, userId, reviewedBy' }, 400);
    }

    const verificationClient = await getVerificationTableClient();
    const usersClient = await getUsersTableClient();

    const entity = await verificationClient.getEntity(userId, requestId);
    const verificationRequest = entityToVerificationRequest(entity);

    if (verificationRequest.status !== 'pending') {
      return c.json({ error: `Verification request is ${verificationRequest.status}, cannot approve` }, 400);
    }

    if (new Date(verificationRequest.expiresAt) < new Date()) {
      verificationRequest.status = 'expired';
      verificationRequest.updatedAt = new Date().toISOString();
      await verificationClient.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');
      return c.json({ error: 'Verification request has expired' }, 400);
    }

    const now = new Date().toISOString();
    verificationRequest.status = 'approved';
    verificationRequest.reviewedBy = approvalData.reviewedBy;
    verificationRequest.reviewedAt = now;
    verificationRequest.reviewNotes = approvalData.reviewNotes;
    verificationRequest.updatedAt = now;

    await verificationClient.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');

    const userEntity = await usersClient.getEntity(userId, userId);
    const verifiedBrigades = userEntity.verifiedBrigades
      ? JSON.parse(userEntity.verifiedBrigades as string)
      : [];

    if (!verifiedBrigades.includes(verificationRequest.brigadeId)) {
      verifiedBrigades.push(verificationRequest.brigadeId);
      const updatedEntity = {
        partitionKey: userId,
        rowKey: userId,
        verifiedBrigades: JSON.stringify(verifiedBrigades),
      };
      await usersClient.updateEntity(updatedEntity, 'Merge');
    }

    console.log(`Approved verification request: ${requestId} for user: ${userId}`);
    return c.json(verificationRequest, 200);
  } catch (error: any) {
    console.error('Error approving verification:', error);
    if (error.statusCode === 404) {
      return c.json({ error: 'Verification request or user not found' }, 404);
    }
    return c.json({ error: 'Failed to approve verification', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /requests/:requestId/reject
adminVerificationRouter.post('/requests/:requestId/reject', async (c) => {
  try {
    const requestId = c.req.param('requestId');
    const userId = c.req.query('userId');
    const rejectionData = await c.req.json();

    if (!requestId || !userId || !rejectionData.reviewedBy) {
      return c.json({ error: 'Missing required parameters: requestId, userId, reviewedBy' }, 400);
    }

    const client = await getVerificationTableClient();
    const entity = await client.getEntity(userId, requestId);
    const verificationRequest = entityToVerificationRequest(entity);

    if (verificationRequest.status !== 'pending') {
      return c.json({ error: `Verification request is ${verificationRequest.status}, cannot reject` }, 400);
    }

    const now = new Date().toISOString();
    verificationRequest.status = 'rejected';
    verificationRequest.reviewedBy = rejectionData.reviewedBy;
    verificationRequest.reviewedAt = now;
    verificationRequest.reviewNotes = rejectionData.reviewNotes;
    verificationRequest.updatedAt = now;

    await client.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');

    console.log(`Rejected verification request: ${requestId} for user: ${userId}`);
    return c.json(verificationRequest, 200);
  } catch (error: any) {
    console.error('Error rejecting verification:', error);
    if (error.statusCode === 404) {
      return c.json({ error: 'Verification request not found' }, 404);
    }
    return c.json({ error: 'Failed to reject verification', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
