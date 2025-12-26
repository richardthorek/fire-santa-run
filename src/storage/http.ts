import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';

/**
 * HTTP API storage adapter for production mode.
 * Calls Azure Functions API endpoints instead of directly accessing Azure Table Storage.
 * This is the correct architecture for browser-based clients.
 */
export class HttpStorageAdapter implements IStorageAdapter {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  // Routes
  async getRoutes(brigadeId: string): Promise<Route[]> {
    const response = await fetch(`${this.apiBaseUrl}/routes?brigadeId=${encodeURIComponent(brigadeId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch routes: ${response.statusText}`);
    }
    return await response.json();
  }

  async getRoute(brigadeId: string, routeId: string): Promise<Route | null> {
    const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}?brigadeId=${encodeURIComponent(brigadeId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch route: ${response.statusText}`);
    }
    return await response.json();
  }

  async saveRoute(brigadeId: string, route: Route): Promise<void> {
    // Determine if this is a create or update
    const existingRoute = await this.getRoute(brigadeId, route.id);
    
    if (existingRoute) {
      // Update
      const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(route.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });
      if (!response.ok) {
        throw new Error(`Failed to update route: ${response.statusText}`);
      }
    } else {
      // Create
      const response = await fetch(`${this.apiBaseUrl}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });
      if (!response.ok) {
        throw new Error(`Failed to create route: ${response.statusText}`);
      }
    }
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}?brigadeId=${encodeURIComponent(brigadeId)}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete route: ${response.statusText}`);
    }
  }

  // Brigades
  async getBrigades(): Promise<Brigade[]> {
    const response = await fetch(`${this.apiBaseUrl}/brigades`);
    if (!response.ok) {
      throw new Error(`Failed to fetch brigades: ${response.statusText}`);
    }
    return await response.json();
  }

  async getBrigade(brigadeId: string): Promise<Brigade | null> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigadeId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch brigade: ${response.statusText}`);
    }
    return await response.json();
  }

  async getBrigadeByRFSId(rfsStationId: string): Promise<Brigade | null> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/rfs/${encodeURIComponent(rfsStationId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch brigade by RFS ID: ${response.statusText}`);
    }
    return await response.json();
  }

  async saveBrigade(brigade: Brigade): Promise<void> {
    const existingBrigade = await this.getBrigade(brigade.id);
    
    if (existingBrigade) {
      // Update
      const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigade.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brigade),
      });
      if (!response.ok) {
        throw new Error(`Failed to update brigade: ${response.statusText}`);
      }
    } else {
      // Create
      const response = await fetch(`${this.apiBaseUrl}/brigades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brigade),
      });
      if (!response.ok) {
        throw new Error(`Failed to create brigade: ${response.statusText}`);
      }
    }
  }

  async deleteBrigade(brigadeId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigadeId)}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete brigade: ${response.statusText}`);
    }
  }

  // User operations
  async saveUser(user: User): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      throw new Error(`Failed to save user: ${response.statusText}`);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const response = await fetch(`${this.apiBaseUrl}/users/${encodeURIComponent(userId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    return await response.json();
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const response = await fetch(`${this.apiBaseUrl}/users/by-email/${encodeURIComponent(email)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch user by email: ${response.statusText}`);
    }
    return await response.json();
  }

  // Membership operations
  async saveMembership(_membership: BrigadeMembership): Promise<void> {
    throw new Error('Membership operations not yet implemented in HTTP adapter');
  }

  async getMembership(_brigadeId: string, _userId: string): Promise<BrigadeMembership | null> {
    throw new Error('Membership operations not yet implemented in HTTP adapter');
  }

  async getMembershipById(_membershipId: string): Promise<BrigadeMembership | null> {
    throw new Error('Membership operations not yet implemented in HTTP adapter');
  }

  async deleteMembership(_brigadeId: string, _userId: string): Promise<void> {
    throw new Error('Membership operations not yet implemented in HTTP adapter');
  }

  async getMembershipsByUser(userId: string): Promise<BrigadeMembership[]> {
    const response = await fetch(`${this.apiBaseUrl}/users/${encodeURIComponent(userId)}/memberships`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user memberships: ${response.statusText}`);
    }
    return await response.json();
  }

  async getMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigadeId)}/members`);
    if (!response.ok) {
      throw new Error(`Failed to fetch brigade memberships: ${response.statusText}`);
    }
    return await response.json();
  }

  async getPendingMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigadeId)}/members/pending`);
    if (!response.ok) {
      throw new Error(`Failed to fetch pending brigade memberships: ${response.statusText}`);
    }
    return await response.json();
  }

  // Invitation operations (Phase 6a - API endpoints to be implemented in Phase 7)
  async saveInvitation(_invitation: MemberInvitation): Promise<void> {
    throw new Error('Invitation operations not yet implemented in HTTP adapter');
  }

  async getInvitation(_invitationId: string): Promise<MemberInvitation | null> {
    throw new Error('Invitation operations not yet implemented in HTTP adapter');
  }

  async getInvitationByToken(_token: string): Promise<MemberInvitation | null> {
    throw new Error('Invitation operations not yet implemented in HTTP adapter');
  }

  async getPendingInvitationsByBrigade(_brigadeId: string): Promise<MemberInvitation[]> {
    throw new Error('Invitation operations not yet implemented in HTTP adapter');
  }

  async expireInvitations(): Promise<void> {
    throw new Error('Invitation operations not yet implemented in HTTP adapter');
  }

  // Verification operations (Phase 6a - API endpoints to be implemented in Phase 7)
  async saveVerificationRequest(_request: AdminVerificationRequest): Promise<void> {
    throw new Error('Verification operations not yet implemented in HTTP adapter');
  }

  async getVerificationRequest(_requestId: string): Promise<AdminVerificationRequest | null> {
    throw new Error('Verification operations not yet implemented in HTTP adapter');
  }

  async getVerificationsByUser(_userId: string): Promise<AdminVerificationRequest[]> {
    throw new Error('Verification operations not yet implemented in HTTP adapter');
  }

  async getPendingVerifications(): Promise<AdminVerificationRequest[]> {
    throw new Error('Verification operations not yet implemented in HTTP adapter');
  }

  async approveVerification(_requestId: string, _reviewedBy: string, _reviewNotes?: string): Promise<void> {
    throw new Error('Verification operations not yet implemented in HTTP adapter');
  }

  async rejectVerification(_requestId: string, _reviewedBy: string, _reviewNotes: string): Promise<void> {
    throw new Error('Verification operations not yet implemented in HTTP adapter');
  }
}
