/**
 * Verification service for admin verification requests.
 * Handles the manual verification pathway for users without .gov.au emails.
 */

import type { IStorageAdapter } from '../storage/types';
import type { User } from '../types/user';
import type { AdminVerificationRequest, EvidenceFile } from '../types/verification';

/**
 * Result type for service operations
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Verification service class for managing admin verification requests
 */
export class VerificationService {
  private storage: IStorageAdapter;
  
  constructor(storage: IStorageAdapter) {
    this.storage = storage;
  }

  /**
   * Submit a verification request for admin eligibility.
   * User uploads evidence files and explanation.
   * 
   * @param user - User submitting the request
   * @param brigadeId - Brigade they want to become admin of
   * @param explanation - User's explanation (50-500 characters)
   * @param evidenceFiles - Array of evidence file metadata (already uploaded)
   * @returns Service result with request data if successful
   */
  async submitVerificationRequest(
    user: User,
    brigadeId: string,
    explanation: string,
    evidenceFiles: EvidenceFile[]
  ): Promise<ServiceResult<AdminVerificationRequest>> {
    // Validate explanation length
    if (explanation.length < 50 || explanation.length > 500) {
      return {
        success: false,
        error: 'Explanation must be between 50 and 500 characters',
      };
    }

    // Validate evidence files
    if (evidenceFiles.length === 0) {
      return {
        success: false,
        error: 'At least one evidence file is required',
      };
    }

    // Check for existing pending request
    const existingRequests = await this.storage.getVerificationsByUser(user.id);
    const pendingRequest = existingRequests.find(
      req => req.brigadeId === brigadeId && req.status === 'pending'
    );
    if (pendingRequest) {
      return {
        success: false,
        error: 'You already have a pending verification request for this brigade',
      };
    }

    // Create verification request
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const request: AdminVerificationRequest = {
      id: self.crypto.randomUUID(),
      userId: user.id,
      brigadeId,
      email: user.email,
      evidenceFiles,
      explanation,
      status: 'pending',
      submittedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await this.storage.saveVerificationRequest(request);

    return { success: true, data: request };
  }

  /**
   * Get a verification request by ID.
   * 
   * @param requestId - Verification request ID
   * @returns Service result with request data if found
   */
  async getVerificationRequest(requestId: string): Promise<ServiceResult<AdminVerificationRequest>> {
    const request = await this.storage.getVerificationRequest(requestId);
    if (!request) {
      return { success: false, error: 'Verification request not found' };
    }

    return { success: true, data: request };
  }

  /**
   * Get all verification requests for a user.
   * 
   * @param userId - User ID
   * @returns Service result with array of requests
   */
  async getVerificationsByUser(userId: string): Promise<ServiceResult<AdminVerificationRequest[]>> {
    const requests = await this.storage.getVerificationsByUser(userId);
    return { success: true, data: requests };
  }

  /**
   * Approve a verification request (site owner only).
   * Adds brigade to user's verifiedBrigades.
   * 
   * @param requestId - Verification request ID
   * @param siteOwnerId - Site owner performing the review
   * @param reviewNotes - Optional review notes
   * @returns Service result
   */
  async approveVerification(
    requestId: string,
    siteOwnerId: string,
    reviewNotes?: string
  ): Promise<ServiceResult> {
    try {
      await this.storage.approveVerification(requestId, siteOwnerId, reviewNotes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve verification',
      };
    }
  }

  /**
   * Reject a verification request (site owner only).
   * 
   * @param requestId - Verification request ID
   * @param siteOwnerId - Site owner performing the review
   * @param reviewNotes - Reason for rejection (required)
   * @returns Service result
   */
  async rejectVerification(
    requestId: string,
    siteOwnerId: string,
    reviewNotes: string
  ): Promise<ServiceResult> {
    if (!reviewNotes || reviewNotes.length < 10) {
      return {
        success: false,
        error: 'Review notes are required when rejecting a verification request',
      };
    }

    try {
      await this.storage.rejectVerification(requestId, siteOwnerId, reviewNotes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject verification',
      };
    }
  }

  /**
   * Get all pending verification requests (site owner only).
   * 
   * @returns Service result with array of pending requests
   */
  async getPendingVerifications(): Promise<ServiceResult<AdminVerificationRequest[]>> {
    const requests = await this.storage.getPendingVerifications();
    return { success: true, data: requests };
  }
}
