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
  createdAt: string;
  createdBy?: string;             // User ID reference (not email)
  publishedAt?: string;
  startedAt?: string;
  completedAt?: string;
  shareableLink?: string;
  qrCodeUrl?: string;
  viewCount?: number;
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
