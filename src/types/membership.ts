/**
 * BrigadeMembership represents a user's membership in a specific brigade.
 * Users can have multiple memberships (one per brigade) with different roles.
 * This enables multi-brigade membership support.
 */

/** User role within a brigade */
export type MemberRole = 'admin' | 'operator' | 'viewer';

/** Membership status */
export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'removed';

export interface BrigadeMembership {
  /** Unique membership identifier (UUID) */
  id: string;
  
  /** Foreign key to Brigade */
  brigadeId: string;
  
  /** Foreign key to User */
  userId: string;
  
  /** User role within this brigade */
  role: MemberRole;
  
  /** Membership status */
  status: MembershipStatus;
  
  /** User ID of member who invited this user */
  invitedBy?: string;
  
  /** When invitation was sent */
  invitedAt?: string;
  
  /** User ID of admin who approved membership */
  approvedBy?: string;
  
  /** When membership was approved */
  approvedAt?: string;
  
  /** When user became active member */
  joinedAt?: string;
  
  /** When user was removed (if applicable) */
  removedAt?: string;
  
  /** User ID of admin who removed this member */
  removedBy?: string;
  
  /** Membership creation timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
}
