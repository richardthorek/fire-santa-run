/**
 * Membership business rules and validation logic.
 * Implements the comprehensive membership management system from Section 12a.
 */

import type { Brigade } from '../storage/types';
import type { User } from '../types/user';
import type { BrigadeMembership, MemberRole } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';
import { isGovernmentEmail } from './emailValidation';

/**
 * Result type for validation operations
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  method?: 'auto-verified' | 'manually-verified';
}

/**
 * Check if a user can become an admin of a brigade.
 * Admin eligibility is determined by TWO pathways:
 * 1. Automatic: User has .gov.au email address
 * 2. Manual: User has approved AdminVerificationRequest for this brigade
 * 
 * @param user - User to check
 * @param brigadeId - Brigade ID to check admin eligibility for
 * @param verificationRequests - User's verification requests (optional)
 * @returns Validation result with eligibility and method
 * 
 * @example
 * // Pathway 1: .gov.au email (auto-verified)
 * canBecomeAdmin(
 *   { email: 'john@rfs.nsw.gov.au', ... },
 *   'brigade-1'
 * )
 * // { valid: true, method: 'auto-verified' }
 * 
 * // Pathway 2: Approved verification (manually-verified)
 * canBecomeAdmin(
 *   { email: 'john@gmail.com', verifiedBrigades: ['brigade-1'], ... },
 *   'brigade-1'
 * )
 * // { valid: true, method: 'manually-verified' }
 */
export function canBecomeAdmin(
  user: User,
  brigadeId: string,
  verificationRequests?: AdminVerificationRequest[]
): ValidationResult {
  // Method 1: Auto-verify with .gov.au email
  if (isGovernmentEmail(user.email)) {
    return { valid: true, method: 'auto-verified' };
  }
  
  // Method 2: Check for approved verification request
  if (user.verifiedBrigades && user.verifiedBrigades.includes(brigadeId)) {
    return { valid: true, method: 'manually-verified' };
  }
  
  // Alternative: Check verification requests array if provided
  if (verificationRequests) {
    const hasApprovedVerification = verificationRequests.some(
      req => req.brigadeId === brigadeId && req.status === 'approved'
    );
    if (hasApprovedVerification) {
      return { valid: true, method: 'manually-verified' };
    }
  }
  
  return {
    valid: false,
    error: 'User must have a .gov.au email address or approved verification request to become admin',
  };
}

/**
 * Check if a user can claim an unclaimed brigade.
 * Same eligibility as becoming admin (either .gov.au or approved verification).
 * 
 * @param user - User attempting to claim
 * @param brigade - Brigade to claim
 * @returns Validation result with error message if not eligible
 */
export function canClaimBrigade(user: User, brigade: Brigade): ValidationResult {
  // Check if brigade is already claimed
  if (brigade.isClaimed) {
    return {
      valid: false,
      error: 'Brigade has already been claimed',
    };
  }
  
  // Check admin eligibility (same requirements as becoming admin)
  return canBecomeAdmin(user, brigade.id);
}

/**
 * Validate admin count constraints for a brigade.
 * Enforces the 1-2 admin rule (min: 1, max: 2).
 * 
 * @param brigade - Brigade to validate
 * @returns Validation result with error message if constraints violated
 */
export function validateAdminCount(brigade: Brigade): ValidationResult {
  const adminCount = brigade.adminUserIds.length;
  
  if (adminCount < 1) {
    return {
      valid: false,
      error: 'Brigade must have at least 1 admin',
    };
  }
  
  if (adminCount > 2) {
    return {
      valid: false,
      error: 'Brigade cannot have more than 2 admins',
    };
  }
  
  return { valid: true };
}

/**
 * Check if a member can be removed from a brigade.
 * Constraints:
 * - Only admins can remove members
 * - Cannot remove last admin
 * - Admins cannot remove themselves if they are the last admin
 * 
 * @param removerMembership - Membership of user attempting removal
 * @param targetMembership - Membership to be removed
 * @param brigade - Brigade containing the members
 * @returns Validation result with error message if removal not allowed
 */
export function canRemoveMember(
  removerMembership: BrigadeMembership,
  targetMembership: BrigadeMembership,
  brigade: Brigade
): ValidationResult {
  // Only admins can remove members
  if (removerMembership.role !== 'admin') {
    return {
      valid: false,
      error: 'Only admins can remove members',
    };
  }
  
  // Check if target is active
  if (targetMembership.status !== 'active') {
    return {
      valid: false,
      error: 'Member is not active and cannot be removed',
    };
  }
  
  // If removing an admin, ensure brigade still has at least 1 admin
  if (targetMembership.role === 'admin') {
    if (brigade.adminUserIds.length <= 1) {
      return {
        valid: false,
        error: 'Cannot remove last admin. Promote another member to admin first.',
      };
    }
  }
  
  // If remover is removing themselves as admin, ensure there's another admin
  if (removerMembership.userId === targetMembership.userId && 
      targetMembership.role === 'admin' && 
      brigade.adminUserIds.length === 1) {
    return {
      valid: false,
      error: 'Cannot remove yourself as last admin. Promote another member to admin first.',
    };
  }
  
  return { valid: true };
}

