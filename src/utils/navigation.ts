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
 * Distance from `from` to `to` measured ALONG a route path (not straight-line),
 * by projecting both points onto the LineString and summing the segment
 * lengths between the projections.
 *
 * Used for the public "how far is Santa from my spot" ETA: straight-line
 * distance is misleading on looping parade routes.
 *
 * `passed` is true when `to` lies behind `from` in path direction (Santa has
 * already gone past that point). `offPathMeters` is how far `to` sits from the
 * path itself — large values mean the viewer's pin isn't really on the route.
 */
export function alongPathDistance(
  // Structural type so both the app's GeoJSON.LineString and the global
  // @types/geojson LineString (Position[]) are accepted without casts.
  geometry: { type: 'LineString'; coordinates: ReadonlyArray<ReadonlyArray<number>> },
  from: [number, number],
  to: [number, number]
): { meters: number; passed: boolean; offPathMeters: number } {
  const line = geometry as unknown as GeoJSON.LineString;
  const fromProj = findClosestPointOnRoute(from, line);
  const toProj = findClosestPointOnRoute(to, line);

  const coords = line.coordinates as [number, number][];

  // Cumulative path distance of a projection = full segments before it, plus
  // the partial distance into its own segment.
  const cumulativeTo = (proj: { point: [number, number]; segmentIndex: number }): number => {
    let total = 0;
    for (let i = 0; i < proj.segmentIndex; i++) {
      total += calculateDistance(coords[i], coords[i + 1]);
    }
    total += calculateDistance(coords[proj.segmentIndex], proj.point);
    return total;
  };

  const fromDist = cumulativeTo(fromProj);
  const toDist = cumulativeTo(toProj);
  const delta = toDist - fromDist;

  return {
    meters: Math.abs(delta),
    passed: delta < 0,
    offPathMeters: toProj.distance,
  };
}

/**
 * Cumulative along-route distance (metres) for every vertex of a route
 * LineString. `result[i]` is the path length from the start of the route to
 * `coordinates[i]`; `result[0]` is always 0 and `result[last]` is the total
 * route length.
 */
export function computeCumulativeDistances(
  coordinates: ReadonlyArray<ReadonlyArray<number>>
): number[] {
  const coords = coordinates as [number, number][];
  const cumulative: number[] = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    cumulative.push(cumulative[i] + calculateDistance(coords[i], coords[i + 1]));
  }
  return cumulative;
}

export interface RouteProjection {
  /** The projected point on the route line. */
  point: [number, number];
  /** Along-route (path) distance from the start of the route to the projection, in metres. */
  alongRouteDistance: number;
  /** Perpendicular distance from `userLocation` to the route line, in metres. */
  offRouteDistance: number;
  /** Index of the segment (between coordinates[i] and coordinates[i+1]) the projection falls on. */
  segmentIndex: number;
}

/** Beyond this off-route distance a windowed match is considered unreliable
 *  (e.g. right after a reroute, or a big jump from a GPS glitch), so a full
 *  route search is used instead. */
const WINDOW_FALLBACK_OFFROUTE_METERS = 150;

/**
 * Project the user's location onto the route line and return the along-route
 * distance to that projection.
 *
 * Santa runs crawl along streets that often loop back and cross themselves,
 * so simply finding the globally closest point on the route can snap onto an
 * earlier (or later) pass of the same street rather than the one the truck is
 * actually on. `previousAlongRouteDistance` — the along-route distance
 * matched on the previous GPS tick — narrows the search to a window just
 * ahead of (and a little behind, for GPS jitter) that previous match, so
 * progress stays monotonic and loops resolve to the current pass. When there
 * is no previous match, or the windowed match is a poor fit (large
 * `offRouteDistance` — e.g. just after a reroute changed the geometry), a
 * full search of the route is used instead.
 */
