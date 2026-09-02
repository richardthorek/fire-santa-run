import type { Route, RouteTemplate, Waypoint } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import { getApiAuthHeaders } from '../auth/apiToken';

/** Error thrown by route writes, tagging the HTTP status so callers can react
 *  (e.g. the editor shows a subscribe prompt on 402, a permissions note on 403). */
export class RouteWriteError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RouteWriteError';
    this.status = status;
  }
}

/** Build a friendly, status-aware error for a failed route create/update. */
async function routeWriteError(response: Response, verb: 'create' | 'update'): Promise<RouteWriteError> {
  let serverMessage = '';
  try {
    const body = await response.clone().json();
    serverMessage = typeof body?.message === 'string' ? body.message : '';
  } catch {
    // Non-JSON error body — fall back to status text.
  }
  if (response.status === 402) {
    return new RouteWriteError(
      serverMessage || 'An active brigade subscription is required to plan routes.',
      402,
    );
  }
  if (response.status === 403) {
    return new RouteWriteError(
      serverMessage || 'You do not have permission to change this brigade’s routes.',
      403,
    );
  }
  return new RouteWriteError(serverMessage || `Failed to ${verb} route: ${response.statusText}`, response.status);
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
    return getApiAuthHeaders();
  }

  // Routes
  async getRoutes(brigadeId: string): Promise<Route[]> {
    // Send the bearer token: the server only returns non-public (draft) routes
    // to an authenticated member of the owning brigade. Without it, a brigade
    // admin's own Dashboard would silently drop their drafts.
    const response = await fetch(`${this.apiBaseUrl}/routes?brigadeId=${encodeURIComponent(brigadeId)}`, {
      headers: await getApiAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch routes: ${response.statusText}`);
    }
    return await response.json();
  }

  async getRoute(brigadeId: string, routeId: string): Promise<Route | null> {
    // Authenticated so a member can open their own drafts (see getRoutes).
    const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}?brigadeId=${encodeURIComponent(brigadeId)}`, {
      headers: await getApiAuthHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch route: ${response.statusText}`);
    }
    return await response.json();
  }

  async getPublicRoute(routeId: string): Promise<Route | null> {
    // No brigadeId: the API resolves the route by ID alone and only returns
    // publicly visible routes. Powers the anonymous /track/:id page.
    const response = await fetch(`${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}`);
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
        throw await routeWriteError(response, 'update');
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
        throw await routeWriteError(response, 'create');
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

  // Waypoints
  async saveWaypoint(brigadeId: string, routeId: string, waypoint: Waypoint): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(
      `${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}/waypoints/${encodeURIComponent(waypoint.id)}?brigadeId=${encodeURIComponent(brigadeId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(waypoint),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to save waypoint: ${response.statusText}`);
    }
  }

  async saveWaypoints(brigadeId: string, routeId: string, waypoints: Waypoint[]): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(
      `${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}/waypoints?brigadeId=${encodeURIComponent(brigadeId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(waypoints),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to save waypoints: ${response.statusText}`);
    }
  }

  async getWaypoints(brigadeId: string, routeId: string): Promise<Waypoint[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}/waypoints?brigadeId=${encodeURIComponent(brigadeId)}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch waypoints: ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteWaypoints(brigadeId: string, routeId: string): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(
      `${this.apiBaseUrl}/routes/${encodeURIComponent(routeId)}/waypoints?brigadeId=${encodeURIComponent(brigadeId)}`,
      {
        method: 'DELETE',
        headers: { ...authHeaders },
      }
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete waypoints: ${response.statusText}`);
    }
  }

  // Templates
  async getTemplates(brigadeId: string): Promise<RouteTemplate[]> {
    const response = await fetch(`${this.apiBaseUrl}/templates?brigadeId=${encodeURIComponent(brigadeId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    return await response.json();
  }

  async getTemplate(brigadeId: string, templateId: string): Promise<RouteTemplate | null> {
    const response = await fetch(`${this.apiBaseUrl}/templates/${encodeURIComponent(templateId)}?brigadeId=${encodeURIComponent(brigadeId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    return await response.json();
  }

  async saveTemplate(brigadeId: string, template: RouteTemplate): Promise<void> {
    const existingTemplate = await this.getTemplate(brigadeId, template.id);

    if (existingTemplate) {
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/templates/${encodeURIComponent(template.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(template),
      });
      if (!response.ok) {
        throw new Error(`Failed to update template: ${response.statusText}`);
      }
    } else {
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(template),
      });
      if (!response.ok) {
        throw new Error(`Failed to create template: ${response.statusText}`);
      }
    }
  }

  async deleteTemplate(brigadeId: string, templateId: string): Promise<void> {
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(`${this.apiBaseUrl}/templates/${encodeURIComponent(templateId)}?brigadeId=${encodeURIComponent(brigadeId)}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete template: ${response.statusText}`);
    }
  }

  // Brigades
  async getBrigades(): Promise<Brigade[]> {
    // Use the sanitised public projection — this powers the public discovery
    // page and must not leak member emails, allowed domains, or admin user IDs.
    const response = await fetch(`${this.apiBaseUrl}/brigades/public`);
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

  async getBrigadeByStationId(fireStationId: string): Promise<Brigade | null> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/by-station/${encodeURIComponent(fireStationId)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch brigade by station ID: ${response.statusText}`);
    }
    return await this.parseJsonResponse(response);
  }

  async getBrigadeBySlug(slug: string): Promise<Brigade | null> {
    const response = await fetch(`${this.apiBaseUrl}/brigades/by-slug/${encodeURIComponent(slug)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch brigade by slug: ${response.statusText}`);
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
    const response = await fetch(`${this.apiBaseUrl}/users/${encodeURIComponent(userId)}`, {
      headers: await getApiAuthHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    return await this.parseJsonResponse(response);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const response = await fetch(`${this.apiBaseUrl}/users/by-email/${encodeURIComponent(email)}`, {
      headers: await getApiAuthHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch user by email: ${response.statusText}`);
    }
    return await this.parseJsonResponse(response);
  }

}
