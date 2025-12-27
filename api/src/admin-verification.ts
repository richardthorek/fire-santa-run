/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/site-admin/verification - Admin Verification Management API (Site Owner Only)
 * 
 * Handles site owner review and approval/rejection of admin verification requests.
 * These endpoints should be protected by authentication in production.
 * 
 * Endpoints:
 * - GET /api/site-admin/verification/pending - List pending verification requests
 * - GET /api/site-admin/verification/requests/{requestId}?userId=xxx - Get request with evidence
 * - POST /api/site-admin/verification/requests/{requestId}/approve - Approve request
 * - POST /api/site-admin/verification/requests/{requestId}/reject - Reject request
 * 
 * Note: Evidence file SAS token endpoint deferred to Phase 7 (requires Azure Blob Storage)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { getTableClient, isDevMode } from './utils/storage';

const VERIFICATION_TABLE = isDevMode ? 'devverificationrequests' : 'verificationrequests';
const USERS_TABLE = isDevMode ? 'devusers' : 'users';

async function getVerificationTableClient(): Promise<TableClient> {
  return getTableClient(VERIFICATION_TABLE);
}

async function getUsersTableClient(): Promise<TableClient> {
  return getTableClient(USERS_TABLE);
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

// GET /api/site-admin/verification/pending
async function getPendingVerifications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const client = await getVerificationTableClient();
    
    // Query all pending verifications
    const entities = client.listEntities({
      queryOptions: { filter: `status eq 'pending'` }
    });

    const pendingRequests = [];
    for await (const entity of entities) {
      const verificationRequest = entityToVerificationRequest(entity);
      
      // Check if expired
      if (new Date(verificationRequest.expiresAt) < new Date()) {
        verificationRequest.status = 'expired';
        verificationRequest.updatedAt = new Date().toISOString();
        await client.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');
      } else {
        pendingRequests.push(verificationRequest);
      }
    }

    context.log(`Retrieved ${pendingRequests.length} pending verification requests`);

    return {
      status: 200,
      jsonBody: pendingRequests
    };

  } catch (error: any) {
    context.error('Error retrieving pending verifications:', error);

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve pending verifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// GET /api/site-admin/verification/requests/{requestId}?userId=xxx
async function getVerificationRequestDetails(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const requestId = request.params.requestId;
    const userId = request.query.get('userId');

    if (!requestId || !userId) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: requestId, userId' }
      };
    }

    const client = await getVerificationTableClient();
    const entity = await client.getEntity(userId, requestId);

    context.log(`Retrieved verification request details: ${requestId}`);

    return {
      status: 200,
      jsonBody: entityToVerificationRequest(entity)
    };

  } catch (error: any) {
    context.error('Error retrieving verification request details:', error);

    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Verification request not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to retrieve verification request details',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/site-admin/verification/requests/{requestId}/approve?userId=xxx
async function approveVerification(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const requestId = request.params.requestId;
    const userId = request.query.get('userId');
    const approvalData = await request.json() as any;

    if (!requestId || !userId || !approvalData.reviewedBy) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: requestId, userId, reviewedBy' }
      };
    }

    const verificationClient = await getVerificationTableClient();
    const usersClient = await getUsersTableClient();

    // Get verification request
    const entity = await verificationClient.getEntity(userId, requestId);
    const verificationRequest = entityToVerificationRequest(entity);

    if (verificationRequest.status !== 'pending') {
      return {
        status: 400,
        jsonBody: { error: `Verification request is ${verificationRequest.status}, cannot approve` }
      };
    }

    // Check expiration
    if (new Date(verificationRequest.expiresAt) < new Date()) {
      verificationRequest.status = 'expired';
      verificationRequest.updatedAt = new Date().toISOString();
      await verificationClient.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');
      
      return {
        status: 400,
        jsonBody: { error: 'Verification request has expired' }
      };
    }

    // Approve verification
    const now = new Date().toISOString();
    verificationRequest.status = 'approved';
    verificationRequest.reviewedBy = approvalData.reviewedBy;
    verificationRequest.reviewedAt = now;
    verificationRequest.reviewNotes = approvalData.reviewNotes;
    verificationRequest.updatedAt = now;

    await verificationClient.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');

    // Update user's verifiedBrigades array
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

    context.log(`Approved verification request: ${requestId} for user: ${userId}`);

    return {
      status: 200,
      jsonBody: verificationRequest
    };

  } catch (error: any) {
    context.error('Error approving verification:', error);

    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Verification request or user not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to approve verification',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// POST /api/site-admin/verification/requests/{requestId}/reject?userId=xxx
async function rejectVerification(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const requestId = request.params.requestId;
    const userId = request.query.get('userId');
    const rejectionData = await request.json() as any;

    if (!requestId || !userId || !rejectionData.reviewedBy) {
      return {
        status: 400,
        jsonBody: { error: 'Missing required parameters: requestId, userId, reviewedBy' }
      };
    }

    const client = await getVerificationTableClient();

    // Get verification request
    const entity = await client.getEntity(userId, requestId);
    const verificationRequest = entityToVerificationRequest(entity);

    if (verificationRequest.status !== 'pending') {
      return {
        status: 400,
        jsonBody: { error: `Verification request is ${verificationRequest.status}, cannot reject` }
      };
    }

    // Reject verification
    const now = new Date().toISOString();
    verificationRequest.status = 'rejected';
    verificationRequest.reviewedBy = rejectionData.reviewedBy;
    verificationRequest.reviewedAt = now;
    verificationRequest.reviewNotes = rejectionData.reviewNotes;
    verificationRequest.updatedAt = now;

    await client.updateEntity(verificationRequestToEntity(verificationRequest), 'Replace');

    context.log(`Rejected verification request: ${requestId} for user: ${userId}`);

    return {
      status: 200,
      jsonBody: verificationRequest
    };

  } catch (error: any) {
    context.error('Error rejecting verification:', error);

    if (error.statusCode === 404) {
      return {
        status: 404,
        jsonBody: { error: 'Verification request not found' }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Failed to reject verification',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register HTTP endpoints
app.http('admin-verification-pending', {
  methods: ['GET'],
  authLevel: 'anonymous', // TODO: Change to 'function' in production with proper auth
  route: 'site-admin/verification/pending',
  handler: getPendingVerifications
});

app.http('admin-verification-get', {
  methods: ['GET'],
  authLevel: 'anonymous', // TODO: Change to 'function' in production with proper auth
  route: 'site-admin/verification/requests/{requestId}',
  handler: getVerificationRequestDetails
});

app.http('admin-verification-approve', {
  methods: ['POST'],
  authLevel: 'anonymous', // TODO: Change to 'function' in production with proper auth
  route: 'site-admin/verification/requests/{requestId}/approve',
  handler: approveVerification
});

app.http('admin-verification-reject', {
  methods: ['POST'],
  authLevel: 'anonymous', // TODO: Change to 'function' in production with proper auth
  route: 'site-admin/verification/requests/{requestId}/reject',
  handler: rejectVerification
});