export function projectOntoRoute(
  userLocation: [number, number],
  routeGeometry: GeoJSON.LineString,
  cumulativeDistances: number[],
  previousAlongRouteDistance: number | null = null,
  options: { windowAheadMeters?: number; windowBehindMeters?: number } = {}
): RouteProjection {
  const { windowAheadMeters = 400, windowBehindMeters = 40 } = options;
  const coords = routeGeometry.coordinates as [number, number][];
  const totalLength = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;

  // Tie-break tolerance: on a route that loops back over itself, two passes
  // of the same street can sit on top of one another. On a near-tie prefer
  // the candidate closest (along the route) to where we last were — or to the
  // start on the first fix. Preferring the later pass outright would snap a
  // run that starts and finishes at the station straight to the finish.
  const TIE_BREAK_METERS = 0.5;
  const anchorAlong = previousAlongRouteDistance ?? 0;

  const searchRange = (fromSegment: number, toSegment: number): RouteProjection | null => {
    let best: RouteProjection | null = null;
    for (let i = fromSegment; i < toSegment; i++) {
      const start = coords[i];
      const end = coords[i + 1];
      const point = closestPointOnSegment(userLocation, start, end);
      const offRouteDistance = calculateDistance(userLocation, point);
      const alongRouteDistance = cumulativeDistances[i] + calculateDistance(start, point);

      if (
        !best ||
        offRouteDistance < best.offRouteDistance - TIE_BREAK_METERS ||
        (offRouteDistance < best.offRouteDistance + TIE_BREAK_METERS &&
          Math.abs(alongRouteDistance - anchorAlong) < Math.abs(best.alongRouteDistance - anchorAlong))
      ) {
        best = { point, offRouteDistance, alongRouteDistance, segmentIndex: i };
      }
    }
    return best;
  };

  const segmentCount = coords.length - 1;
  let windowed: RouteProjection | null = null;

  if (previousAlongRouteDistance !== null && segmentCount > 0) {
    const lo = previousAlongRouteDistance - windowBehindMeters;
    const hi = previousAlongRouteDistance + windowAheadMeters;

    let fromSegment = 0;
    let toSegment = segmentCount;
    for (let i = 0; i < cumulativeDistances.length - 1; i++) {
      if (cumulativeDistances[i] <= lo) fromSegment = i;
      if (cumulativeDistances[i] < hi) toSegment = i + 1;
    }
    fromSegment = Math.max(0, Math.min(fromSegment, segmentCount - 1));
    toSegment = Math.max(fromSegment + 1, Math.min(toSegment, segmentCount));

    windowed = searchRange(fromSegment, toSegment);
  }

  if (!windowed || windowed.offRouteDistance > WINDOW_FALLBACK_OFFROUTE_METERS) {
    const global = searchRange(0, segmentCount);
    if (global && (!windowed || global.offRouteDistance < windowed.offRouteDistance)) {
      windowed = global;
    }
  }

  if (!windowed) {
    return { point: coords[0] ?? userLocation, offRouteDistance: 0, alongRouteDistance: 0, segmentIndex: 0 };
  }

  return {
    ...windowed,
    alongRouteDistance: Math.max(0, Math.min(totalLength, windowed.alongRouteDistance)),
  };
}

/**
 * Precompute the along-route distance of every step's maneuver location, once
 * per route geometry (i.e. on load and after a reroute) — not per GPS tick.
 */
export function computeStepAlongDistances(
  routeGeometry: GeoJSON.LineString,
  steps: NavigationStep[],
  cumulativeDistances: number[]
): number[] {
  return steps.map(
    step => projectOntoRoute(step.maneuver.location, routeGeometry, cumulativeDistances, null).alongRouteDistance
  );
}

/** Small tolerance so a maneuver the user is essentially on top of doesn't
 *  flicker back to "current" due to GPS/projection jitter. */
const MANEUVER_EPSILON_METERS = 5;

