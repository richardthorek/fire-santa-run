/**
 * Unit tests for membership business rules and validation logic.
 * These are CRITICAL business rules that ensure data integrity and security.
 */

import { describe, it, expect } from 'vitest';
import {
  canBecomeAdmin,
  canClaimBrigade,
  validateAdminCount,
  canRemoveMember,
  canLeaveBrigade,
  isInvitationValid,
  hasApprovedVerification,
  canPromoteToAdmin,
  canDemoteFromAdmin,
  validateInvitationRole,
} from '../membershipRules';
import type { User } from '../../types/user';
import type { Brigade } from '../../storage/types';
import type { BrigadeMembership, MemberRole } from '../../types/membership';
import type { MemberInvitation } from '../../types/invitation';
import type { AdminVerificationRequest } from '../../types/verification';

describe('membershipRules - Critical Business Logic', () => {
  describe('canBecomeAdmin - Admin Eligibility (Security Critical)', () => {
    it('should allow .gov.au email to become admin (auto-verified)', () => {
      const user: User = {
        id: 'user-1',
        email: 'john@rfs.nsw.gov.au',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const result = canBecomeAdmin(user, 'brigade-1');

      expect(result.valid).toBe(true);
      expect(result.method).toBe('auto-verified');
    });

    it('should allow verified brigade user to become admin (manually-verified)', () => {
      const user: User = {
        id: 'user-1',
        email: 'john@gmail.com',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        verifiedBrigades: ['brigade-1'],
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const result = canBecomeAdmin(user, 'brigade-1');

      expect(result.valid).toBe(true);
      expect(result.method).toBe('manually-verified');
    });

    it('should allow user with approved verification request', () => {
      const user: User = {
        id: 'user-1',
        email: 'john@gmail.com',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const verificationRequests: AdminVerificationRequest[] = [
        {
          id: 'req-1',
          userId: 'user-1',
          brigadeId: 'brigade-1',
          status: 'approved',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      const result = canBecomeAdmin(user, 'brigade-1', verificationRequests);

      expect(result.valid).toBe(true);
      expect(result.method).toBe('manually-verified');
    });

    it('should reject non-verified personal email', () => {
      const user: User = {
        id: 'user-1',
        email: 'john@gmail.com',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const result = canBecomeAdmin(user, 'brigade-1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('.gov.au');
    });

    it('should reject user verified for different brigade', () => {
      const user: User = {
        id: 'user-1',
        email: 'john@gmail.com',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        verifiedBrigades: ['brigade-2'], // Different brigade
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const result = canBecomeAdmin(user, 'brigade-1');

      expect(result.valid).toBe(false);
    });
  });

  describe('validateAdminCount - Brigade Integrity (Critical)', () => {
    it('should accept brigade with 1 admin', () => {
      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1'],
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = validateAdminCount(brigade);

      expect(result.valid).toBe(true);
    });

    it('should accept brigade with 2 admins (maximum)', () => {
      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1', 'user-2'],
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = validateAdminCount(brigade);

      expect(result.valid).toBe(true);
    });

    it('should reject brigade with 0 admins', () => {
      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: [],
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: false,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = validateAdminCount(brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 1 admin');
    });

    it('should reject brigade with 3+ admins', () => {
      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1', 'user-2', 'user-3'],
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = validateAdminCount(brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('more than 2 admins');
    });
  });

  describe('canRemoveMember - Safety Critical (Last Admin Protection)', () => {
    const brigade: Brigade = {
      id: 'brigade-1',
      name: 'Test Brigade',
      rfsStationId: 'NSW-12345',
      location: { address: '123 Fire St', coordinates: [0, 0] },
      adminUserIds: ['user-1'],
      membershipRules: {
        requireManualApproval: false,
        allowedDomains: [],
        allowedEmails: [],
      },
      isClaimed: true,
      createdAt: '2024-01-01T00:00:00Z',
    };

    const adminMembership: BrigadeMembership = {
      id: 'member-1',
      brigadeId: 'brigade-1',
      userId: 'user-1',
      role: 'admin',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const operatorMembership: BrigadeMembership = {
      id: 'member-2',
      brigadeId: 'brigade-1',
      userId: 'user-2',
      role: 'operator',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should prevent removing last admin', () => {
      const result = canRemoveMember(adminMembership, adminMembership, brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('last admin');
    });

    it('should prevent non-admin from removing members', () => {
      const result = canRemoveMember(operatorMembership, adminMembership, brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only admins');
    });

    it('should allow admin to remove operator', () => {
      const result = canRemoveMember(adminMembership, operatorMembership, brigade);

      expect(result.valid).toBe(true);
    });

    it('should allow removing admin when multiple admins exist', () => {
      const brigadeWith2Admins = {
        ...brigade,
        adminUserIds: ['user-1', 'user-3'],
      };

      const result = canRemoveMember(adminMembership, adminMembership, brigadeWith2Admins);

      expect(result.valid).toBe(true);
    });
  });

  describe('canLeaveBrigade - Safety Critical', () => {
    const brigade: Brigade = {
      id: 'brigade-1',
      name: 'Test Brigade',
      rfsStationId: 'NSW-12345',
      location: { address: '123 Fire St', coordinates: [0, 0] },
      adminUserIds: ['user-1'],
      membershipRules: {
        requireManualApproval: false,
        allowedDomains: [],
        allowedEmails: [],
      },
      isClaimed: true,
      createdAt: '2024-01-01T00:00:00Z',
    };

    it('should prevent last admin from leaving', () => {
      const adminMembership: BrigadeMembership = {
        id: 'member-1',
        brigadeId: 'brigade-1',
        userId: 'user-1',
        role: 'admin',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = canLeaveBrigade(adminMembership, brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('last admin');
    });

    it('should allow non-admin to leave', () => {
      const operatorMembership: BrigadeMembership = {
        id: 'member-2',
        brigadeId: 'brigade-1',
        userId: 'user-2',
        role: 'operator',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = canLeaveBrigade(operatorMembership, brigade);

      expect(result.valid).toBe(true);
    });

    it('should allow admin to leave when another admin exists', () => {
      const brigadeWith2Admins = {
        ...brigade,
        adminUserIds: ['user-1', 'user-3'],
      };

      const adminMembership: BrigadeMembership = {
        id: 'member-1',
        brigadeId: 'brigade-1',
        userId: 'user-1',
        role: 'admin',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = canLeaveBrigade(adminMembership, brigadeWith2Admins);

      expect(result.valid).toBe(true);
    });
  });

  describe('isInvitationValid - Time-Sensitive Critical', () => {
    it('should accept valid pending invitation', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const invitation: MemberInvitation = {
        id: 'invite-1',
        brigadeId: 'brigade-1',
        email: 'newuser@example.com',
        role: 'operator',
        status: 'pending',
        invitedBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: futureDate.toISOString(),
      };

      const result = isInvitationValid(invitation);

      expect(result.valid).toBe(true);
    });

    it('should reject expired invitation', () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const invitation: MemberInvitation = {
        id: 'invite-1',
        brigadeId: 'brigade-1',
        email: 'newuser@example.com',
        role: 'operator',
        status: 'pending',
        invitedBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: pastDate.toISOString(),
      };

      const result = isInvitationValid(invitation);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject accepted invitation', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation: MemberInvitation = {
        id: 'invite-1',
        brigadeId: 'brigade-1',
        email: 'newuser@example.com',
        role: 'operator',
        status: 'accepted',
        invitedBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: futureDate.toISOString(),
      };

      const result = isInvitationValid(invitation);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('accepted');
    });
  });

  describe('canPromoteToAdmin - Admin Limit Critical', () => {
    it('should reject promotion when brigade already has 2 admins', () => {
      const user: User = {
        id: 'user-3',
        email: 'john@rfs.nsw.gov.au',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const membership: BrigadeMembership = {
        id: 'member-3',
        brigadeId: 'brigade-1',
        userId: 'user-3',
        role: 'operator',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1', 'user-2'], // Already 2 admins
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = canPromoteToAdmin(user, membership, brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum 2 admins');
    });

    it('should reject promotion for non-.gov.au email without verification', () => {
      const user: User = {
        id: 'user-3',
        email: 'john@gmail.com',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const membership: BrigadeMembership = {
        id: 'member-3',
        brigadeId: 'brigade-1',
        userId: 'user-3',
        role: 'operator',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1'],
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = canPromoteToAdmin(user, membership, brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('.gov.au');
    });

    it('should allow promotion for .gov.au email when slots available', () => {
      const user: User = {
        id: 'user-3',
        email: 'john@rfs.nsw.gov.au',
        name: 'John Smith',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      const membership: BrigadeMembership = {
        id: 'member-3',
        brigadeId: 'brigade-1',
        userId: 'user-3',
        role: 'operator',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1'], // Only 1 admin, slot available
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = canPromoteToAdmin(user, membership, brigade);

      expect(result.valid).toBe(true);
    });
  });

  describe('canDemoteFromAdmin - Safety Critical', () => {
    it('should prevent demoting last admin', () => {
      const membership: BrigadeMembership = {
        id: 'member-1',
        brigadeId: 'brigade-1',
        userId: 'user-1',
        role: 'admin',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1'], // Only 1 admin
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = canDemoteFromAdmin(membership, brigade);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('last admin');
    });

    it('should allow demoting admin when another admin exists', () => {
      const membership: BrigadeMembership = {
        id: 'member-1',
        brigadeId: 'brigade-1',
        userId: 'user-1',
        role: 'admin',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const brigade: Brigade = {
        id: 'brigade-1',
        name: 'Test Brigade',
        rfsStationId: 'NSW-12345',
        location: { address: '123 Fire St', coordinates: [0, 0] },
        adminUserIds: ['user-1', 'user-2'], // 2 admins
        membershipRules: {
          requireManualApproval: false,
          allowedDomains: [],
          allowedEmails: [],
        },
        isClaimed: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = canDemoteFromAdmin(membership, brigade);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateInvitationRole - Security Critical', () => {
    it('should prevent viewer from inviting operator', () => {
      const result = validateInvitationRole('viewer', 'operator');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Viewers can only invite other viewers');
    });

    it('should prevent operator from directly inviting admin', () => {
      const result = validateInvitationRole('operator', 'admin');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only admins');
    });

    it('should allow operator to invite operator', () => {
      const result = validateInvitationRole('operator', 'operator');

      expect(result.valid).toBe(true);
    });

    it('should allow admin to invite any role', () => {
      expect(validateInvitationRole('admin', 'admin').valid).toBe(true);
      expect(validateInvitationRole('admin', 'operator').valid).toBe(true);
      expect(validateInvitationRole('admin', 'viewer').valid).toBe(true);
    });
  });
});
