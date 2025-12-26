import type { Route } from '../types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';

export interface Brigade {
  /** Unique brigade identifier (UUID) */
  id: string;
  
  /** URL-friendly identifier (e.g., "griffith-rfs") */
  slug: string;
  
  /** Official brigade name (e.g., "Griffith Rural Fire Service") */
  name: string;
  
  /** Location (e.g., "Griffith, NSW") */
  location: string;
  
  /** Reference to RFS dataset station (for verification) */
  rfsStationId?: number;
  
  /** URL or base64 encoded logo */
  logo?: string;
  
  /** Custom theme color (hex) */
  themeColor?: string;
  
  /** Email domains for auto-approval (e.g., ['@griffithrfs.org.au']) */
  allowedDomains: string[];
  
  /** Specific approved email addresses */
  allowedEmails: string[];
  
  /** Require admin approval for new members */
  requireManualApproval: boolean;
  
  /** Array of user IDs who are admins (min: 1, max: 2) */
  adminUserIds: string[];
  
  /** Whether brigade has been claimed by an admin */
  isClaimed: boolean;
  
  /** When brigade was first claimed */
  claimedAt?: string;
  
  /** User ID of first admin who claimed it */
  claimedBy?: string;
  
  /** Contact information */
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  
  /** Brigade record creation date */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
}

export interface IStorageAdapter {
  // Route operations
  saveRoute(brigadeId: string, route: Route): Promise<void>;
  getRoutes(brigadeId: string): Promise<Route[]>;
  getRoute(brigadeId: string, routeId: string): Promise<Route | null>;
  deleteRoute(brigadeId: string, routeId: string): Promise<void>;
  
  // Brigade operations
  getBrigade(brigadeId: string): Promise<Brigade | null>;
  saveBrigade(brigade: Brigade): Promise<void>;
  
  // User operations
  saveUser(user: User): Promise<void>;
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  
  // Membership operations
  saveMembership(membership: BrigadeMembership): Promise<void>;
  getMembership(brigadeId: string, userId: string): Promise<BrigadeMembership | null>;
  getMembershipById(membershipId: string): Promise<BrigadeMembership | null>;
  deleteMembership(brigadeId: string, userId: string): Promise<void>;
  getMembershipsByUser(userId: string): Promise<BrigadeMembership[]>;
  getMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]>;
  getPendingMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]>;
  
  // Invitation operations
  saveInvitation(invitation: MemberInvitation): Promise<void>;
  getInvitation(invitationId: string): Promise<MemberInvitation | null>;
  getInvitationByToken(token: string): Promise<MemberInvitation | null>;
  getPendingInvitationsByBrigade(brigadeId: string): Promise<MemberInvitation[]>;
  expireInvitations(): Promise<void>;
  
  // Verification operations
  saveVerificationRequest(request: AdminVerificationRequest): Promise<void>;
  getVerificationRequest(requestId: string): Promise<AdminVerificationRequest | null>;
  getVerificationsByUser(userId: string): Promise<AdminVerificationRequest[]>;
  getPendingVerifications(): Promise<AdminVerificationRequest[]>;
  approveVerification(requestId: string, reviewedBy: string, reviewNotes?: string): Promise<void>;
  rejectVerification(requestId: string, reviewedBy: string, reviewNotes: string): Promise<void>;
}
