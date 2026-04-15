function getNextChristmasEveAt4pm(): { date: string; time: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const targetYear = (now.getMonth() > 11 || (now.getMonth() === 11 && now.getDate() > 24))
    ? currentYear + 1
    : currentYear;

  const target = new Date(targetYear, 11, 24, 16, 0, 0, 0);

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');

  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}
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
 * Generate a unique template ID
 */
export function generateTemplateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  const nextChristmas = getNextChristmasEveAt4pm();
  return {
    id: generateRouteId(),
    brigadeId,
    name: '',
    description: '',
    date: nextChristmas.date,
    startTime: nextChristmas.time,
    status: 'draft',
    waypoints: [],
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

/**
 * Duplicate a route, creating a copy with a new ID, modified name, and draft status.
 * Waypoints are deep-copied with isCompleted reset to false.
 * Timestamps and sharing metadata from the original are not carried over.
 */
export function duplicateRoute(source: Route): Route {
  return {
    ...source,
    id: generateRouteId(),
    name: `${source.name} - Copy`,
    status: 'draft',
    waypoints: source.waypoints.map(wp => ({ ...wp, isCompleted: false, actualArrival: undefined })),
    createdAt: new Date().toISOString(),
    publishedAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
    archivedAt: undefined,
    shareableLink: undefined,
    qrCodeUrl: undefined,
  };
}

/** Default number of days after completion before a route is auto-archived */
export const DEFAULT_ARCHIVE_THRESHOLD_DAYS = 90;

/**
 * Archive a completed route
 */
export function archiveRoute(route: Route): Route {
  return {
    ...route,
    status: 'archived',
    archivedAt: new Date().toISOString(),
  };
}

/**
 * Restore an archived route back to completed status
 */
export function restoreRoute(route: Route): Route {
  return {
    ...route,
    status: 'completed',
    archivedAt: undefined,
  };
}

/**
 * Check if a completed route is eligible for auto-archive based on threshold days
 */
export function isEligibleForAutoArchive(route: Route, thresholdDays: number = DEFAULT_ARCHIVE_THRESHOLD_DAYS): boolean {
  if (route.status !== 'completed') return false;
  const completedDate = route.completedAt ? new Date(route.completedAt) : new Date(route.createdAt);
  const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCompletion >= thresholdDays;
}

/**
 * Check if a completed route is within the notification window before auto-archive.
 * Returns true if within 7 days of the archive threshold.
 */
export function isApproachingAutoArchive(route: Route, thresholdDays: number = DEFAULT_ARCHIVE_THRESHOLD_DAYS): boolean {
  if (route.status !== 'completed') return false;
  const completedDate = route.completedAt ? new Date(route.completedAt) : new Date(route.createdAt);
  const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCompletion >= (thresholdDays - 7) && daysSinceCompletion < thresholdDays;
}

/**
 * Get the number of days until auto-archive for a completed route
 */
export function daysUntilAutoArchive(route: Route, thresholdDays: number = DEFAULT_ARCHIVE_THRESHOLD_DAYS): number {
  if (route.status !== 'completed') return -1;
  const completedDate = route.completedAt ? new Date(route.completedAt) : new Date(route.createdAt);
  const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(thresholdDays - daysSinceCompletion));
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

  const currentTime = startDateTime.getTime();
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

/**
 * Search routes by text query (name, description, waypoint addresses)
 * Returns true if the route matches the search query
 */
export function searchRoutes(route: Route, query: string): boolean {
  if (!query || query.trim() === '') {
    return true;
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Search in route name
  if (route.name.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  // Search in route description
  if (route.description && route.description.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  // Search in waypoint addresses
  const matchingWaypoint = route.waypoints.some(waypoint => {
    if (waypoint.address && waypoint.address.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
    if (waypoint.name && waypoint.name.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
    return false;
  });

  return matchingWaypoint;
}

/**
 * Filter options for route filtering
 */
export interface RouteFilterOptions {
  dateFrom?: string;
  dateTo?: string;
  statuses?: RouteStatus[];
  minDistance?: number;
  maxDistance?: number;
  minStops?: number;
  maxStops?: number;
}

/**
 * Filter routes based on filter options
 */
export function filterRoutes(route: Route, filters: RouteFilterOptions): boolean {
  // Date range filter
  if (filters.dateFrom && route.date < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && route.date > filters.dateTo) {
    return false;
  }

  // Status filter
  if (filters.statuses && filters.statuses.length > 0) {
    if (!filters.statuses.includes(route.status)) {
      return false;
    }
  }

  // Distance filter (route.distance is in meters)
  if (filters.minDistance !== undefined && route.distance !== undefined) {
    if (route.distance < filters.minDistance) {
      return false;
    }
  }
  if (filters.maxDistance !== undefined && route.distance !== undefined) {
    if (route.distance > filters.maxDistance) {
      return false;
    }
  }

  // Stops filter
  const stopCount = route.waypoints.length;
  if (filters.minStops !== undefined && stopCount < filters.minStops) {
    return false;
  }
  if (filters.maxStops !== undefined && stopCount > filters.maxStops) {
    return false;
  }

  return true;
}

/**
 * Sort options for route sorting
 */
export type RouteSortField = 'date' | 'name' | 'distance' | 'views' | 'created';
export type RouteSortOrder = 'asc' | 'desc';

export interface RouteSortOptions {
  field: RouteSortField;
  order: RouteSortOrder;
}

/**
 * Sort routes based on sort options
 */
export function sortRoutes(routes: Route[], sortOptions: RouteSortOptions): Route[] {
  const { field, order } = sortOptions;
  const multiplier = order === 'asc' ? 1 : -1;

  return [...routes].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'date': {
        // Sort by date, then by startTime
        const dateA = `${a.date} ${a.startTime || '00:00'}`;
        const dateB = `${b.date} ${b.startTime || '00:00'}`;
        comparison = dateA.localeCompare(dateB);
        break;
      }

      case 'name': {
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        break;
      }

      case 'distance': {
        const distA = a.distance || 0;
        const distB = b.distance || 0;
        comparison = distA - distB;
        break;
      }

      case 'views': {
        const viewsA = a.viewCount || 0;
        const viewsB = b.viewCount || 0;
        comparison = viewsA - viewsB;
        break;
      }

      case 'created': {
        const createdA = new Date(a.createdAt).getTime();
        const createdB = new Date(b.createdAt).getTime();
        comparison = createdA - createdB;
        break;
      }

      default:
        comparison = 0;
    }

    return comparison * multiplier;
  });
}
