import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';
import type { PublicClientApplication } from '@azure/msal-browser';
import { tokenRequest } from '../auth/msalConfig';

// Access token helper for API calls in production mode.
async function getAccessToken(): Promise<string | null> {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
  
  // In dev mode, authentication should be bypassed by the backend
  // So we don't need to attach tokens
  if (isDevMode) {
    console.log('[HTTP] Dev mode enabled. No token required for API calls.');
    return null;
  }
  
  // In production mode, we need a client ID to be configured
  if (!clientId) {
    console.error(
      '[HTTP] Production mode detected (VITE_DEV_MODE=false or not set) but VITE_ENTRA_CLIENT_ID is not configured.\n' +
      'To fix this:\n' +
      '1. For local development: Create .env.local and set VITE_DEV_MODE=true\n' +
      '2. For production testing: Set VITE_ENTRA_CLIENT_ID and other Entra variables in .env.local\n' +
      'See .env.example for configuration template.'
    );
    return null;
  }

  if (typeof window === 'undefined') {
    console.warn('[HTTP] getAccessToken: Not in browser environment');
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msalInstance = (window as any).__msalInstance as PublicClientApplication | undefined;
  if (!msalInstance) {
    console.error('[HTTP] getAccessToken: MSAL instance not found on window');
    return null;
  }

  const account = msalInstance.getActiveAccount();
  if (!account) {
    console.error('[HTTP] getAccessToken: No active account found. User may not be logged in.');
    return null;
  }

  try {
    console.log('[HTTP] Attempting to acquire token with scopes:', tokenRequest.scopes);
    const response = await msalInstance.acquireTokenSilent({
      ...tokenRequest,
      account,
    });
    // Type assertion needed as idTokenClaims is not in the public API type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log('[HTTP] Token acquired successfully. Audience:', (response as any).idTokenClaims?.aud);
    return response.accessToken;
  } catch (error) {
    console.warn('[HTTP] Failed to acquire access token for API request (silent):', (error as any)?.message || error);
    // If interaction is required, try an interactive popup to allow consent/login
    try {
      // Some MSAL errors indicate user interaction is required
      // Try acquireTokenPopup to prompt the user for consent to the API scope
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any) && ((error as any).name === 'InteractionRequiredAuthError' || (error as any)?.errorCode === 'interaction_required')) {
        try {
          const popupResponse = await msalInstance.acquireTokenPopup({ ...tokenRequest, account });
          console.info('[HTTP] Acquired token via popup for API request');
          return popupResponse.accessToken;
        } catch (popupErr) {
          console.warn('[HTTP] acquireTokenPopup failed or was blocked:', (popupErr as any)?.message || popupErr);
          return null;
        }
      }

      // If not interaction-required, log details for diagnosis
      console.debug('[HTTP] MSAL error details:', {
        name: (error as any)?.name,
        errorCode: (error as any)?.errorCode,
        subError: (error as any)?.subError,
        message: (error as any)?.message,
      });
    } catch (e) {
      console.warn('[HTTP] Error handling token acquisition failure:', e);
    }

    return null;
  }
}

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

  private async parseJsonResponse(response: Response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON response from API but received: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
    const token = await getAccessToken();
    
    // In production mode, if we can't get a token, this is a critical error
    if (!token && !isDevMode) {
      throw new Error(
        'Cannot make authenticated API request: No access token available.\n' +
        'This usually means:\n' +
        '1. User is not logged in (check AuthContext.isAuthenticated)\n' +
        '2. Token acquisition failed (check browser console for MSAL errors)\n' +
        '3. MSAL configuration is incorrect\n\n' +
        'Please log in and try again.'
      );
    }
    
    return token ? { Authorization: `Bearer ${token}` } : {};
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
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(route.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(route),
      });
      if (!response.ok) {
        throw new Error(`Failed to update route: ${response.statusText}`);
      }
    } else {
      // Create
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(route),
      });
      if (!response.ok) {
        throw new Error(`Failed to create route: ${response.statusText}`);
      }
    }
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}?brigadeId=${encodeURIComponent(brigadeId)}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
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
    return await this.parseJsonResponse(response);
  }

  async getBrigadeByRFSId(rfsStationId: string): Promise<Brigade | null> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/rfs/${encodeURIComponent(rfsStationId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch brigade by RFS ID: ${response.statusText}`);
    }
    return await this.parseJsonResponse(response);
  }

  async saveBrigade(brigade: Brigade): Promise<void> {
    const existingBrigade = await this.getBrigade(brigade.id);
    
    if (existingBrigade) {
      // Update
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigade.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(brigade),
      });
      if (!response.ok) {
        throw new Error(`Failed to update brigade: ${response.statusText}`);
      }
    } else {
      // Create
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/brigades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(brigade),
      });
      if (!response.ok) {
        throw new Error(`Failed to create brigade: ${response.statusText}`);
      }
    }
  }

  async deleteBrigade(brigadeId: string): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(`${this.apiBaseUrl}/brigades/${encodeURIComponent(brigadeId)}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete brigade: ${response.statusText}`);
    }
  }

  // User operations
  async saveUser(user: User): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(`${this.apiBaseUrl}/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
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
    return await this.parseJsonResponse(response);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const response = await fetch(`${this.apiBaseUrl}/users/by-email/${encodeURIComponent(email)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch user by email: ${response.statusText}`);
    }
    return await this.parseJsonResponse(response);
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
    return await this.parseJsonResponse(response);
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
