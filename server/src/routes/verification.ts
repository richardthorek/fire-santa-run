/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { TableClient } from '@azure/data-tables';
import { getTableClient, isDevMode } from '../utils/storage.js';

const VERIFICATION_TABLE = isDevMode ? 'dev-verificationrequests' : 'verificationrequests';

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getVerificationTableClient(): Promise<TableClient> {
  return getTableClient(VERIFICATION_TABLE);
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

export const verificationRouter = new Hono();

// POST /request
verificationRouter.post('/request', async (c) => {
  try {
    const requestData = await c.req.json();

    if (!requestData.userId || !requestData.brigadeId || !requestData.email || !requestData.explanation) {
      return c.json({ error: 'Missing required fields: userId, brigadeId, email, explanation' }, 400);
    }

    if (requestData.explanation.length < 50 || requestData.explanation.length > 500) {
      return c.json({ error: 'Explanation must be between 50 and 500 characters' }, 400);
    }

    if (requestData.email.endsWith('.gov.au')) {
      return c.json({ error: 'Users with .gov.au email do not need verification' }, 400);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const verificationRequest = {
      id: `verification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId: requestData.userId,
      brigadeId: requestData.brigadeId,
      email: requestData.email,
      evidenceFiles: requestData.evidenceFiles || [],
      explanation: requestData.explanation,
      status: 'pending',
      submittedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const client = await getVerificationTableClient();
    await client.createEntity(verificationRequestToEntity(verificationRequest));

    console.log(`Created verification request: ${verificationRequest.id} for user: ${requestData.userId}`);
    return c.json(verificationRequest, 201);
  } catch (error: any) {
    console.error('Error creating verification request:', error);
    if (error.statusCode === 409) {
      return c.json({ error: 'Verification request already exists' }, 409);
    }
    return c.json({ error: 'Failed to create verification request', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// GET /requests/:requestId
verificationRouter.get('/requests/:requestId', async (c) => {
  try {
    const requestId = c.req.param('requestId');
    const userId = c.req.query('userId');

    if (!requestId || !userId) {
      return c.json({ error: 'Missing required parameters: requestId, userId' }, 400);
    }

    const client = await getVerificationTableClient();
    const entity = await client.getEntity(userId, requestId);

    console.log(`Retrieved verification request: ${requestId}`);
    return c.json(entityToVerificationRequest(entity), 200);
  } catch (error: any) {
    console.error('Error retrieving verification request:', error);
    if (error.statusCode === 404) {
      return c.json({ error: 'Verification request not found' }, 404);
    }
    return c.json({ error: 'Failed to retrieve verification request', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// GET /user/:userId
verificationRouter.get('/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    if (!userId) {
      return c.json({ error: 'Missing required parameter: userId' }, 400);
    }

    const client = await getVerificationTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(userId)}'` }
    });

    const requests = [];
    for await (const entity of entities) {
      requests.push(entityToVerificationRequest(entity));
    }

    console.log(`Retrieved ${requests.length} verification requests for user: ${userId}`);
    return c.json(requests, 200);
  } catch (error: any) {
    console.error('Error retrieving user verification requests:', error);
    return c.json({ error: 'Failed to retrieve user verification requests', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
