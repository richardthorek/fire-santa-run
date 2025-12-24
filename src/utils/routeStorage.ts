/**
 * @deprecated Use storageAdapter directly instead.
 * This file is kept for backward compatibility but should be migrated.
 * 
 * New code should use:
 * - import { storageAdapter } from '../storage';
 * - storageAdapter.saveRoute(brigadeId, route);
 * - storageAdapter.getRoutes(brigadeId);
 */

export const generateRouteId = (): string => {
  return `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const generateShareableLink = (routeId: string, brigadeId?: string): string => {
  const baseUrl = window.location.origin;
  if (brigadeId) {
    return `${baseUrl}/brigade/${brigadeId}/track/${routeId}`;
  }
  return `${baseUrl}/track/${routeId}`;
};
