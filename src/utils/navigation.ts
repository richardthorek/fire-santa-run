/**
 * Navigation utilities for turn-by-turn navigation
 * Handles geometry matching, distance calculation, and navigation state
 */

import type { NavigationStep, Waypoint, GeoJSON } from '../types';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate bearing between two coordinates
 * Returns bearing in degrees (0-360)
 */
export function calculateBearing(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Find the closest point on a LineString to a given coordinate
 * Returns the closest point and its distance
 */
export function findClosestPointOnRoute(
  userLocation: [number, number],
  routeGeometry: GeoJSON.LineString
): {
  point: [number, number];
  distance: number;
  segmentIndex: number;
} {
  let closestPoint: [number, number] = routeGeometry.coordinates[0];
  let minDistance = calculateDistance(userLocation, closestPoint);
  let segmentIndex = 0;

  // Check each line segment
  for (let i = 0; i < routeGeometry.coordinates.length - 1; i++) {
    const start = routeGeometry.coordinates[i];
    const end = routeGeometry.coordinates[i + 1];
    
    const point = closestPointOnSegment(userLocation, start, end);
    const distance = calculateDistance(userLocation, point);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
      segmentIndex = i;
    }
  }

  return { point: closestPoint, distance: minDistance, segmentIndex };
}

/**
 * Find closest point on a line segment to a given point
 */
function closestPointOnSegment(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): [number, number] {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return lineStart;
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

  return [x1 + t * dx, y1 + t * dy];
}

/**
 * Find current navigation step based on user's location
 */
export function findCurrentStep(
  userLocation: [number, number],
  steps: NavigationStep[]
): {
  stepIndex: number;
  distanceToManeuver: number;
} {
  if (steps.length === 0) {
    return { stepIndex: 0, distanceToManeuver: 0 };
  }

  // Find the step whose maneuver location is closest ahead of user
  let bestStepIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < steps.length; i++) {
    const distance = calculateDistance(userLocation, steps[i].maneuver.location);
    
    // Prefer steps ahead of current position
    if (distance < minDistance) {
      minDistance = distance;
      bestStepIndex = i;
    }
  }

  const distanceToManeuver = calculateDistance(
    userLocation,
    steps[bestStepIndex].maneuver.location
  );

  return { stepIndex: bestStepIndex, distanceToManeuver };
}

/**
 * Find next waypoint that hasn't been completed
 */
export function findNextWaypoint(waypoints: Waypoint[]): Waypoint | null {
  return waypoints.find(wp => !wp.isCompleted) || null;
}

/**
 * Calculate route progress percentage
 */
export function calculateRouteProgress(
  userLocation: [number, number],
  routeGeometry: GeoJSON.LineString,
  waypoints: Waypoint[]
): number {
  const completedWaypoints = waypoints.filter(wp => wp.isCompleted).length;
  const totalWaypoints = waypoints.length;
  
  if (totalWaypoints === 0) return 0;
  
  // Base progress on completed waypoints (80% weight)
  const waypointProgress = (completedWaypoints / totalWaypoints) * 80;
  
  // Add progress towards next waypoint (20% weight)
  const nextWaypoint = findNextWaypoint(waypoints);
  if (!nextWaypoint || completedWaypoints === 0) {
    return waypointProgress;
  }
  
  // Find distance along route
  const { segmentIndex } = findClosestPointOnRoute(userLocation, routeGeometry);
  const totalSegments = routeGeometry.coordinates.length - 1;
  const segmentProgress = (segmentIndex / totalSegments) * 20;
  
  return Math.min(100, waypointProgress + segmentProgress);
}

/**
 * Check if user is off route
 */
export function isOffRoute(
  userLocation: [number, number],
  routeGeometry: GeoJSON.LineString,
  thresholdMeters: number = 100
): boolean {
  const { distance } = findClosestPointOnRoute(userLocation, routeGeometry);
  return distance > thresholdMeters;
}

/**
 * Calculate ETA based on distance and average speed
 */
export function calculateETA(
  distanceMeters: number,
  speedMetersPerSecond: number | null,
  fallbackSpeedKmh: number = 40 // Default urban speed
): Date {
  const speed = speedMetersPerSecond || (fallbackSpeedKmh * 1000) / 3600;
  const timeSeconds = distanceMeters / speed;
  return new Date(Date.now() + timeSeconds * 1000);
}

/**
 * Format ETA as time string
 */
export function formatETA(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Check if user is near a waypoint
 */
export function isNearWaypoint(
  userLocation: [number, number],
  waypoint: Waypoint,
  thresholdMeters: number = 100
): boolean {
  const distance = calculateDistance(userLocation, waypoint.coordinates);
  return distance <= thresholdMeters;
}

/**
 * Get distance remaining in route from current position
 */
export function getRemainingDistance(
  userLocation: [number, number],
  steps: NavigationStep[],
  currentStepIndex: number
): number {
  // Sum remaining distance from current step onwards
  let remaining = 0;
  for (let i = currentStepIndex; i < steps.length; i++) {
    remaining += steps[i].distance;
  }
  
  // Subtract distance already covered in current step
  if (currentStepIndex < steps.length) {
    const distanceToManeuver = calculateDistance(
      userLocation,
      steps[currentStepIndex].maneuver.location
    );
    // Adjust if we're past the maneuver
    if (distanceToManeuver < steps[currentStepIndex].distance) {
      remaining -= (steps[currentStepIndex].distance - distanceToManeuver);
    }
  }
  
  return Math.max(0, remaining);
}