/**
 * Find the current navigation step from the user's along-route progress.
 *
 * Replaces the old "nearest maneuver by straight-line distance" approach,
 * which could pick a maneuver already passed (the old instruction would
 * persist after the turn) and broke down on loops that revisit the same
 * intersection. Along-route progress is monotonic (see `projectOntoRoute`),
 * so the next maneuver is simply the first step whose maneuver lies ahead of
 * the user's current along-route position.
 */
export function findCurrentStep(
  userAlongRouteDistance: number,
  stepAlongDistances: number[]
): {
  stepIndex: number;
  distanceToManeuver: number;
} {
  if (stepAlongDistances.length === 0) {
    return { stepIndex: 0, distanceToManeuver: 0 };
  }

  for (let i = 0; i < stepAlongDistances.length; i++) {
    if (stepAlongDistances[i] > userAlongRouteDistance + MANEUVER_EPSILON_METERS) {
      return {
        stepIndex: i,
        distanceToManeuver: Math.max(0, stepAlongDistances[i] - userAlongRouteDistance),
      };
    }
  }

  // Every maneuver has been passed — hold on the final step (arrival).
  const lastIndex = stepAlongDistances.length - 1;
  return {
    stepIndex: lastIndex,
    distanceToManeuver: Math.max(0, stepAlongDistances[lastIndex] - userAlongRouteDistance),
  };
}

/**
 * Find next waypoint that hasn't been completed
 */
export function findNextWaypoint(waypoints: Waypoint[]): Waypoint | null {
  return waypoints.find(wp => !wp.isCompleted) || null;
}

/**
 * Calculate route progress percentage.
 *
 * Takes the user's already-computed along-route distance and the route's
 * total length (both from the single per-tick `projectOntoRoute` call) rather
 * than re-deriving position on the route from a segment index — the old
 * "segmentIndex / totalSegments" approach treated every segment as equal
 * length, which skews badly on routes with long straight legs and short,
 * tightly-spaced turning segments.
 */
export function calculateRouteProgress(
  alongRouteDistance: number,
  totalRouteLength: number
): number {
  if (totalRouteLength <= 0) return 0;
  return Math.min(100, Math.max(0, (alongRouteDistance / totalRouteLength) * 100));
}

/**
 * Check if a (perpendicular, off-route) distance from the route exceeds the
 * threshold. Takes the distance directly (from a `projectOntoRoute` result)
 * so callers doing per-tick matching don't project the same point twice.
 */
export function isOffRoute(offRouteDistanceMeters: number, thresholdMeters: number = 100): boolean {
  return offRouteDistanceMeters > thresholdMeters;
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

/** Below this speed a GPS reading is treated as "stopped" (e.g. paused at a
 *  stop, waiting at lights) rather than fed into the smoothed speed — a Santa
 *  run crawls at 5-15 km/h, so a stray near-zero reading would otherwise
 *  collapse the ETA estimate to "arriving now" or blow it out wildly. */
export const MIN_MOVING_SPEED_MPS = 0.5;

/** EMA smoothing factor for GPS speed — higher reacts faster, lower is smoother. */
export const SPEED_EMA_ALPHA = 0.3;

/**
 * Exponential moving average of GPS speed, for a stable ETA. Raw GPS speed on
 * a slow-moving truck is jittery from one fix to the next and drops out
 * entirely (0 or null) while stopped, so a null/near-zero reading is ignored
 * and the previous smoothed value is kept rather than reset.
 */
export function updateSmoothedSpeed(
  previousSmoothedSpeed: number | null,
  rawSpeedMetersPerSecond: number | null,
  alpha: number = SPEED_EMA_ALPHA,
  minMovingSpeedMetersPerSecond: number = MIN_MOVING_SPEED_MPS
): number | null {
  if (rawSpeedMetersPerSecond === null || rawSpeedMetersPerSecond < minMovingSpeedMetersPerSecond) {
    return previousSmoothedSpeed;
  }
  if (previousSmoothedSpeed === null) {
    return rawSpeedMetersPerSecond;
  }
  return previousSmoothedSpeed + alpha * (rawSpeedMetersPerSecond - previousSmoothedSpeed);
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
