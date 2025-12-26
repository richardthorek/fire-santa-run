/**
 * Permission checking utilities for role-based access control (RBAC).
 * 
 * These functions check if a user with a specific membership has permission
 * to perform various actions within a brigade.
 */

import type { BrigadeMembership, MemberRole } from '../types/membership';

/**
 * Check if a user can manage routes (create, edit, delete, publish).
 * 
 * Permissions:
 * - Admin: Full access
 * - Operator: Full access
 * - Viewer: Read-only (cannot manage)
 */
export function canManageRoutes(membership: BrigadeMembership | null): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  return membership.role === 'admin' || membership.role === 'operator';
}

/**
 * Check if a user can invite new members to the brigade.
 * 
 * Permissions:
 * - Admin: Can invite
 * - Operator: Can invite viewers and operators
 * - Viewer: Cannot invite
 */
export function canInviteMembers(
  membership: BrigadeMembership | null,
  targetRole?: MemberRole
): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  // Admins can invite anyone
  if (membership.role === 'admin') return true;
  
  // Operators can invite viewers and operators (not admins)
  if (membership.role === 'operator') {
    if (!targetRole) return true; // Can see invite button
    return targetRole === 'viewer' || targetRole === 'operator';
  }
  
  // Viewers cannot invite
  return false;
}

/**
 * Check if a user can manage members (approve, remove, change roles).
 * 
 * Permissions:
 * - Admin: Full member management
 * - Operator: Can approve pending members (but not promote to admin or remove admins)
 * - Viewer: Cannot manage members
 */
export function canManageMembers(
  membership: BrigadeMembership | null,
  targetMembership?: BrigadeMembership
): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  // Admins have full member management
  if (membership.role === 'admin') return true;
  
  // Operators can manage non-admin members
  if (membership.role === 'operator') {
    if (!targetMembership) return true; // Can see member management
    return targetMembership.role !== 'admin';
  }
  
  // Viewers cannot manage members
  return false;
}

/**
 * Check if a user can edit brigade settings (name, logo, allowed domains, etc.).
 * 
 * Permissions:
 * - Admin: Full access
 * - Operator: Read-only
 * - Viewer: Read-only
 */
export function canEditBrigadeSettings(membership: BrigadeMembership | null): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  return membership.role === 'admin';
}

/**
 * Check if a user can promote another member to admin.
 * 
 * Permissions:
 * - Admin: Can promote (subject to .gov.au email or verification requirement)
 * - Operator: Cannot promote
 * - Viewer: Cannot promote
 */
export function canPromoteToAdmin(membership: BrigadeMembership | null): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  return membership.role === 'admin';
}

/**
 * Check if a user can demote an admin to operator.
 * 
 * Permissions:
 * - Admin: Can demote other admins (but not the last admin)
 * - Operator: Cannot demote
 * - Viewer: Cannot demote
 */
export function canDemoteFromAdmin(
  membership: BrigadeMembership | null,
  targetIsLastAdmin: boolean = false
): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  if (membership.role !== 'admin') return false;
  
  // Cannot demote the last admin
  if (targetIsLastAdmin) return false;
  
  return true;
}

/**
 * Check if a user can remove another member from the brigade.
 * 
 * Permissions:
 * - Admin: Can remove anyone except the last admin
 * - Operator: Can remove viewers and operators (not admins)
 * - Viewer: Cannot remove
 */
export function canRemoveMember(
  membership: BrigadeMembership | null,
  targetMembership: BrigadeMembership,
  targetIsLastAdmin: boolean = false
): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  // Cannot remove the last admin
  if (targetIsLastAdmin) return false;
  
  // Admins can remove anyone
  if (membership.role === 'admin') return true;
  
  // Operators can remove non-admin members
  if (membership.role === 'operator') {
    return targetMembership.role !== 'admin';
  }
  
  // Viewers cannot remove
  return false;
}

/**
 * Check if a user can view brigade member list.
 * 
 * Permissions:
 * - Admin: Full access
 * - Operator: Full access
 * - Viewer: Can view basic member list (names and roles)
 */
export function canViewMembers(membership: BrigadeMembership | null): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  return true; // All active members can view member list
}

/**
 * Check if a user can cancel pending invitations.
 * 
 * Permissions:
 * - Admin: Can cancel any invitation
 * - Operator: Can cancel invitations they sent
 * - Viewer: Cannot cancel invitations
 */
export function canCancelInvitation(
  membership: BrigadeMembership | null,
  invitationSentByUserId?: string
): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  // Admins can cancel any invitation
  if (membership.role === 'admin') return true;
  
  // Operators can cancel invitations they sent
  if (membership.role === 'operator') {
    return invitationSentByUserId === membership.userId;
  }
  
  // Viewers cannot cancel invitations
  return false;
}

/**
 * Check if a user can start navigation (broadcast location).
 * 
 * Permissions:
 * - Admin: Can navigate
 * - Operator: Can navigate
 * - Viewer: Read-only (cannot navigate)
 */
export function canStartNavigation(membership: BrigadeMembership | null): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  return membership.role === 'admin' || membership.role === 'operator';
}

/**
 * Check if a user can approve pending membership requests.
 * 
 * Permissions:
 * - Admin: Can approve
 * - Operator: Can approve non-admin requests
 * - Viewer: Cannot approve
 */
export function canApproveMembership(
  membership: BrigadeMembership | null,
  targetRole?: MemberRole
): boolean {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  
  // Admins can approve anyone
  if (membership.role === 'admin') return true;
  
  // Operators can approve non-admin roles
  if (membership.role === 'operator') {
    if (!targetRole) return true;
    return targetRole !== 'admin';
  }
  
  // Viewers cannot approve
  return false;
}

/**
 * Get a human-readable role display name.
 */
export function getRoleDisplayName(role: MemberRole): string {
  const roleNames: Record<MemberRole, string> = {
    admin: 'Admin',
    operator: 'Operator',
    viewer: 'Viewer',
  };
  return roleNames[role] || role;
}

/**
 * Get a description of what each role can do.
 */
export function getRoleDescription(role: MemberRole): string {
  const descriptions: Record<MemberRole, string> = {
    admin: 'Full access: Manage routes, members, and brigade settings',
    operator: 'Create and manage routes, invite members, navigate Santa runs',
    viewer: 'View routes and tracking data only',
  };
  return descriptions[role] || '';
}

/**
 * Get all available roles that a user can assign when inviting.
 */
export function getAvailableRolesToInvite(membership: BrigadeMembership | null): MemberRole[] {
  if (!membership) return [];
  if (membership.status !== 'active') return [];
  
  if (membership.role === 'admin') {
    return ['admin', 'operator', 'viewer'];
  }
  
  if (membership.role === 'operator') {
    return ['operator', 'viewer'];
  }
  
  return [];
}
