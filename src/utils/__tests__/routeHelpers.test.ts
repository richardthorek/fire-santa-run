/**
 * Unit tests for route helper utilities
 */

import { describe, it, expect } from 'vitest';
import {
  generateRouteId,
  generateWaypointId,
  generateShareableLink,
  canEditRoute,
  canPublishRoute,
  canStartRoute,
  canDeleteRoute,
  sortWaypoints,
  reorderWaypoints,
  getStatusColor,
  getStatusLabel,
  validateRoute,
  createNewRoute,
  duplicateRoute,
  searchRoutes,
  filterRoutes,
  sortRoutes,
  type RouteFilterOptions,
  type RouteSortOptions,
} from '../routeHelpers';
import type { Route, Waypoint, RouteStatus } from '../../types';

describe('routeHelpers', () => {
  describe('generateRouteId', () => {
    it('should generate a unique route ID', () => {
      const id1 = generateRouteId();
      const id2 = generateRouteId();
      
      expect(id1).toMatch(/^route_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^route_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const beforeTime = Date.now();
      const id = generateRouteId();
      const afterTime = Date.now();
      
      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('generateWaypointId', () => {
    it('should generate a unique waypoint ID', () => {
      const id1 = generateWaypointId();
      const id2 = generateWaypointId();
      
      expect(id1).toMatch(/^waypoint_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^waypoint_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateShareableLink', () => {
    it('should generate tracking link with route ID', () => {
      const routeId = 'route_123_abc';
      const link = generateShareableLink(routeId);
      
      expect(link).toContain('/track/route_123_abc');
    });

    it('should use window.location.origin as base', () => {
      const routeId = 'route_456_def';
      const link = generateShareableLink(routeId);
      
      expect(link).toMatch(/^https?:\/\/.+\/track\/route_456_def$/);
    });
  });

  describe('canEditRoute', () => {
    it('should allow editing draft routes', () => {
      expect(canEditRoute('draft')).toBe(true);
    });

    it('should not allow editing published routes', () => {
      expect(canEditRoute('published')).toBe(false);
    });

    it('should not allow editing active routes', () => {
      expect(canEditRoute('active')).toBe(false);
    });

    it('should not allow editing completed routes', () => {
      expect(canEditRoute('completed')).toBe(false);
    });

    it('should not allow editing archived routes', () => {
      expect(canEditRoute('archived')).toBe(false);
    });
  });

  describe('canPublishRoute', () => {
    const validRoute: Route = {
      id: 'route-1',
      brigadeId: 'brigade-1',
      name: 'Santa Run 2024',
      description: 'Annual santa run',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [
        { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
        { id: 'wp2', coordinates: [1, 1], order: 1, isCompleted: false },
      ],
      createdAt: '2024-01-01T00:00:00Z',
    };

    it('should allow publishing valid draft route', () => {
      expect(canPublishRoute(validRoute)).toBe(true);
    });

    it('should not allow publishing route without name', () => {
      const route = { ...validRoute, name: '' };
      expect(canPublishRoute(route)).toBe(false);
    });

    it('should not allow publishing route without date', () => {
      const route = { ...validRoute, date: '' };
      expect(canPublishRoute(route)).toBe(false);
    });

    it('should not allow publishing route with less than 2 waypoints', () => {
      const route = { ...validRoute, waypoints: [{ id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false }] };
      expect(canPublishRoute(route)).toBe(false);
    });

    it('should not allow publishing published route', () => {
      const route = { ...validRoute, status: 'published' as RouteStatus };
      expect(canPublishRoute(route)).toBe(false);
    });
  });

  describe('canStartRoute', () => {
    it('should allow starting published route', () => {
      expect(canStartRoute('published')).toBe(true);
    });

    it('should not allow starting draft route', () => {
      expect(canStartRoute('draft')).toBe(false);
    });

    it('should not allow starting active route', () => {
      expect(canStartRoute('active')).toBe(false);
    });
  });

  describe('canDeleteRoute', () => {
    it('should allow deleting draft route', () => {
      expect(canDeleteRoute('draft')).toBe(true);
    });

    it('should allow deleting completed route', () => {
      expect(canDeleteRoute('completed')).toBe(true);
    });

    it('should allow deleting archived route', () => {
      expect(canDeleteRoute('archived')).toBe(true);
    });

    it('should not allow deleting published route', () => {
      expect(canDeleteRoute('published')).toBe(false);
    });

    it('should not allow deleting active route', () => {
      expect(canDeleteRoute('active')).toBe(false);
    });
  });

  describe('sortWaypoints', () => {
    it('should sort waypoints by order field', () => {
      const waypoints: Waypoint[] = [
        { id: 'wp3', coordinates: [0, 0], order: 2, isCompleted: false },
        { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
        { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
      ];

      const sorted = sortWaypoints(waypoints);

      expect(sorted[0].id).toBe('wp1');
      expect(sorted[1].id).toBe('wp2');
      expect(sorted[2].id).toBe('wp3');
    });

    it('should not mutate original array', () => {
      const waypoints: Waypoint[] = [
        { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
        { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
      ];

      const sorted = sortWaypoints(waypoints);

      expect(waypoints[0].id).toBe('wp2'); // Original unchanged
      expect(sorted[0].id).toBe('wp1'); // Sorted copy
    });
  });

  describe('reorderWaypoints', () => {
    it('should reorder waypoints and update order field', () => {
      const waypoints: Waypoint[] = [
        { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
        { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
        { id: 'wp3', coordinates: [0, 0], order: 2, isCompleted: false },
      ];

      const reordered = reorderWaypoints(waypoints, 0, 2); // Move wp1 to end

      expect(reordered[0].id).toBe('wp2');
      expect(reordered[0].order).toBe(0);
      expect(reordered[1].id).toBe('wp3');
      expect(reordered[1].order).toBe(1);
      expect(reordered[2].id).toBe('wp1');
      expect(reordered[2].order).toBe(2);
    });

    it('should handle moving waypoint forward', () => {
      const waypoints: Waypoint[] = [
        { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
        { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
        { id: 'wp3', coordinates: [0, 0], order: 2, isCompleted: false },
      ];

      const reordered = reorderWaypoints(waypoints, 2, 0); // Move wp3 to start

      expect(reordered[0].id).toBe('wp3');
      expect(reordered[1].id).toBe('wp1');
      expect(reordered[2].id).toBe('wp2');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct color for each status', () => {
      expect(getStatusColor('draft')).toBe('#616161');
      expect(getStatusColor('published')).toBe('#29B6F6');
      expect(getStatusColor('active')).toBe('#D32F2F');
      expect(getStatusColor('completed')).toBe('#43A047');
      expect(getStatusColor('archived')).toBe('#9E9E9E');
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct label for each status', () => {
      expect(getStatusLabel('draft')).toBe('Draft');
      expect(getStatusLabel('published')).toBe('Published');
      expect(getStatusLabel('active')).toBe('Active');
      expect(getStatusLabel('completed')).toBe('Completed');
      expect(getStatusLabel('archived')).toBe('Archived');
    });
  });

  describe('validateRoute', () => {
    it('should validate complete route', () => {
      const route: Partial<Route> = {
        name: 'Santa Run',
        date: '2024-12-24',
        startTime: '18:00',
        waypoints: [
          { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
          { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
        ],
      };

      const result = validateRoute(route);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing name', () => {
      const route: Partial<Route> = {
        name: '',
        date: '2024-12-24',
        startTime: '18:00',
        waypoints: [
          { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
          { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
        ],
      };

      const result = validateRoute(route);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Route name is required');
    });

    it('should return error for missing date', () => {
      const route: Partial<Route> = {
        name: 'Santa Run',
        date: '',
        startTime: '18:00',
        waypoints: [
          { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
          { id: 'wp2', coordinates: [0, 0], order: 1, isCompleted: false },
        ],
      };

      const result = validateRoute(route);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Route date is required');
    });

    it('should return error for insufficient waypoints', () => {
      const route: Partial<Route> = {
        name: 'Santa Run',
        date: '2024-12-24',
        startTime: '18:00',
        waypoints: [{ id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false }],
      };

      const result = validateRoute(route);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 2 waypoints are required');
    });

    it('should return multiple errors', () => {
      const route: Partial<Route> = {
        name: '',
        date: '',
        startTime: '',
        waypoints: [],
      };

      const result = validateRoute(route);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('createNewRoute', () => {
    it('should create new route with default values', () => {
      const brigadeId = 'brigade-123';
      const route = createNewRoute(brigadeId);

      const now = new Date();
      const targetYear = (now.getMonth() > 11 || (now.getMonth() === 11 && now.getDate() > 24))
        ? now.getFullYear() + 1
        : now.getFullYear();

      expect(route.brigadeId).toBe(brigadeId);
      expect(route.status).toBe('draft');
      expect(route.waypoints).toEqual([]);
      expect(route.name).toBe('');
      expect(route.id).toMatch(/^route_/);
      expect(route.createdAt).toBeTruthy();
      expect(route.date).toBe(`${targetYear}-12-24`);
      expect(route.startTime).toBe('16:00');
    });

    it('should include createdBy if provided', () => {
      const brigadeId = 'brigade-123';
      const userId = 'user-456';
      const route = createNewRoute(brigadeId, userId);

      expect(route.createdBy).toBe(userId);
    });

    it('should generate unique IDs for different routes', () => {
      const route1 = createNewRoute('brigade-1');
      const route2 = createNewRoute('brigade-1');

      expect(route1.id).not.toBe(route2.id);
    });
  });

  describe('duplicateRoute', () => {
    const baseRoute: Route = {
      id: 'route_111_abc',
      brigadeId: 'brigade-123',
      name: 'Test Route',
      description: 'A description',
      date: '2024-12-24',
      startTime: '16:00',
      status: 'published',
      waypoints: [
        {
          id: 'waypoint_1',
          coordinates: [151.2093, -33.8688],
          name: 'Stop 1',
          order: 0,
          isCompleted: true,
          actualArrival: '2024-12-24T16:30:00.000Z',
        },
        {
          id: 'waypoint_2',
          coordinates: [151.2200, -33.8700],
          name: 'Stop 2',
          order: 1,
          isCompleted: false,
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
      publishedAt: '2024-01-02T00:00:00.000Z',
      startedAt: '2024-12-24T16:00:00.000Z',
      completedAt: '2024-12-24T20:00:00.000Z',
      shareableLink: 'https://example.com/track/route_111_abc',
      qrCodeUrl: 'https://example.com/qr/route_111_abc',
    };

    it('should assign a new unique route ID', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.id).not.toBe(baseRoute.id);
      expect(duplicate.id).toMatch(/^route_\d+_[a-z0-9]+$/);
    });

    it('should append " - Copy" to the route name', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.name).toBe('Test Route - Copy');
    });

    it('should set status to draft', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.status).toBe('draft');
    });

    it('should copy all waypoints with isCompleted reset to false', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.waypoints).toHaveLength(2);
      duplicate.waypoints.forEach(wp => {
        expect(wp.isCompleted).toBe(false);
      });
    });

    it('should clear actualArrival from copied waypoints', () => {
      const duplicate = duplicateRoute(baseRoute);

      duplicate.waypoints.forEach(wp => {
        expect(wp.actualArrival).toBeUndefined();
      });
    });

    it('should copy waypoint coordinates and metadata', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.waypoints[0].coordinates).toEqual([151.2093, -33.8688]);
      expect(duplicate.waypoints[0].name).toBe('Stop 1');
      expect(duplicate.waypoints[1].coordinates).toEqual([151.2200, -33.8700]);
    });

    it('should clear publishedAt, startedAt, and completedAt', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.publishedAt).toBeUndefined();
      expect(duplicate.startedAt).toBeUndefined();
      expect(duplicate.completedAt).toBeUndefined();
    });

    it('should clear shareableLink and qrCodeUrl', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.shareableLink).toBeUndefined();
      expect(duplicate.qrCodeUrl).toBeUndefined();
    });

    it('should set a fresh createdAt timestamp', () => {
      const before = Date.now();
      const duplicate = duplicateRoute(baseRoute);
      const after = Date.now();

      const duplicateTime = new Date(duplicate.createdAt).getTime();
      expect(duplicateTime).toBeGreaterThanOrEqual(before);
      expect(duplicateTime).toBeLessThanOrEqual(after);
    });

    it('should preserve brigadeId, description, date, and other metadata', () => {
      const duplicate = duplicateRoute(baseRoute);

      expect(duplicate.brigadeId).toBe(baseRoute.brigadeId);
      expect(duplicate.description).toBe(baseRoute.description);
      expect(duplicate.date).toBe(baseRoute.date);
      expect(duplicate.startTime).toBe(baseRoute.startTime);
    });

    it('should not mutate the original route', () => {
      const originalName = baseRoute.name;
      const originalStatus = baseRoute.status;
      duplicateRoute(baseRoute);

      expect(baseRoute.name).toBe(originalName);
      expect(baseRoute.status).toBe(originalStatus);
    });
  });

  describe('searchRoutes', () => {
    const testRoute: Route = {
      id: 'route-1',
      brigadeId: 'brigade-1',
      name: 'Christmas Eve Santa Run',
      description: 'Annual festive route through the suburbs',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'published',
      waypoints: [
        {
          id: 'wp1',
          coordinates: [151.2093, -33.8688],
          address: '123 Main Street, Sydney NSW',
          name: 'Town Hall',
          order: 0,
          isCompleted: false,
        },
        {
          id: 'wp2',
          coordinates: [151.2200, -33.8700],
          address: '456 Park Avenue, Sydney NSW',
          name: 'Community Center',
          order: 1,
          isCompleted: false,
        },
      ],
      createdAt: '2024-01-01T00:00:00Z',
    };

    it('should return true when query is empty', () => {
      expect(searchRoutes(testRoute, '')).toBe(true);
      expect(searchRoutes(testRoute, '   ')).toBe(true);
    });

    it('should search by route name (case insensitive)', () => {
      expect(searchRoutes(testRoute, 'christmas')).toBe(true);
      expect(searchRoutes(testRoute, 'CHRISTMAS')).toBe(true);
      expect(searchRoutes(testRoute, 'Santa')).toBe(true);
      expect(searchRoutes(testRoute, 'holiday')).toBe(false);
    });

    it('should search by route description', () => {
      expect(searchRoutes(testRoute, 'festive')).toBe(true);
      expect(searchRoutes(testRoute, 'suburbs')).toBe(true);
      expect(searchRoutes(testRoute, 'downtown')).toBe(false);
    });

    it('should search by waypoint address', () => {
      expect(searchRoutes(testRoute, 'Main Street')).toBe(true);
      expect(searchRoutes(testRoute, 'Park Avenue')).toBe(true);
      expect(searchRoutes(testRoute, 'sydney')).toBe(true);
      expect(searchRoutes(testRoute, 'Melbourne')).toBe(false);
    });

    it('should search by waypoint name', () => {
      expect(searchRoutes(testRoute, 'Town Hall')).toBe(true);
      expect(searchRoutes(testRoute, 'Community')).toBe(true);
      expect(searchRoutes(testRoute, 'Library')).toBe(false);
    });
  });

  describe('filterRoutes', () => {
    const testRoute: Route = {
      id: 'route-1',
      brigadeId: 'brigade-1',
      name: 'Test Route',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'published',
      waypoints: [
        { id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false },
        { id: 'wp2', coordinates: [1, 1], order: 1, isCompleted: false },
        { id: 'wp3', coordinates: [2, 2], order: 2, isCompleted: false },
      ],
      distance: 5000, // 5km in meters
      createdAt: '2024-01-01T00:00:00Z',
    };

    it('should return true when no filters applied', () => {
      expect(filterRoutes(testRoute, {})).toBe(true);
    });

    it('should filter by date range', () => {
      expect(filterRoutes(testRoute, { dateFrom: '2024-01-01' })).toBe(true);
      expect(filterRoutes(testRoute, { dateFrom: '2024-12-25' })).toBe(false);
      expect(filterRoutes(testRoute, { dateTo: '2024-12-31' })).toBe(true);
      expect(filterRoutes(testRoute, { dateTo: '2024-12-23' })).toBe(false);
      expect(filterRoutes(testRoute, { dateFrom: '2024-12-01', dateTo: '2024-12-31' })).toBe(true);
      expect(filterRoutes(testRoute, { dateFrom: '2025-01-01', dateTo: '2025-12-31' })).toBe(false);
    });

    it('should filter by status', () => {
      expect(filterRoutes(testRoute, { statuses: ['published'] })).toBe(true);
      expect(filterRoutes(testRoute, { statuses: ['draft', 'published'] })).toBe(true);
      expect(filterRoutes(testRoute, { statuses: ['draft'] })).toBe(false);
      expect(filterRoutes(testRoute, { statuses: [] })).toBe(true);
    });

    it('should filter by distance range (in meters)', () => {
      expect(filterRoutes(testRoute, { minDistance: 1000 })).toBe(true);
      expect(filterRoutes(testRoute, { minDistance: 10000 })).toBe(false);
      expect(filterRoutes(testRoute, { maxDistance: 10000 })).toBe(true);
      expect(filterRoutes(testRoute, { maxDistance: 3000 })).toBe(false);
      expect(filterRoutes(testRoute, { minDistance: 3000, maxDistance: 7000 })).toBe(true);
    });

    it('should filter by number of stops', () => {
      expect(filterRoutes(testRoute, { minStops: 2 })).toBe(true);
      expect(filterRoutes(testRoute, { minStops: 5 })).toBe(false);
      expect(filterRoutes(testRoute, { maxStops: 5 })).toBe(true);
      expect(filterRoutes(testRoute, { maxStops: 2 })).toBe(false);
      expect(filterRoutes(testRoute, { minStops: 2, maxStops: 4 })).toBe(true);
    });

    it('should handle routes without distance gracefully', () => {
      const routeWithoutDistance = { ...testRoute, distance: undefined };
      // Routes without distance pass distance filters (don't exclude routes with missing data)
      expect(filterRoutes(routeWithoutDistance, { minDistance: 1000 })).toBe(true);
      expect(filterRoutes(routeWithoutDistance, {})).toBe(true);
    });

    it('should apply multiple filters together', () => {
      const filters: RouteFilterOptions = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        statuses: ['published', 'active'],
        minDistance: 3000,
        maxDistance: 10000,
        minStops: 2,
        maxStops: 5,
      };
      expect(filterRoutes(testRoute, filters)).toBe(true);
    });
  });

  describe('sortRoutes', () => {
    const routes: Route[] = [
      {
        id: 'route-1',
        brigadeId: 'brigade-1',
        name: 'Charlie Route',
        date: '2024-12-24',
        startTime: '18:00',
        status: 'published',
        waypoints: [{ id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false }],
        distance: 5000,
        viewCount: 100,
        createdAt: '2024-01-15T00:00:00Z',
      },
      {
        id: 'route-2',
        brigadeId: 'brigade-1',
        name: 'Alpha Route',
        date: '2024-12-25',
        startTime: '16:00',
        status: 'draft',
        waypoints: [{ id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false }],
        distance: 10000,
        viewCount: 50,
        createdAt: '2024-01-10T00:00:00Z',
      },
      {
        id: 'route-3',
        brigadeId: 'brigade-1',
        name: 'Beta Route',
        date: '2024-12-23',
        startTime: '20:00',
        status: 'completed',
        waypoints: [{ id: 'wp1', coordinates: [0, 0], order: 0, isCompleted: false }],
        distance: 3000,
        viewCount: 200,
        createdAt: '2024-01-20T00:00:00Z',
      },
    ];

    it('should sort by date ascending', () => {
      const sorted = sortRoutes(routes, { field: 'date', order: 'asc' });
      expect(sorted[0].date).toBe('2024-12-23');
      expect(sorted[1].date).toBe('2024-12-24');
      expect(sorted[2].date).toBe('2024-12-25');
    });

    it('should sort by date descending', () => {
      const sorted = sortRoutes(routes, { field: 'date', order: 'desc' });
      expect(sorted[0].date).toBe('2024-12-25');
      expect(sorted[1].date).toBe('2024-12-24');
      expect(sorted[2].date).toBe('2024-12-23');
    });

    it('should sort by name ascending (A-Z)', () => {
      const sorted = sortRoutes(routes, { field: 'name', order: 'asc' });
      expect(sorted[0].name).toBe('Alpha Route');
      expect(sorted[1].name).toBe('Beta Route');
      expect(sorted[2].name).toBe('Charlie Route');
    });

    it('should sort by name descending (Z-A)', () => {
      const sorted = sortRoutes(routes, { field: 'name', order: 'desc' });
      expect(sorted[0].name).toBe('Charlie Route');
      expect(sorted[1].name).toBe('Beta Route');
      expect(sorted[2].name).toBe('Alpha Route');
    });

    it('should sort by distance ascending', () => {
      const sorted = sortRoutes(routes, { field: 'distance', order: 'asc' });
      expect(sorted[0].distance).toBe(3000);
      expect(sorted[1].distance).toBe(5000);
      expect(sorted[2].distance).toBe(10000);
    });

    it('should sort by distance descending', () => {
      const sorted = sortRoutes(routes, { field: 'distance', order: 'desc' });
      expect(sorted[0].distance).toBe(10000);
      expect(sorted[1].distance).toBe(5000);
      expect(sorted[2].distance).toBe(3000);
    });

    it('should sort by views ascending', () => {
      const sorted = sortRoutes(routes, { field: 'views', order: 'asc' });
      expect(sorted[0].viewCount).toBe(50);
      expect(sorted[1].viewCount).toBe(100);
      expect(sorted[2].viewCount).toBe(200);
    });

    it('should sort by views descending', () => {
      const sorted = sortRoutes(routes, { field: 'views', order: 'desc' });
      expect(sorted[0].viewCount).toBe(200);
      expect(sorted[1].viewCount).toBe(100);
      expect(sorted[2].viewCount).toBe(50);
    });

    it('should sort by created date ascending', () => {
      const sorted = sortRoutes(routes, { field: 'created', order: 'asc' });
      expect(sorted[0].id).toBe('route-2'); // 2024-01-10
      expect(sorted[1].id).toBe('route-1'); // 2024-01-15
      expect(sorted[2].id).toBe('route-3'); // 2024-01-20
    });

    it('should sort by created date descending', () => {
      const sorted = sortRoutes(routes, { field: 'created', order: 'desc' });
      expect(sorted[0].id).toBe('route-3'); // 2024-01-20
      expect(sorted[1].id).toBe('route-1'); // 2024-01-15
      expect(sorted[2].id).toBe('route-2'); // 2024-01-10
    });

    it('should not mutate original array', () => {
      const originalOrder = routes.map(r => r.id);
      sortRoutes(routes, { field: 'name', order: 'asc' });
      expect(routes.map(r => r.id)).toEqual(originalOrder);
    });

    it('should handle routes without distance gracefully', () => {
      const routesWithMissingData = [
        { ...routes[0], distance: undefined },
        routes[1],
        { ...routes[2], distance: undefined },
      ];
      const sorted = sortRoutes(routesWithMissingData, { field: 'distance', order: 'asc' });
      expect(sorted).toHaveLength(3);
    });

    it('should handle routes without viewCount gracefully', () => {
      const routesWithMissingData = [
        { ...routes[0], viewCount: undefined },
        routes[1],
        { ...routes[2], viewCount: undefined },
      ];
      const sorted = sortRoutes(routesWithMissingData, { field: 'views', order: 'desc' });
      expect(sorted).toHaveLength(3);
    });
  });
});
