import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';

/**
 * LocalStorage implementation of the storage adapter.
 * Used in development mode (VITE_DEV_MODE=true).
 * Data is stored in browser localStorage with brigade namespacing.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private getStorageKey(brigadeId: string, type: 'routes' | 'brigade'): string {
    return `santa_${brigadeId}_${type}`;
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

  async saveBrigade(brigade: Brigade): Promise<void> {
    const key = this.getStorageKey(brigade.id, 'brigade');
    localStorage.setItem(key, JSON.stringify(brigade));
  }
}
