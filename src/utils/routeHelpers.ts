/**
 * Route helper utilities for ID generation, links, and status management
 */

import type { Route, RouteStatus, Waypoint } from '../types';

/**
 * Generate a unique route ID
 */
export function generateRouteId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique waypoint ID
 */
export function generateWaypointId(): string {
  return `waypoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate shareable tracking link for a route
 */
export function generateShareableLink(routeId: string): string {
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${baseUrl}/track/${routeId}`;
}

/**
 * Check if a route can be edited (only draft routes can be edited)
 */
export function canEditRoute(status: RouteStatus): boolean {
  return status === 'draft';
}

/**
 * Check if a route can be published
 */
export function canPublishRoute(route: Route): boolean {
  return (
    route.status === 'draft' &&
    route.waypoints.length >= 2 &&
    route.name.trim() !== '' &&
    route.date !== ''
  );
}

/**
 * Check if a route can be started (navigation)
 */
export function canStartRoute(status: RouteStatus): boolean {
  return status === 'published';
}

/**
 * Check if a route can be deleted
 */
export function canDeleteRoute(status: RouteStatus): boolean {
  return status === 'draft' || status === 'completed' || status === 'archived';
}

/**
 * Sort waypoints by order field
 */
export function sortWaypoints(waypoints: Waypoint[]): Waypoint[] {
  return [...waypoints].sort((a, b) => a.order - b.order);
}

/**
 * Reorder waypoints after drag and drop
 */
export function reorderWaypoints(
  waypoints: Waypoint[],
  fromIndex: number,
  toIndex: number
): Waypoint[] {
  const sorted = sortWaypoints(waypoints);
  const result = Array.from(sorted);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  
  // Update order field for all waypoints
  return result.map((wp, index) => ({
    ...wp,
    order: index,
  }));
}

/**
 * Get status badge color
 */
export function getStatusColor(status: RouteStatus): string {
  const colors: Record<RouteStatus, string> = {
    draft: '#616161',
    published: '#29B6F6',
    active: '#D32F2F',
    completed: '#43A047',
    archived: '#9E9E9E',
  };
  return colors[status] || '#616161';
}

/**
 * Get status display label
 */
export function getStatusLabel(status: RouteStatus): string {
  const labels: Record<RouteStatus, string> = {
    draft: 'Draft',
    published: 'Published',
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  };
  return labels[status] || status;
}

/**
 * Validate route data before saving
 */
export function validateRoute(route: Partial<Route>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!route.name || route.name.trim() === '') {
    errors.push('Route name is required');
  }

  if (!route.date || route.date === '') {
    errors.push('Route date is required');
  }

  if (!route.startTime || route.startTime === '') {
    errors.push('Start time is required');
  }

  if (!route.waypoints || route.waypoints.length < 2) {
    errors.push('At least 2 waypoints are required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new route with default values
 */
export function createNewRoute(brigadeId: string, createdBy?: string): Route {
  return {
    id: generateRouteId(),
    brigadeId,
    name: '',
    description: '',
    date: '',
    startTime: '',
    status: 'draft',
    waypoints: [],
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

/**
 * Calculate estimated arrival times for waypoints based on route navigation data
 */
export function calculateEstimatedArrivals(
  route: Route,
  startDateTime: Date
): Waypoint[] {
  if (!route.navigationSteps || route.navigationSteps.length === 0) {
    return route.waypoints;
  }

  let currentTime = startDateTime.getTime();
  const updatedWaypoints = [...route.waypoints];

  // For each waypoint, calculate estimated arrival based on duration
  updatedWaypoints.forEach((waypoint, index) => {
    if (index === 0) {
      waypoint.estimatedArrival = startDateTime.toISOString();
    } else {
      // Sum durations from previous waypoints
      const durationToWaypoint = route.navigationSteps!
        .slice(0, index)
        .reduce((sum, step) => sum + step.duration, 0);
      
      const arrivalTime = new Date(currentTime + durationToWaypoint * 1000);
      waypoint.estimatedArrival = arrivalTime.toISOString();
    }
  });

  return updatedWaypoints;
}
