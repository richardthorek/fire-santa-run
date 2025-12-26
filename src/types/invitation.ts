/**
 * MemberInvitation represents an invitation for a user to join a brigade.
 * Invitations are sent by existing members and must be accepted by the invitee.
 */

/** Invitation status */
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface MemberInvitation {
  /** Unique invitation identifier (UUID) */
  id: string;
  
  /** Brigade extending the invitation */
  brigadeId: string;
  
  /** Email address of invitee */
  email: string;
  
  /** Proposed role (admin invitations handled separately through promotion) */
  role: 'operator' | 'viewer';
  
  /** Invitation status */
  status: InvitationStatus;
  
  /** User ID of member who sent invitation */
  invitedBy: string;
  
  /** When invitation was sent */
  invitedAt: string;
  
  /** Invitation expiration (typically 7 days from invitedAt) */
  expiresAt: string;
  
  /** When invitation was accepted */
  acceptedAt?: string;
  
  /** When invitation was declined */
  declinedAt?: string;
  
  /** Unique invitation token (for email link) */
  token: string;
  
  /** Optional message from inviter */
  personalMessage?: string;
  
  /** Invitation creation timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
}
