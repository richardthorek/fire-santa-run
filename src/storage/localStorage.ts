import type { Route, RouteTemplate, Waypoint } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import { isPublicRouteStatus } from '../utils/publicBrigade';

/**
 * LocalStorage implementation of the storage adapter.
 * Used in development mode (VITE_DEV_MODE=true).
 * Data is stored in browser localStorage with brigade namespacing.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private getStorageKey(brigadeId: string, type: 'routes' | 'brigade' | 'templates'): string {
    return `santa_${brigadeId}_${type}`;
  }

  private getGlobalStorageKey(type: 'users'): string {
    return `santa_${type}`;
  }

  async saveRoute(brigadeId: string, route: Route): Promise<void> {
    const key = this.getStorageKey(brigadeId, 'routes');
    const stored = localStorage.getItem(key);
    const routes: Route[] = stored ? JSON.parse(stored) : [];

    // Two-table schema: the route list stores RouteEntity (no waypoints);
    // waypoints live in their own store keyed by route.
    const { waypoints, ...routeEntity } = route;
    const existingIndex = routes.findIndex(r => r.id === route.id);

    if (existingIndex >= 0) {
      routes[existingIndex] = routeEntity as Route;
    } else {
      routes.push(routeEntity as Route);
    }

    localStorage.setItem(key, JSON.stringify(routes));
    await this.saveWaypoints(brigadeId, route.id, waypoints ?? []);
  }

  /**
   * Reconstruct waypoints from the waypoint store, falling back to waypoints
   * embedded in the route record (data written before the two-table split).
   */
  private async reconstructWaypoints(brigadeId: string, route: Route): Promise<Waypoint[]> {
    const separate = await this.getWaypoints(brigadeId, route.id);
    if (separate.length > 0) return separate;
    return route.waypoints ?? [];
  }

  async getRoutes(brigadeId: string): Promise<Route[]> {
    const key = this.getStorageKey(brigadeId, 'routes');
    const stored = localStorage.getItem(key);
    const routes = stored ? JSON.parse(stored) : [];

    // Reconstruct waypoints for each route
    const routesWithWaypoints = await Promise.all(
      routes.map(async (route: Route) => ({
        ...route,
        waypoints: await this.reconstructWaypoints(brigadeId, route),
      }))
    );

    return routesWithWaypoints;
  }

  async getRoute(brigadeId: string, routeId: string): Promise<Route | null> {
    const key = this.getStorageKey(brigadeId, 'routes');
    const stored = localStorage.getItem(key);
    const routes = stored ? JSON.parse(stored) : [];
    const route = routes.find((r: Route) => r.id === routeId);

    if (!route) return null;

    // Reconstruct waypoints
    const waypoints = await this.reconstructWaypoints(brigadeId, route);
    return { ...route, waypoints };
  }

  async getPublicRoute(routeId: string): Promise<Route | null> {
    // Anonymous lookup: scan every brigade's route list for the ID.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('santa_') || !key.endsWith('_routes')) continue;
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      try {
        const routes: Route[] = JSON.parse(stored);
        const route = routes.find(r => r.id === routeId);
        if (route) {
          if (!isPublicRouteStatus(route.status)) return null;
          // Key format is santa_{brigadeId}_routes — recover the brigade to
          // reconstruct waypoints from the waypoint store.
          const brigadeId = key.slice('santa_'.length, -'_routes'.length);
          const waypoints = await this.reconstructWaypoints(brigadeId, route);
          return { ...route, waypoints };
        }
      } catch {
        // Ignore malformed entries and keep scanning.
      }
    }
    return null;
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    const routes = await this.getRoutes(brigadeId);
    const filtered = routes.filter(r => r.id !== routeId);
    
    const key = this.getStorageKey(brigadeId, 'routes');
    localStorage.setItem(key, JSON.stringify(filtered));

    // Also delete waypoints for this route
    await this.deleteWaypoints(brigadeId, routeId);
  }

  // Waypoint operations
  private getWaypointsKey(brigadeId: string, routeId: string): string {
    return `santa_${brigadeId}_route_${routeId}_waypoints`;
  }

  async saveWaypoint(brigadeId: string, routeId: string, waypoint: Waypoint): Promise<void> {
    const waypoints = await this.getWaypoints(brigadeId, routeId);
    const existingIndex = waypoints.findIndex(w => w.id === waypoint.id);
    
    if (existingIndex >= 0) {
      waypoints[existingIndex] = waypoint;
    } else {
      waypoints.push(waypoint);
    }
    
    const key = this.getWaypointsKey(brigadeId, routeId);
    localStorage.setItem(key, JSON.stringify(waypoints));
  }

  async saveWaypoints(brigadeId: string, routeId: string, waypoints: Waypoint[]): Promise<void> {
    const key = this.getWaypointsKey(brigadeId, routeId);
    localStorage.setItem(key, JSON.stringify(waypoints));
  }

  async getWaypoints(brigadeId: string, routeId: string): Promise<Waypoint[]> {
    const key = this.getWaypointsKey(brigadeId, routeId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  async deleteWaypoints(brigadeId: string, routeId: string): Promise<void> {
    const key = this.getWaypointsKey(brigadeId, routeId);
    localStorage.removeItem(key);
  }

  // Template operations
  async saveTemplate(brigadeId: string, template: RouteTemplate): Promise<void> {
    const templates = await this.getTemplates(brigadeId);
    const existingIndex = templates.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }

    const key = this.getStorageKey(brigadeId, 'templates');
    localStorage.setItem(key, JSON.stringify(templates));
  }

  async getTemplates(brigadeId: string): Promise<RouteTemplate[]> {
    const key = this.getStorageKey(brigadeId, 'templates');
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  async getTemplate(brigadeId: string, templateId: string): Promise<RouteTemplate | null> {
    const templates = await this.getTemplates(brigadeId);
    return templates.find(t => t.id === templateId) || null;
  }

  async deleteTemplate(brigadeId: string, templateId: string): Promise<void> {
    const templates = await this.getTemplates(brigadeId);
    const filtered = templates.filter(t => t.id !== templateId);
    const key = this.getStorageKey(brigadeId, 'templates');
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  async getBrigades(): Promise<Brigade[]> {
    // Brigade records are stored under keys of the form `santa_<brigadeId>_brigade`
    // (see getStorageKey). Enumerate via the Web Storage length/key(i) API.
    const brigades: Brigade[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('santa_') && key.endsWith('_brigade')) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            brigades.push(JSON.parse(stored) as Brigade);
          } catch {
            // Skip malformed entries
          }
        }
      }
    }
    return brigades;
  }

  async getBrigade(brigadeId: string): Promise<Brigade | null> {
    const key = this.getStorageKey(brigadeId, 'brigade');
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async getBrigadeByStationId(fireStationId: string): Promise<Brigade | null> {
    // Since localStorage doesn't support complex queries, we need to iterate through all brigades
    // In production with Azure Table Storage, this would be an efficient query
    const allKeys = Object.keys(localStorage);
    const brigadeKeys = allKeys.filter(k => k.includes('_brigade'));
    
    for (const key of brigadeKeys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const brigade: Brigade = JSON.parse(stored);
        if (brigade.fireStationId === fireStationId) {
          return brigade;
        }
      }
    }
    
    return null;
  }

  async getBrigadeBySlug(slug: string): Promise<Brigade | null> {
    // localStorage has no indexes; iterate brigade keys (efficient query in Azure).
    const brigadeKeys = Object.keys(localStorage).filter(k => k.includes('_brigade'));

    for (const key of brigadeKeys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const brigade: Brigade = JSON.parse(stored);
        if (brigade.slug === slug) {
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
}
