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

import type { Route, RouteStatus, Waypoint, NavigationSettings, NavigationStep } from '../types';

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
 * Check if a route can be edited. Live (active) runs are broadcasting to the
 * public and to the navigator in real time — waypoint/detail edits are
 * blocked entirely while active. Published, draft, completed and archived
 * routes may all be edited; a published route is already public, so callers
 * should pair this with {@link routeEditNeedsPublicWarning} to warn the user
 * before letting them in.
 */
export function canEditRoute(status: RouteStatus): boolean {
  return status !== 'active';
}

/**
 * Whether editing this route should be preceded by a "this is public" warning
 * — true only for published routes, which are already visible on the
 * tracking page and poster.
 */
export function routeEditNeedsPublicWarning(status: RouteStatus): boolean {
  return status === 'published';
}

/** Local (not UTC) today as `YYYY-MM-DD`, matching the format `route.date` is stored in. */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whether a `route.date` string (`YYYY-MM-DD`) is strictly before today, locally. */
export function isDateInPast(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return dateStr < getTodayLocalDateString();
}

/**
 * Check if a route can be published. Drafts may be saved with any date, but
 * publishing (making the run public) with a date already in the past is
 * blocked — it can never be a real, upcoming Santa run.
 */
export function canPublishRoute(route: Route): boolean {
  return (
    route.status === 'draft' &&
    route.waypoints.length >= 2 &&
    route.name.trim() !== '' &&
    route.date !== '' &&
    !isDateInPast(route.date)
  );
}

/**
 * Human-readable reason a route currently can't be published, or '' if it can.
 * Used for button tooltips / inline messages.
 */
