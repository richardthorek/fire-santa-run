import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';

/**
 * LocalStorage implementation of the storage adapter.
 * Used in development mode (VITE_DEV_MODE=true).
 * Data is stored in browser localStorage with brigade namespacing.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private getStorageKey(brigadeId: string, type: 'routes' | 'brigade'): string {
    return `santa_${brigadeId}_${type}`;
  }

  private getGlobalStorageKey(type: 'users' | 'memberships' | 'invitations' | 'verifications'): string {
    return `santa_${type}`;
  }

  async saveRoute(brigadeId: string, route: Route): Promise<void> {
    const routes = await this.getRoutes(brigadeId);
    const existingIndex = routes.findIndex(r => r.id === route.id);
    
    if (existingIndex >= 0) {
      routes[existingIndex] = route;
    } else {
      routes.push(route);
    }
    
    const key = this.getStorageKey(brigadeId, 'routes');
    localStorage.setItem(key, JSON.stringify(routes));
  }

  async getRoutes(brigadeId: string): Promise<Route[]> {
    const key = this.getStorageKey(brigadeId, 'routes');
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  async getRoute(brigadeId: string, routeId: string): Promise<Route | null> {
    const routes = await this.getRoutes(brigadeId);
    return routes.find(r => r.id === routeId) || null;
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    const routes = await this.getRoutes(brigadeId);
    const filtered = routes.filter(r => r.id !== routeId);
    
    const key = this.getStorageKey(brigadeId, 'routes');
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  async getBrigade(brigadeId: string): Promise<Brigade | null> {
    const key = this.getStorageKey(brigadeId, 'brigade');
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async getBrigadeByRFSId(rfsStationId: string): Promise<Brigade | null> {
    // Since localStorage doesn't support complex queries, we need to iterate through all brigades
    // In production with Azure Table Storage, this would be an efficient query
    const allKeys = Object.keys(localStorage);
    const brigadeKeys = allKeys.filter(k => k.includes('_brigade'));
    
    for (const key of brigadeKeys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const brigade: Brigade = JSON.parse(stored);
        if (brigade.rfsStationId === rfsStationId) {
          return brigade;
        }
      }
    }
    
    return null;
  }

  async saveBrigade(brigade: Brigade): Promise<void> {
    const key = this.getStorageKey(brigade.id, 'brigade');
    localStorage.setItem(key, JSON.stringify(brigade));
  }

  // User operations
  async saveUser(user: User): Promise<void> {
    const key = this.getGlobalStorageKey('users');
    const stored = localStorage.getItem(key);
    const users: User[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    
    localStorage.setItem(key, JSON.stringify(users));
  }

  async getUser(userId: string): Promise<User | null> {
    const key = this.getGlobalStorageKey('users');
    const stored = localStorage.getItem(key);
    const users: User[] = stored ? JSON.parse(stored) : [];
    return users.find(u => u.id === userId) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const key = this.getGlobalStorageKey('users');
    const stored = localStorage.getItem(key);
    const users: User[] = stored ? JSON.parse(stored) : [];
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  // Membership operations
  async saveMembership(membership: BrigadeMembership): Promise<void> {
    const key = this.getGlobalStorageKey('memberships');
    const stored = localStorage.getItem(key);
    const memberships: BrigadeMembership[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = memberships.findIndex(m => m.id === membership.id);
    if (existingIndex >= 0) {
      memberships[existingIndex] = membership;
    } else {
      memberships.push(membership);
    }
    
    localStorage.setItem(key, JSON.stringify(memberships));
  }

  async getMembership(brigadeId: string, userId: string): Promise<BrigadeMembership | null> {
    const key = this.getGlobalStorageKey('memberships');
    const stored = localStorage.getItem(key);
    const memberships: BrigadeMembership[] = stored ? JSON.parse(stored) : [];
    return memberships.find(m => m.brigadeId === brigadeId && m.userId === userId) || null;
  }

  async getMembershipById(membershipId: string): Promise<BrigadeMembership | null> {
    const key = this.getGlobalStorageKey('memberships');
    const stored = localStorage.getItem(key);
    const memberships: BrigadeMembership[] = stored ? JSON.parse(stored) : [];
    return memberships.find(m => m.id === membershipId) || null;
  }

  async deleteMembership(brigadeId: string, userId: string): Promise<void> {
    const key = this.getGlobalStorageKey('memberships');
    const stored = localStorage.getItem(key);
    const memberships: BrigadeMembership[] = stored ? JSON.parse(stored) : [];
    const filtered = memberships.filter(m => !(m.brigadeId === brigadeId && m.userId === userId));
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  async getMembershipsByUser(userId: string): Promise<BrigadeMembership[]> {
    const key = this.getGlobalStorageKey('memberships');
    const stored = localStorage.getItem(key);
    const memberships: BrigadeMembership[] = stored ? JSON.parse(stored) : [];
    return memberships.filter(m => m.userId === userId);
  }

  async getMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]> {
    const key = this.getGlobalStorageKey('memberships');
    const stored = localStorage.getItem(key);
    const memberships: BrigadeMembership[] = stored ? JSON.parse(stored) : [];
    return memberships.filter(m => m.brigadeId === brigadeId);
  }

  async getPendingMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]> {
    const memberships = await this.getMembershipsByBrigade(brigadeId);
    return memberships.filter(m => m.status === 'pending');
  }

  // Invitation operations
  async saveInvitation(invitation: MemberInvitation): Promise<void> {
    const key = this.getGlobalStorageKey('invitations');
    const stored = localStorage.getItem(key);
    const invitations: MemberInvitation[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = invitations.findIndex(i => i.id === invitation.id);
    if (existingIndex >= 0) {
      invitations[existingIndex] = invitation;
    } else {
      invitations.push(invitation);
    }
    
    localStorage.setItem(key, JSON.stringify(invitations));
  }

  async getInvitation(invitationId: string): Promise<MemberInvitation | null> {
    const key = this.getGlobalStorageKey('invitations');
    const stored = localStorage.getItem(key);
    const invitations: MemberInvitation[] = stored ? JSON.parse(stored) : [];
    return invitations.find(i => i.id === invitationId) || null;
  }

  async getInvitationByToken(token: string): Promise<MemberInvitation | null> {
    const key = this.getGlobalStorageKey('invitations');
    const stored = localStorage.getItem(key);
    const invitations: MemberInvitation[] = stored ? JSON.parse(stored) : [];
    return invitations.find(i => i.token === token) || null;
  }

  async getPendingInvitationsByBrigade(brigadeId: string): Promise<MemberInvitation[]> {
    const key = this.getGlobalStorageKey('invitations');
    const stored = localStorage.getItem(key);
    const invitations: MemberInvitation[] = stored ? JSON.parse(stored) : [];
    return invitations.filter(i => i.brigadeId === brigadeId && i.status === 'pending');
  }

  async expireInvitations(): Promise<void> {
    const key = this.getGlobalStorageKey('invitations');
    const stored = localStorage.getItem(key);
    const invitations: MemberInvitation[] = stored ? JSON.parse(stored) : [];
    
    const now = new Date().toISOString();
    const updated = invitations.map(i => {
      if (i.status === 'pending' && i.expiresAt < now) {
        return { ...i, status: 'expired' as const };
      }
      return i;
    });
    
    localStorage.setItem(key, JSON.stringify(updated));
  }

  // Verification operations
  async saveVerificationRequest(request: AdminVerificationRequest): Promise<void> {
    const key = this.getGlobalStorageKey('verifications');
    const stored = localStorage.getItem(key);
    const requests: AdminVerificationRequest[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = requests.findIndex(r => r.id === request.id);
    if (existingIndex >= 0) {
      requests[existingIndex] = request;
    } else {
      requests.push(request);
    }
    
    localStorage.setItem(key, JSON.stringify(requests));
  }

  async getVerificationRequest(requestId: string): Promise<AdminVerificationRequest | null> {
    const key = this.getGlobalStorageKey('verifications');
    const stored = localStorage.getItem(key);
    const requests: AdminVerificationRequest[] = stored ? JSON.parse(stored) : [];
    return requests.find(r => r.id === requestId) || null;
  }

  async getVerificationsByUser(userId: string): Promise<AdminVerificationRequest[]> {
    const key = this.getGlobalStorageKey('verifications');
    const stored = localStorage.getItem(key);
    const requests: AdminVerificationRequest[] = stored ? JSON.parse(stored) : [];
    return requests.filter(r => r.userId === userId);
  }

  async getPendingVerifications(): Promise<AdminVerificationRequest[]> {
    const key = this.getGlobalStorageKey('verifications');
    const stored = localStorage.getItem(key);
    const requests: AdminVerificationRequest[] = stored ? JSON.parse(stored) : [];
    return requests.filter(r => r.status === 'pending');
  }

  async approveVerification(requestId: string, reviewedBy: string, reviewNotes?: string): Promise<void> {
    const request = await this.getVerificationRequest(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }
    
    request.status = 'approved';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date().toISOString();
    request.reviewNotes = reviewNotes;
    request.updatedAt = new Date().toISOString();
    
    await this.saveVerificationRequest(request);
    
    // Add brigade to user's verifiedBrigades
    const user = await this.getUser(request.userId);
    if (user) {
      if (!user.verifiedBrigades) {
        user.verifiedBrigades = [];
      }
      if (!user.verifiedBrigades.includes(request.brigadeId)) {
        user.verifiedBrigades.push(request.brigadeId);
        await this.saveUser(user);
      }
    }
  }

  async rejectVerification(requestId: string, reviewedBy: string, reviewNotes: string): Promise<void> {
    const request = await this.getVerificationRequest(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }
    
    request.status = 'rejected';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date().toISOString();
    request.reviewNotes = reviewNotes;
    request.updatedAt = new Date().toISOString();
    
    await this.saveVerificationRequest(request);
  }
}
