/**
 * Membership service for managing brigade members, invitations, and admin operations.
 * Implements the comprehensive membership management workflow from Section 12a.
 */

import type { IStorageAdapter } from '../storage/types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import {
  canClaimBrigade,
  canRemoveMember,
  canLeaveBrigade,
  canPromoteToAdmin,
  canDemoteFromAdmin,
  validateInvitationRole,
  isInvitationValid,
} from '../utils/membershipRules';

/**
 * Result type for service operations
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Membership service class for managing brigade members
 */
export class MembershipService {
  private storage: IStorageAdapter;
  
  constructor(storage: IStorageAdapter) {
    this.storage = storage;
  }

  /**
   * Claim an unclaimed brigade (first admin).
   * Creates the first admin membership and marks brigade as claimed.
   * 
   * @param user - User claiming the brigade
   * @param brigadeId - Brigade to claim
   * @returns Service result with error message if failed
   */
  async claimBrigade(user: User, brigadeId: string): Promise<ServiceResult<BrigadeMembership>> {
    const brigade = await this.storage.getBrigade(brigadeId);
    if (!brigade) {
      return { success: false, error: 'Brigade not found' };
    }

    // Validate claiming eligibility
    const claimCheck = canClaimBrigade(user, brigade);
    if (!claimCheck.valid) {
      return { success: false, error: claimCheck.error };
    }

    // Check if user is already a member
    const existingMembership = await this.storage.getMembership(brigadeId, user.id);
    if (existingMembership) {
      return { success: false, error: 'User is already a member of this brigade' };
    }

    // Mark brigade as claimed
    brigade.isClaimed = true;
    brigade.claimedAt = new Date().toISOString();
    brigade.claimedBy = user.id;
    brigade.adminUserIds = [user.id];
    brigade.updatedAt = new Date().toISOString();
    await this.storage.saveBrigade(brigade);

    // Create admin membership
    const membership: BrigadeMembership = {
      id: self.self.crypto.randomUUID(),
      brigadeId,
      userId: user.id,
      role: 'admin',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.saveMembership(membership);

    return { success: true, data: membership };
  }

  /**
   * Invite a new member to the brigade.
   * Creates an invitation that must be accepted by the invitee.
   * 
   * @param inviterId - User sending the invitation
   * @param brigadeId - Brigade to invite to
   * @param inviteeEmail - Email of person to invite
   * @param proposedRole - Role to propose (operator or viewer)
   * @param personalMessage - Optional message from inviter
   * @returns Service result with invitation data if successful
   */
  async inviteMember(
    inviterId: string,
    brigadeId: string,
    inviteeEmail: string,
    proposedRole: 'operator' | 'viewer',
    personalMessage?: string
  ): Promise<ServiceResult<MemberInvitation>> {
    // Validate inviter is an active member
    const inviterMembership = await this.storage.getMembership(brigadeId, inviterId);
    if (!inviterMembership || inviterMembership.status !== 'active') {
      return { success: false, error: 'You must be an active member to invite others' };
    }

    // Validate role permissions
    const roleCheck = validateInvitationRole(inviterMembership.role, proposedRole);
    if (!roleCheck.valid) {
      return { success: false, error: roleCheck.error };
    }

    // Check if user is already a member
    const existingUser = await this.storage.getUserByEmail(inviteeEmail);
    if (existingUser) {
      const existingMembership = await this.storage.getMembership(brigadeId, existingUser.id);
      if (existingMembership) {
        return { success: false, error: 'User is already a member of this brigade' };
      }
    }

    // Check for existing pending invitation
    const pendingInvitations = await this.storage.getPendingInvitationsByBrigade(brigadeId);
    const duplicateInvitation = pendingInvitations.find(
      inv => inv.email.toLowerCase() === inviteeEmail.toLowerCase()
    );
    if (duplicateInvitation) {
      return { success: false, error: 'A pending invitation already exists for this email' };
    }

    // Create invitation
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation: MemberInvitation = {
      id: self.crypto.randomUUID(),
      brigadeId,
      email: inviteeEmail,
      role: proposedRole,
      status: 'pending',
      invitedBy: inviterId,
      invitedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      token: self.crypto.randomUUID(),
      personalMessage,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.storage.saveInvitation(invitation);

    return { success: true, data: invitation };
  }

  /**
   * Accept an invitation to join a brigade.
   * Creates a membership (pending or active based on brigade settings).
   * 
   * @param userId - User accepting the invitation
   * @param invitationToken - Invitation token from email link
   * @returns Service result with membership data if successful
   */
  async acceptInvitation(
    userId: string,
    invitationToken: string
  ): Promise<ServiceResult<BrigadeMembership>> {
    const invitation = await this.storage.getInvitationByToken(invitationToken);
    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Validate invitation is still valid
    const validCheck = isInvitationValid(invitation);
    if (!validCheck.valid) {
      return { success: false, error: validCheck.error };
    }

    const brigade = await this.storage.getBrigade(invitation.brigadeId);
    if (!brigade) {
      return { success: false, error: 'Brigade not found' };
    }

    // Check if user is already a member
    const existingMembership = await this.storage.getMembership(invitation.brigadeId, userId);
    if (existingMembership) {
      return { success: false, error: 'You are already a member of this brigade' };
    }

    // Determine if membership should be auto-approved
    const user = await this.storage.getUser(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const requiresApproval = brigade.requireManualApproval;
    const status: 'active' | 'pending' = requiresApproval ? 'pending' : 'active';

    // Create membership
    const now = new Date().toISOString();
    const membership: BrigadeMembership = {
      id: self.crypto.randomUUID(),
      brigadeId: invitation.brigadeId,
      userId,
      role: invitation.role,
      status,
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.invitedAt,
      joinedAt: status === 'active' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.saveMembership(membership);

    // Update invitation status
    invitation.status = 'accepted';
    invitation.acceptedAt = now;
    invitation.updatedAt = now;
    await this.storage.saveInvitation(invitation);

    return { success: true, data: membership };
  }

  /**
   * Approve a pending membership (admin only).
   * 
   * @param adminId - Admin approving the membership
   * @param brigadeId - Brigade ID
   * @param userId - User to approve
   * @returns Service result
   */
  async approveMembership(
    adminId: string,
    brigadeId: string,
    userId: string
  ): Promise<ServiceResult> {
    // Validate admin membership
    const adminMembership = await this.storage.getMembership(brigadeId, adminId);
    if (!adminMembership || adminMembership.role !== 'admin') {
      return { success: false, error: 'Only admins can approve memberships' };
    }

    // Get pending membership
    const membership = await this.storage.getMembership(brigadeId, userId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status !== 'pending') {
      return { success: false, error: 'Membership is not pending approval' };
    }

    // Approve membership
    membership.status = 'active';
    membership.approvedBy = adminId;
    membership.approvedAt = new Date().toISOString();
    membership.joinedAt = new Date().toISOString();
    membership.updatedAt = new Date().toISOString();
    await this.storage.saveMembership(membership);

    return { success: true };
  }

  /**
   * Reject a pending membership (admin only).
   * 
   * @param adminId - Admin rejecting the membership
   * @param brigadeId - Brigade ID
   * @param userId - User to reject
   * @param reason - Optional reason for rejection
   * @returns Service result
   */
  async rejectMembership(
    adminId: string,
    brigadeId: string,
    userId: string,
    _reason?: string
  ): Promise<ServiceResult> {
    // Validate admin membership
    const adminMembership = await this.storage.getMembership(brigadeId, adminId);
    if (!adminMembership || adminMembership.role !== 'admin') {
      return { success: false, error: 'Only admins can reject memberships' };
    }

    // Get pending membership
    const membership = await this.storage.getMembership(brigadeId, userId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    if (membership.status !== 'pending') {
      return { success: false, error: 'Membership is not pending approval' };
    }

    // Delete the membership (rejection means removal)
    await this.storage.deleteMembership(brigadeId, userId);

    return { success: true };
  }

  /**
   * Promote a member to admin (admin only).
   * Validates admin eligibility and brigade constraints.
   * 
   * @param adminId - Admin performing the promotion
   * @param brigadeId - Brigade ID
   * @param userId - User to promote
   * @returns Service result
   */
  async promoteToAdmin(
    adminId: string,
    brigadeId: string,
    userId: string
  ): Promise<ServiceResult> {
    // Validate promoter is admin
    const adminMembership = await this.storage.getMembership(brigadeId, adminId);
    if (!adminMembership || adminMembership.role !== 'admin') {
      return { success: false, error: 'Only admins can promote members' };
    }

    const user = await this.storage.getUser(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const membership = await this.storage.getMembership(brigadeId, userId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const brigade = await this.storage.getBrigade(brigadeId);
    if (!brigade) {
      return { success: false, error: 'Brigade not found' };
    }

    // Validate promotion
    const promoteCheck = canPromoteToAdmin(user, membership, brigade);
    if (!promoteCheck.valid) {
      return { success: false, error: promoteCheck.error };
    }

    // Promote to admin
    membership.role = 'admin';
    membership.updatedAt = new Date().toISOString();
    await this.storage.saveMembership(membership);

    // Add to brigade adminUserIds
    brigade.adminUserIds.push(userId);
    brigade.updatedAt = new Date().toISOString();
    await this.storage.saveBrigade(brigade);

    return { success: true };
  }

  /**
   * Demote an admin to operator (admin only).
   * Validates that brigade will still have at least 1 admin.
   * 
   * @param adminId - Admin performing the demotion
   * @param brigadeId - Brigade ID
   * @param userId - Admin to demote
   * @returns Service result
   */
  async demoteFromAdmin(
    adminId: string,
    brigadeId: string,
    userId: string
  ): Promise<ServiceResult> {
    // Validate demoter is admin
    const adminMembership = await this.storage.getMembership(brigadeId, adminId);
    if (!adminMembership || adminMembership.role !== 'admin') {
      return { success: false, error: 'Only admins can demote members' };
    }

    const membership = await this.storage.getMembership(brigadeId, userId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const brigade = await this.storage.getBrigade(brigadeId);
    if (!brigade) {
      return { success: false, error: 'Brigade not found' };
    }

    // Validate demotion
    const demoteCheck = canDemoteFromAdmin(membership, brigade);
    if (!demoteCheck.valid) {
      return { success: false, error: demoteCheck.error };
    }

    // Demote from admin
    membership.role = 'operator';
    membership.updatedAt = new Date().toISOString();
    await this.storage.saveMembership(membership);

    // Remove from brigade adminUserIds
    brigade.adminUserIds = brigade.adminUserIds.filter(id => id !== userId);
    brigade.updatedAt = new Date().toISOString();
    await this.storage.saveBrigade(brigade);

    return { success: true };
  }

  /**
   * Remove a member from the brigade (admin only).
   * Validates admin removal constraints.
   * 
   * @param adminId - Admin performing the removal
   * @param brigadeId - Brigade ID
   * @param userId - User to remove
   * @returns Service result
   */
  async removeMember(
    adminId: string,
    brigadeId: string,
    userId: string
  ): Promise<ServiceResult> {
    const adminMembership = await this.storage.getMembership(brigadeId, adminId);
    if (!adminMembership) {
      return { success: false, error: 'Admin membership not found' };
    }

    const targetMembership = await this.storage.getMembership(brigadeId, userId);
    if (!targetMembership) {
      return { success: false, error: 'Member not found' };
    }

    const brigade = await this.storage.getBrigade(brigadeId);
    if (!brigade) {
      return { success: false, error: 'Brigade not found' };
    }

    // Validate removal
    const removeCheck = canRemoveMember(adminMembership, targetMembership, brigade);
    if (!removeCheck.valid) {
      return { success: false, error: removeCheck.error };
    }

    // If removing an admin, update brigade
    if (targetMembership.role === 'admin') {
      brigade.adminUserIds = brigade.adminUserIds.filter(id => id !== userId);
      brigade.updatedAt = new Date().toISOString();
      await this.storage.saveBrigade(brigade);
    }

    // Update membership status
    targetMembership.status = 'removed';
    targetMembership.removedBy = adminId;
    targetMembership.removedAt = new Date().toISOString();
    targetMembership.updatedAt = new Date().toISOString();
    await this.storage.saveMembership(targetMembership);

    return { success: true };
  }

  /**
   * Leave a brigade (self-service).
   * Validates that leaving won't violate admin constraints.
   * 
   * @param userId - User leaving the brigade
   * @param brigadeId - Brigade to leave
   * @returns Service result
   */
  async leaveBrigade(userId: string, brigadeId: string): Promise<ServiceResult> {
    const membership = await this.storage.getMembership(brigadeId, userId);
    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const brigade = await this.storage.getBrigade(brigadeId);
    if (!brigade) {
      return { success: false, error: 'Brigade not found' };
    }

    // Validate leaving
    const leaveCheck = canLeaveBrigade(membership, brigade);
    if (!leaveCheck.valid) {
      return { success: false, error: leaveCheck.error };
    }

    // If leaving as admin, update brigade
    if (membership.role === 'admin') {
      brigade.adminUserIds = brigade.adminUserIds.filter(id => id !== userId);
      brigade.updatedAt = new Date().toISOString();
      await this.storage.saveBrigade(brigade);
    }

    // Update membership status
    membership.status = 'removed';
    membership.removedBy = userId; // Self-removed
    membership.removedAt = new Date().toISOString();
    membership.updatedAt = new Date().toISOString();
    await this.storage.saveMembership(membership);

    return { success: true };
  }
}