export function getPublishBlockReason(route: Route): string {
  if (route.status !== 'draft') return 'Only draft routes can be published';
  if (!route.name.trim() || route.waypoints.length < 2 || route.date === '') {
    return 'Complete all fields and add at least 2 waypoints';
  }
  if (isDateInPast(route.date)) {
    return 'Route date is in the past — choose a current or future date to publish';
  }
  return '';
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
  // Reset the date too (e.g. copying last year's run): the copy is a fresh
  // draft and shouldn't inherit a date that's likely already in the past, or
  // block publishing later. Defaults to next Christmas Eve, same as a new route.
  const nextChristmas = getNextChristmasEveAt4pm();
  return {
    ...source,
    id: generateRouteId(),
    name: `${source.name} - Copy`,
    status: 'draft',
    date: nextChristmas.date,
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
 * Default navigation settings
 */
export const DEFAULT_NAVIGATION_SETTINGS: NavigationSettings = {
  walkingSpeedKmh: 5,        // Average walking speed
  stopDurationMinutes: 2,    // Time spent at each waypoint
  transitSpeedKmh: 60,       // Speed for high-speed road segments
};

/**
 * Detect if a navigation step is a high-speed transit leg.
 * A leg is considered high-speed if its average speed is >= 60 km/h.
 */
export function isTransitLeg(step: NavigationStep, transitSpeedThresholdKmh: number = 60): boolean {
  if (step.duration === 0) return false;

  // Calculate average speed for this step in km/h
  const speedKmh = (step.distance / 1000) / (step.duration / 3600);

  // Consider it a transit leg if speed is at or above threshold
  return speedKmh >= transitSpeedThresholdKmh;
}

/**
 * Calculate duration for a navigation step with custom speeds.
 * Uses walking speed for normal segments and transit speed for high-speed segments.
 */
export function calculateStepDuration(
  step: NavigationStep,
  settings: NavigationSettings
): number {
  const isHighSpeed = isTransitLeg(step, settings.transitSpeedKmh);
  const speedKmh = isHighSpeed ? settings.transitSpeedKmh : settings.walkingSpeedKmh;
  const speedMps = (speedKmh * 1000) / 3600; // Convert km/h to m/s

  return step.distance / speedMps; // Duration in seconds
}

/**
 * Calculate estimated arrival times for waypoints based on route navigation data.
 * Accounts for:
 * - Configurable walking speed
 * - Stop duration at each waypoint
 * - High-speed transit legs (roads >= 60 km/h)
 */
export function calculateEstimatedArrivals(
  route: Route,
  startDateTime: Date,
  settings?: NavigationSettings
): Waypoint[] {
  if (!route.navigationSteps || route.navigationSteps.length === 0 || route.waypoints.length === 0) {
    return route.waypoints;
  }

  // Use provided settings or route settings or defaults
  const navSettings = settings || route.navigationSettings || DEFAULT_NAVIGATION_SETTINGS;
  const stopDurationSeconds = navSettings.stopDurationMinutes * 60;

  const updatedWaypoints = [...route.waypoints];
  let cumulativeTime = startDateTime.getTime();

  // Calculate ETA for each waypoint
  updatedWaypoints.forEach((waypoint, index) => {
    if (index === 0) {
      // First waypoint: arrival at start time
      waypoint.estimatedArrival = new Date(cumulativeTime).toISOString();
    } else {
      // Add stop duration at previous waypoint (except before first)
      if (index > 0) {
        cumulativeTime += stopDurationSeconds * 1000;
      }

      // Calculate travel time from previous waypoint to this one
      // We need to sum the durations of steps between waypoints
      // For simplicity, we'll distribute the steps evenly across waypoints
      // A more accurate approach would require Mapbox to tell us which steps correspond to which waypoint leg

      // Simplified approach: divide steps by waypoint segments
      const totalSteps = route.navigationSteps!.length;
      const waypointSegments = route.waypoints.length - 1;
      const stepsPerSegment = totalSteps / waypointSegments;

      const segmentStartIdx = Math.floor((index - 1) * stepsPerSegment);
      const segmentEndIdx = Math.floor(index * stepsPerSegment);

      // Sum adjusted durations for steps in this segment
      let segmentDuration = 0;
      for (let i = segmentStartIdx; i < segmentEndIdx && i < totalSteps; i++) {
        segmentDuration += calculateStepDuration(route.navigationSteps![i], navSettings);
      }

      cumulativeTime += segmentDuration * 1000;
      waypoint.estimatedArrival = new Date(cumulativeTime).toISOString();
    }
  });

  return updatedWaypoints;
}

/**
 * Calculate ETAs for remaining waypoints during active navigation.
 * Uses actual current time and position to provide real-time estimates.
 */
export function calculateRealTimeETAs(
  route: Route,
  currentWaypointIndex: number,
  currentTime: Date,
  _currentSpeed?: number, // GPS speed in m/s - reserved for future use
  settings?: NavigationSettings
): Waypoint[] {
  if (!route.navigationSteps || route.navigationSteps.length === 0 || route.waypoints.length === 0) {
    return route.waypoints;
  }

  const navSettings = settings || route.navigationSettings || DEFAULT_NAVIGATION_SETTINGS;
  const stopDurationSeconds = navSettings.stopDurationMinutes * 60;

  let cumulativeTime = currentTime.getTime();

  // Immutable: map to new waypoint objects rather than mutating in place.
  // Mutating the shared waypoint objects left the route's own `waypoints`
  // array containing the same object references it started with, which
  // masked identity-based re-render checks and, on reroute, corrupted the
  // waypoints the caller (`route.waypoints`) still held a reference to.
  return route.waypoints.map((waypoint, index) => {
    if (index < currentWaypointIndex) {
      // Already completed - keep existing actual or estimated arrival
      return waypoint;
    }

    if (index === currentWaypointIndex) {
      // Next waypoint - calculate based on remaining distance and current speed
      // This is a simplified calculation; more accurate would use remaining steps
      return { ...waypoint, estimatedArrival: new Date(cumulativeTime).toISOString() };
    }

    // Future waypoints - add stop duration and travel time
    cumulativeTime += stopDurationSeconds * 1000;

    // Calculate travel time (simplified approach using even distribution)
    const totalSteps = route.navigationSteps!.length;
    const waypointSegments = route.waypoints.length - 1;
    const stepsPerSegment = totalSteps / waypointSegments;

    const segmentStartIdx = Math.floor((index - 1) * stepsPerSegment);
    const segmentEndIdx = Math.floor(index * stepsPerSegment);

    let segmentDuration = 0;
    for (let i = segmentStartIdx; i < segmentEndIdx && i < totalSteps; i++) {
      segmentDuration += calculateStepDuration(route.navigationSteps![i], navSettings);
    }

    cumulativeTime += segmentDuration * 1000;
    return { ...waypoint, estimatedArrival: new Date(cumulativeTime).toISOString() };
  });
}

/**
 * Calculate estimated arrival times for waypoints based on route navigation data
 */
export function calculateEstimatedArrivals_DEPRECATED(
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
