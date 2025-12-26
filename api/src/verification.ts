/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/verification - Verification Request API (User-facing)
 * 
 * Handles admin verification requests for users without .gov.au email addresses.
 * Users submit evidence of their brigade membership for site owner review.
 * 
 * Endpoints:
 * - POST /api/verification/request - Submit verification request with evidence
 * - GET /api/verification/requests/{requestId} - Get request details
 * - GET /api/verification/user/{userId} - Get user's verification requests
 * 
 * Note: File upload endpoint deferred to Phase 7 (requires Azure Blob Storage)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

// Get Azure Storage credentials
const STORAGE_CONNECTION_STRING = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING || '';

// Determine table name based on environment
const isDevMode = process.env.VITE_DEV_MODE === 'true';
const VERIFICATION_TABLE = isDevMode ? 'devverificationrequests' : 'verificationrequests';

function getVerificationTableClient(): TableClient {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, VERIFICATION_TABLE);
}

// Helper to convert Table entity to VerificationRequest object
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

// Helper to convert VerificationRequest to Table entity
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

// POST /api/verification/request
async function submitVerificationRequest(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const requestData = await request.json() as any;

    if (!requestData.userId || !requestData.brigadeId || !requestData.email || !requestData.explanation) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required fields: userId, brigadeId, email, explanation' }
      };
    }

    // Validate explanation length
    if (requestData.explanation.length < 50 || requestData.explanation.length > 500) {
      return {
        status: 400,
        jsonBody: { error: 'Explanation must be between 50 and 500 characters' }
      };
    }

    // Check for .gov.au email (should not use verification system)
    if (requestData.email.endsWith('.gov.au')) {
      return {
        status: 400,
        jsonBody: { error: 'Users with .gov.au email do not need verification' }
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

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

    const client = getVerificationTableClient();
    const entity = verificationRequestToEntity(verificationRequest);

    await client.createEntity(entity);

    context.log(`Created verification request: ${verificationRequest.id} for user: ${requestData.userId}`);

    return {
      status: 201,
      jsonBody: verificationRequest
    };

  } catch (error: any) {
    context.error('Error creating verification request:', error);

    if (error.statusCode === 409) {
      return {
        status: 409,
        jsonBody: { error: 'Verification request already exists' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to create verification request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// GET /api/verification/requests/{requestId}?userId=xxx
async function getVerificationRequest(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const requestId = request.params.requestId;
    const userId = request.query.get('userId');

    if (!requestId || !userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: requestId, userId' }
      };
    }

    const client = getVerificationTableClient();
    const entity = await client.getEntity(userId, requestId);

    context.log(`Retrieved verification request: ${requestId}`);

    return {
      status: 200,
      jsonBody: entityToVerificationRequest(entity)
    };

  } catch (error: any) {
    context.error('Error retrieving verification request:', error);

    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Verification request not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve verification request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// GET /api/verification/user/{userId}
async function getUserVerificationRequests(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameter: userId' }
      };
    }

    const client = getVerificationTableClient();
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });

    const requests = [];
    for await (const entity of entities) {
      requests.push(entityToVerificationRequest(entity));
    }

    context.log(`Retrieved ${requests.length} verification requests for user: ${userId}`);

    return {
      status: 200,
      jsonBody: requests
    };

  } catch (error: any) {
    context.error('Error retrieving user verification requests:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve user verification requests',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('verification-submit', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'verification/request',
  handler: submitVerificationRequest
});

app.http('verification-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'verification/requests/{requestId}',
  handler: getVerificationRequest
});

app.http('verification-user', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'verification/user/{userId}',
  handler: getUserVerificationRequests
});
