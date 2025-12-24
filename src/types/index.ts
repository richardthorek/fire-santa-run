export interface Waypoint {
  id: string;
  coordinates: [number, number]; // [lng, lat]
  address?: string;
  estimatedTime?: string;
}

export interface Route {
  id: string;
  name: string;
  date: string;
  startTime: string;
  waypoints: Waypoint[];
  isActive: boolean;
  createdAt: string;
}

export interface LiveLocation {
  coordinates: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
}

export interface RouteProgress {
  currentWaypointIndex: number;
  completedWaypoints: string[];
  estimatedArrival?: string;
}
