/**
 * Unit tests for route helper utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

      expect(route.brigadeId).toBe(brigadeId);
      expect(route.status).toBe('draft');
      expect(route.waypoints).toEqual([]);
      expect(route.name).toBe('');
      expect(route.id).toMatch(/^route_/);
      expect(route.createdAt).toBeTruthy();
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
});
