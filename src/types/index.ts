export interface Waypoint {
  id: string;
  coordinates: [number, number]; // [lng, lat]
  address?: string;
  name?: string;
  order: number;
  estimatedArrival?: string;
  actualArrival?: string;
  notes?: string;
  isCompleted: boolean;
}

export type RouteStatus = 'draft' | 'published' | 'active' | 'completed' | 'archived';

export interface NavigationStep {
  instruction: string;            // "Turn left onto Main St"
  distance: number;               // Distance to next step (meters)
  duration: number;               // Time to next step (seconds)
  geometry: GeoJSON.LineString;   // Geometry for this step
  maneuver: {
    type: string;                 // "turn", "arrive", "depart", etc.
    modifier?: string;            // "left", "right", "straight"
    location: [number, number];   // [lng, lat]
  };
}

export interface NavigationSettings {
  walkingSpeedKmh: number;        // Average walking speed in km/h (default: 5)
  stopDurationMinutes: number;    // Time spent at each waypoint in minutes (default: 2)
  transitSpeedKmh: number;        // Speed for high-speed road segments in km/h (default: 60)
}

/** A comment left by a brigade member on a route (optionally tagged to a waypoint). */
export interface RouteComment {
  id: string;
  /** User ID of the author */
  userId: string;
  /** Display name of the author (denormalised for display without a user lookup) */
  userName: string;
  /** Comment body (plain text) */
  text: string;
  /** Optional waypoint this comment is attached to */
  waypointId?: string;
  createdAt: string;
}

/** Who last saved a route — used for multi-operator conflict awareness. */
export interface RouteEditStamp {
  userId: string;
  userName: string;
  at: string;
}

export interface Route {
  id: string;
  brigadeId: string;
  name: string;
  description?: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: RouteStatus;
  waypoints: Waypoint[];
  geometry?: GeoJSON.LineString;  // Mapbox Directions API route
  navigationSteps?: NavigationStep[]; // Turn-by-turn instructions
  distance?: number;              // Total distance in meters
  estimatedDuration?: number;     // Estimated duration in seconds
  actualDuration?: number;        // Actual duration in seconds
  navigationSettings?: NavigationSettings; // Speed and timing configuration
  createdAt: string;
  createdBy?: string;             // User ID reference (not email)
  publishedAt?: string;
  startedAt?: string;
  completedAt?: string;
  shareableLink?: string;
  qrCodeUrl?: string;
  viewCount?: number;
  archivedAt?: string;
  rerouteCount?: number;
  /** Last-save timestamp — used for multi-operator conflict detection */
  updatedAt?: string;
  /** Who last saved this route */
  lastEditedBy?: RouteEditStamp;
  /** Brigade-internal comment thread */
  comments?: RouteComment[];
}

/**
 * Route entity as stored in Azure Table Storage (without waypoints).
 * Waypoints are stored separately in the routewaypoints table.
 */
export interface RouteEntity extends Omit<Route, 'waypoints'> {
  // Inherits all Route fields except waypoints
}

/**
 * Waypoint entity as stored in Azure Table Storage.
 * Stored in routewaypoints table with composite partition key.
 */
export interface WaypointEntity extends Waypoint {
  routeId: string;  // For queries and reconstruction
}

export interface RouteTemplate {
  id: string;
  brigadeId: string;
  name: string;
  description?: string;
  /** Waypoints without timing/completion data — coordinates and names only */
  waypoints: Array<Pick<Waypoint, 'id' | 'coordinates' | 'address' | 'name' | 'order' | 'notes'>>;
  /** Human-readable category for display grouping */
  category?: string;
  /** Whether this template ships with the app (cannot be deleted by users) */
  isBuiltIn?: boolean;
  createdAt: string;
  createdBy?: string;
}

export interface LiveLocation {
  coordinates: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export interface RouteProgress {
  currentWaypointIndex: number;
  completedWaypoints: string[];
  estimatedArrival?: string;
  currentStepIndex?: number;
  distanceToNextManeuver?: number;
}

export interface LocationBroadcast {
  routeId: string;
  location: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
  currentWaypointIndex?: number;
  nextWaypointEta?: string;
}

export interface ViewerCountMessage {
  routeId: string;
  count: number;
  timestamp: number;
  type: 'viewer-count';
}

export interface ViewerSession {
  id: string;
  routeId: string;
  sessionId: string;
  joinedAt: string;
  leftAt?: string;
  viewDuration?: number; // Duration in seconds
  userAgent?: string;
  ipAddress?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    coordinates?: [number, number];
  };
  shareSource?: string; // e.g., 'direct', 'qr', 'social', 'email'
}

export interface RouteAnalytics {
  routeId: string;
  brigadeId: string;
  totalViews: number;
  uniqueViewers: number;
  peakConcurrentViewers: number;
  averageViewDuration: number; // In seconds
  totalViewDuration: number; // In seconds
  viewersBySource: Record<string, number>; // { 'direct': 10, 'qr': 5, etc. }
  viewersByLocation: Array<{
    city?: string;
    region?: string;
    country: string;
    count: number;
    coordinates?: [number, number];
  }>;
  viewsOverTime: Array<{
    timestamp: string;
    count: number;
  }>;
  lastUpdated: string;
}

export interface ViewerEventType {
  type: 'join' | 'leave';
  sessionId: string;
  routeId: string;
  timestamp: string;
  metadata?: {
    userAgent?: string;
    shareSource?: string;
    location?: ViewerSession['location'];
  };
}

// GeoJSON types for TypeScript
// Using namespace for better type organization and avoiding conflicts
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace GeoJSON {
  export interface LineString {
    type: 'LineString';
    coordinates: [number, number][];
  }

  export interface Point {
    type: 'Point';
    coordinates: [number, number];
  }
}