/**
 * Check if a user can leave a brigade.
 * Constraints:
 * - User must be an active member
 * - If user is admin, brigade must have another admin
 * 
 * @param membership - User's membership to check
 * @param brigade - Brigade user wants to leave
 * @returns Validation result with error message if leave not allowed
 */
export function canLeaveBrigade(
  membership: BrigadeMembership,
  brigade: Brigade
): ValidationResult {
  // Check if membership is active
  if (membership.status !== 'active') {
    return {
      valid: false,
      error: 'Membership is not active',
    };
  }
  
  // If user is admin, ensure brigade will still have at least 1 admin
  if (membership.role === 'admin' && brigade.adminUserIds.length <= 1) {
    return {
      valid: false,
      error: 'Cannot leave as last admin. Promote another member to admin first.',
    };
  }
  
  return { valid: true };
}

/**
 * Check if an invitation is still valid.
 * Validates expiration, status, and basic constraints.
 * 
 * @param invitation - Invitation to validate
 * @returns Validation result with error message if invalid
 */
export function isInvitationValid(invitation: MemberInvitation): ValidationResult {
  // Check if invitation is pending
  if (invitation.status !== 'pending') {
    return {
      valid: false,
      error: `Invitation is ${invitation.status} and cannot be accepted`,
    };
  }
  
  // Check if invitation has expired
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  if (now > expiresAt) {
    return {
      valid: false,
      error: 'Invitation has expired',
    };
  }
  
  return { valid: true };
}

/**
 * Check if a user has an approved verification for a brigade.
 * This is used for the manual verification pathway.
 * 
 * @param user - User to check
 * @param brigadeId - Brigade ID to check
 * @param verificationRequests - Optional array of verification requests to check
 * @returns true if user has approved verification for this brigade
 */
export function hasApprovedVerification(
  user: User,
  brigadeId: string,
  verificationRequests?: AdminVerificationRequest[]
): boolean {
  // Check user's verifiedBrigades array
  if (user.verifiedBrigades && user.verifiedBrigades.includes(brigadeId)) {
    return true;
  }
  
  // Check verification requests array if provided
  if (verificationRequests) {
    return verificationRequests.some(
      req => req.brigadeId === brigadeId && req.status === 'approved'
    );
  }
  
  return false;
}

/**
 * Check if a user can be promoted to admin.
 * Validates admin eligibility and brigade constraints.
 * 
 * @param user - User to promote
 * @param membership - User's current membership
 * @param brigade - Brigade to promote within
 * @returns Validation result with error message if promotion not allowed
 */
export function canPromoteToAdmin(
  user: User,
  membership: BrigadeMembership,
  brigade: Brigade
): ValidationResult {
  // Check if user is already admin
  if (membership.role === 'admin') {
    return {
      valid: false,
      error: 'User is already an admin',
    };
  }
  
  // Check if membership is active
  if (membership.status !== 'active') {
    return {
      valid: false,
      error: 'User must be an active member to be promoted to admin',
    };
  }
  
  // Check if brigade already has maximum admins
  if (brigade.adminUserIds.length >= 2) {
    return {
      valid: false,
      error: 'Brigade already has maximum 2 admins',
    };
  }
  
  // Check admin eligibility (either .gov.au or approved verification)
  const adminCheck = canBecomeAdmin(user, brigade.id);
  if (!adminCheck.valid) {
    return adminCheck;
  }
  
  return { valid: true };
}

/**
 * Check if an admin can be demoted.
 * Validates that brigade will still have at least 1 admin after demotion.
 * 
 * @param membership - Admin membership to demote
 * @param brigade - Brigade containing the admin
 * @returns Validation result with error message if demotion not allowed
 */
export function canDemoteFromAdmin(
  membership: BrigadeMembership,
  brigade: Brigade
): ValidationResult {
  // Check if user is admin
  if (membership.role !== 'admin') {
    return {
      valid: false,
      error: 'User is not an admin',
    };
  }
  
  // Check if this is the last admin
  if (brigade.adminUserIds.length <= 1) {
    return {
      valid: false,
      error: 'Cannot demote last admin. Brigade must have at least 1 admin.',
    };
  }
  
  return { valid: true };
}

/**
 * Validate proposed role for member invitation.
 * Regular members can only invite non-admin roles.
 * 
 * @param inviterRole - Role of user sending invitation
 * @param proposedRole - Role being proposed for invitee
 * @returns Validation result with error message if role not allowed
 */
export function validateInvitationRole(
  inviterRole: MemberRole,
  proposedRole: MemberRole
): ValidationResult {
  // Only admins can send admin invitations (via promotion after joining)
  if (proposedRole === 'admin' && inviterRole !== 'admin') {
    return {
      valid: false,
      error: 'Only admins can promote members to admin role',
    };
  }
  
  // Viewers can only invite other viewers
  if (inviterRole === 'viewer' && proposedRole !== 'viewer') {
    return {
      valid: false,
      error: 'Viewers can only invite other viewers',
    };
  }
  
  return { valid: true };
}
