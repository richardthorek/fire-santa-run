import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';

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
}
