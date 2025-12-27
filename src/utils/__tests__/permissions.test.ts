/**
 * Unit tests for permission checking utilities (RBAC)
 */

import { describe, it, expect } from 'vitest';
import {
  canManageRoutes,
  canInviteMembers,
  canManageMembers,
  canEditBrigadeSettings,
  canPromoteToAdmin,
  canDemoteFromAdmin,
  canRemoveMember,
  canViewMembers,
  canCancelInvitation,
  canStartNavigation,
  canApproveMembership,
  getRoleDisplayName,
  getRoleDescription,
  getAvailableRolesToInvite,
} from '../permissions';
import type { BrigadeMembership, MemberRole } from '../../types/membership';

describe('permissions', () => {
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

  const viewerMembership: BrigadeMembership = {
    id: 'member-3',
    brigadeId: 'brigade-1',
    userId: 'user-3',
    role: 'viewer',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const pendingMembership: BrigadeMembership = {
    id: 'member-4',
    brigadeId: 'brigade-1',
    userId: 'user-4',
    role: 'operator',
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  describe('canManageRoutes', () => {
    it('should allow admin to manage routes', () => {
      expect(canManageRoutes(adminMembership)).toBe(true);
    });

    it('should allow operator to manage routes', () => {
      expect(canManageRoutes(operatorMembership)).toBe(true);
    });

    it('should not allow viewer to manage routes', () => {
      expect(canManageRoutes(viewerMembership)).toBe(false);
    });

    it('should not allow null membership', () => {
      expect(canManageRoutes(null)).toBe(false);
    });

    it('should not allow pending membership', () => {
      expect(canManageRoutes(pendingMembership)).toBe(false);
    });
  });

  describe('canInviteMembers', () => {
    it('should allow admin to invite anyone', () => {
      expect(canInviteMembers(adminMembership, 'admin')).toBe(true);
      expect(canInviteMembers(adminMembership, 'operator')).toBe(true);
      expect(canInviteMembers(adminMembership, 'viewer')).toBe(true);
    });

    it('should allow operator to invite viewers and operators', () => {
      expect(canInviteMembers(operatorMembership, 'operator')).toBe(true);
      expect(canInviteMembers(operatorMembership, 'viewer')).toBe(true);
    });

    it('should not allow operator to invite admins', () => {
      expect(canInviteMembers(operatorMembership, 'admin')).toBe(false);
    });

    it('should not allow viewer to invite', () => {
      expect(canInviteMembers(viewerMembership)).toBe(false);
      expect(canInviteMembers(viewerMembership, 'viewer')).toBe(false);
    });

    it('should allow checking without target role', () => {
      expect(canInviteMembers(adminMembership)).toBe(true);
      expect(canInviteMembers(operatorMembership)).toBe(true);
    });
  });

  describe('canManageMembers', () => {
    it('should allow admin to manage all members', () => {
      expect(canManageMembers(adminMembership)).toBe(true);
      expect(canManageMembers(adminMembership, operatorMembership)).toBe(true);
      expect(canManageMembers(adminMembership, viewerMembership)).toBe(true);
    });

    it('should allow operator to manage non-admin members', () => {
      expect(canManageMembers(operatorMembership, operatorMembership)).toBe(true);
      expect(canManageMembers(operatorMembership, viewerMembership)).toBe(true);
    });

    it('should not allow operator to manage admins', () => {
      expect(canManageMembers(operatorMembership, adminMembership)).toBe(false);
    });

    it('should not allow viewer to manage members', () => {
      expect(canManageMembers(viewerMembership)).toBe(false);
      expect(canManageMembers(viewerMembership, viewerMembership)).toBe(false);
    });
  });

  describe('canEditBrigadeSettings', () => {
    it('should allow admin to edit settings', () => {
      expect(canEditBrigadeSettings(adminMembership)).toBe(true);
    });

    it('should not allow operator to edit settings', () => {
      expect(canEditBrigadeSettings(operatorMembership)).toBe(false);
    });

    it('should not allow viewer to edit settings', () => {
      expect(canEditBrigadeSettings(viewerMembership)).toBe(false);
    });
  });

  describe('canPromoteToAdmin', () => {
    it('should allow admin to promote', () => {
      expect(canPromoteToAdmin(adminMembership)).toBe(true);
    });

    it('should not allow operator to promote', () => {
      expect(canPromoteToAdmin(operatorMembership)).toBe(false);
    });

    it('should not allow viewer to promote', () => {
      expect(canPromoteToAdmin(viewerMembership)).toBe(false);
    });
  });

  describe('canDemoteFromAdmin', () => {
    it('should allow admin to demote other admin', () => {
      expect(canDemoteFromAdmin(adminMembership, false)).toBe(true);
    });

    it('should not allow demoting last admin', () => {
      expect(canDemoteFromAdmin(adminMembership, true)).toBe(false);
    });

    it('should not allow operator to demote', () => {
      expect(canDemoteFromAdmin(operatorMembership, false)).toBe(false);
    });

    it('should not allow viewer to demote', () => {
      expect(canDemoteFromAdmin(viewerMembership, false)).toBe(false);
    });
  });

  describe('canRemoveMember', () => {
    it('should allow admin to remove anyone', () => {
      expect(canRemoveMember(adminMembership, operatorMembership, false)).toBe(true);
      expect(canRemoveMember(adminMembership, viewerMembership, false)).toBe(true);
    });

    it('should not allow removing last admin', () => {
      expect(canRemoveMember(adminMembership, adminMembership, true)).toBe(false);
    });

    it('should allow operator to remove non-admins', () => {
      expect(canRemoveMember(operatorMembership, operatorMembership, false)).toBe(true);
      expect(canRemoveMember(operatorMembership, viewerMembership, false)).toBe(true);
    });

    it('should not allow operator to remove admins', () => {
      expect(canRemoveMember(operatorMembership, adminMembership, false)).toBe(false);
    });

    it('should not allow viewer to remove anyone', () => {
      expect(canRemoveMember(viewerMembership, viewerMembership, false)).toBe(false);
    });
  });

  describe('canViewMembers', () => {
    it('should allow all active members to view', () => {
      expect(canViewMembers(adminMembership)).toBe(true);
      expect(canViewMembers(operatorMembership)).toBe(true);
      expect(canViewMembers(viewerMembership)).toBe(true);
    });

    it('should not allow pending members to view', () => {
      expect(canViewMembers(pendingMembership)).toBe(false);
    });

    it('should not allow null membership', () => {
      expect(canViewMembers(null)).toBe(false);
    });
  });

  describe('canCancelInvitation', () => {
    it('should allow admin to cancel any invitation', () => {
      expect(canCancelInvitation(adminMembership, 'other-user')).toBe(true);
      expect(canCancelInvitation(adminMembership, adminMembership.userId)).toBe(true);
    });

    it('should allow operator to cancel their own invitations', () => {
      expect(canCancelInvitation(operatorMembership, operatorMembership.userId)).toBe(true);
    });

    it('should not allow operator to cancel others invitations', () => {
      expect(canCancelInvitation(operatorMembership, 'other-user')).toBe(false);
    });

    it('should not allow viewer to cancel invitations', () => {
      expect(canCancelInvitation(viewerMembership, viewerMembership.userId)).toBe(false);
    });
  });

  describe('canStartNavigation', () => {
    it('should allow admin to start navigation', () => {
      expect(canStartNavigation(adminMembership)).toBe(true);
    });

    it('should allow operator to start navigation', () => {
      expect(canStartNavigation(operatorMembership)).toBe(true);
    });

    it('should not allow viewer to start navigation', () => {
      expect(canStartNavigation(viewerMembership)).toBe(false);
    });

    it('should not allow pending membership', () => {
      expect(canStartNavigation(pendingMembership)).toBe(false);
    });
  });

  describe('canApproveMembership', () => {
    it('should allow admin to approve anyone', () => {
      expect(canApproveMembership(adminMembership, 'admin')).toBe(true);
      expect(canApproveMembership(adminMembership, 'operator')).toBe(true);
      expect(canApproveMembership(adminMembership, 'viewer')).toBe(true);
    });

    it('should allow operator to approve non-admins', () => {
      expect(canApproveMembership(operatorMembership, 'operator')).toBe(true);
      expect(canApproveMembership(operatorMembership, 'viewer')).toBe(true);
    });

    it('should not allow operator to approve admins', () => {
      expect(canApproveMembership(operatorMembership, 'admin')).toBe(false);
    });

    it('should not allow viewer to approve', () => {
      expect(canApproveMembership(viewerMembership, 'viewer')).toBe(false);
    });

    it('should allow checking without target role', () => {
      expect(canApproveMembership(adminMembership)).toBe(true);
      expect(canApproveMembership(operatorMembership)).toBe(true);
    });
  });

  describe('getRoleDisplayName', () => {
    it('should return proper display names', () => {
      expect(getRoleDisplayName('admin')).toBe('Admin');
      expect(getRoleDisplayName('operator')).toBe('Operator');
      expect(getRoleDisplayName('viewer')).toBe('Viewer');
    });
  });

  describe('getRoleDescription', () => {
    it('should return role descriptions', () => {
      expect(getRoleDescription('admin')).toContain('Full access');
      expect(getRoleDescription('operator')).toContain('Create and manage routes');
      expect(getRoleDescription('viewer')).toContain('View routes');
    });
  });

  describe('getAvailableRolesToInvite', () => {
    it('should return all roles for admin', () => {
      const roles = getAvailableRolesToInvite(adminMembership);
      
      expect(roles).toContain('admin');
      expect(roles).toContain('operator');
      expect(roles).toContain('viewer');
      expect(roles).toHaveLength(3);
    });

    it('should return operator and viewer for operator', () => {
      const roles = getAvailableRolesToInvite(operatorMembership);
      
      expect(roles).toContain('operator');
      expect(roles).toContain('viewer');
      expect(roles).not.toContain('admin');
      expect(roles).toHaveLength(2);
    });

    it('should return empty array for viewer', () => {
      const roles = getAvailableRolesToInvite(viewerMembership);
      
      expect(roles).toHaveLength(0);
    });

    it('should return empty array for null membership', () => {
      const roles = getAvailableRolesToInvite(null);
      
      expect(roles).toHaveLength(0);
    });

    it('should return empty array for pending membership', () => {
      const roles = getAvailableRolesToInvite(pendingMembership);
      
      expect(roles).toHaveLength(0);
    });
  });
});
