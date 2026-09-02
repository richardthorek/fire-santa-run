import type { Route, RouteTemplate, Waypoint } from '../types';
import type { User } from '../types/user';

/**
 * A brigade is 1:1 with a Station Manager Organization — `id` IS the
 * organizationId. Membership, roles, and access are governed entirely by
 * Station Manager (the StationKit suite identity/licensing provider); this
 * record holds only Santa Run's own app-specific brigade data (branding,
 * location, subscription mirror).
 */
export interface Brigade {
  /** Unique brigade identifier — equals the Station Manager organizationId. */
  id: string;

  /** URL-friendly identifier (e.g., "riverside-brigade") */
  slug: string;

  /** Official brigade name (e.g., "Riverside Fire Brigade") */
  name: string;

  /** Location (e.g., "Riverside, NSW") */
  location: string;

  /** Station coordinates [longitude, latitude] for map display */
  stationCoordinates?: [number, number];

  /** Reference to fire station dataset entry */
  fireStationId?: string;

  /** URL or base64 encoded logo */
  logo?: string;

  /** Custom theme color (hex) */
  themeColor?: string;

  /** Contact information */
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };

  /** Brigade record creation date */
  createdAt: string;

  /** Last updated timestamp */
  updatedAt: string;

  /** Number of days after completion before a route is auto-archived (default: 90) */
  archiveThresholdDays?: number;

  /**
   * Visibility in the public brigade directory (`/brigades` search page).
   * - `auto` (default): listed only while the brigade has a current or
   *   upcoming run — a brigade with nothing scheduled stays out of the
   *   directory until it publishes its next run.
   * - `shown`: always listed.
   * - `hidden`: never listed.
   * A brigade's own public page (`/brigade/:slug`) is always reachable by
   * direct link regardless of this setting — this only controls the directory.
   */
  publicListing?: 'auto' | 'shown' | 'hidden';
}

export interface IStorageAdapter {
  // Route operations
  saveRoute(brigadeId: string, route: Route): Promise<void>;
  getRoutes(brigadeId: string): Promise<Route[]>;
  getRoute(brigadeId: string, routeId: string): Promise<Route | null>;
  /**
   * Look up a route by ID alone, without knowing its brigade — used by the
   * public tracking page (/track/:id) where viewers are anonymous. Only
   * returns publicly visible routes (published/active/completed/archived);
   * drafts resolve to null.
   */
  getPublicRoute(routeId: string): Promise<Route | null>;
  deleteRoute(brigadeId: string, routeId: string): Promise<void>;

  // Waypoint operations (stored separately to avoid entity size limits)
  saveWaypoint(brigadeId: string, routeId: string, waypoint: Waypoint): Promise<void>;
  saveWaypoints(brigadeId: string, routeId: string, waypoints: Waypoint[]): Promise<void>;
  getWaypoints(brigadeId: string, routeId: string): Promise<Waypoint[]>;
  deleteWaypoints(brigadeId: string, routeId: string): Promise<void>;

  // Route template operations
  saveTemplate(brigadeId: string, template: RouteTemplate): Promise<void>;
  getTemplates(brigadeId: string): Promise<RouteTemplate[]>;
  getTemplate(brigadeId: string, templateId: string): Promise<RouteTemplate | null>;
  deleteTemplate(brigadeId: string, templateId: string): Promise<void>;
  
  // Brigade operations
  getBrigades(): Promise<Brigade[]>;
  getBrigade(brigadeId: string): Promise<Brigade | null>;
  getBrigadeByStationId(fireStationId: string): Promise<Brigade | null>;
  /** Look up a brigade by its public URL slug (for /brigade/:slug). */
  getBrigadeBySlug(slug: string): Promise<Brigade | null>;
  saveBrigade(brigade: Brigade): Promise<void>;
  
  // User operations
  saveUser(user: User): Promise<void>;
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
}
