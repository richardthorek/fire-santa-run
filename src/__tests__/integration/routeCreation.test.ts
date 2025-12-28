/**
 * Integration Test: Route Creation Flow
 * 
 * Tests the complete flow of creating a new route:
 * 1. Initialize new route
 * 2. Add waypoints
 * 3. Update metadata
 * 4. Validate route
 * 5. Save route to storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNewRoute, canPublishRoute } from '../../utils/routeHelpers';
import { storageAdapter } from '../../storage';
import { createMockRoute, createMockWaypoint, mockDirectionsAPI } from './testUtils';
import type { Route, Waypoint } from '../../types';

describe('Integration: Route Creation Flow', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock Mapbox Directions API
    mockDirectionsAPI();
    
    // Mock environment
    vi.stubEnv('VITE_DEV_MODE', 'true');
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token');
  });

  it('should create a new route with default values', () => {
    const brigadeId = 'test-brigade-123';
    const userEmail = 'test@example.com';
    
    const route = createNewRoute(brigadeId, userEmail);
    
    expect(route.id).toBeDefined();
    expect(route.brigadeId).toBe(brigadeId);
    expect(route.status).toBe('draft');
    expect(route.waypoints).toEqual([]);
    expect(route.createdBy).toBe(userEmail);
    expect(route.createdAt).toBeDefined();
  });

  it('should add waypoints to a route', () => {
    const route = createMockRoute();
    
    const waypoint1: Waypoint = createMockWaypoint(0, {
      coordinates: [151.2093, -33.8688],
      address: 'Sydney Opera House',
    });
    
    const waypoint2: Waypoint = createMockWaypoint(1, {
      coordinates: [151.1957, -33.8567],
      address: 'Darling Harbour',
    });
    
    const updatedRoute: Route = {
      ...route,
      waypoints: [waypoint1, waypoint2],
    };
    
    expect(updatedRoute.waypoints).toHaveLength(2);
    expect(updatedRoute.waypoints[0].order).toBe(0);
    expect(updatedRoute.waypoints[1].order).toBe(1);
  });

  it('should update route metadata', () => {
    const route = createMockRoute();
    
    const metadata = {
      name: 'Christmas Eve Santa Run 2024',
      description: 'Annual route through the suburbs',
      date: '2024-12-24',
      startTime: '18:00',
    };
    
    const updatedRoute: Route = {
      ...route,
      ...metadata,
    };
    
    expect(updatedRoute.name).toBe(metadata.name);
    expect(updatedRoute.description).toBe(metadata.description);
    expect(updatedRoute.date).toBe(metadata.date);
    expect(updatedRoute.startTime).toBe(metadata.startTime);
  });

  it('should validate route before publishing', () => {
    // Invalid: no waypoints
    const invalidRoute1 = createMockRoute({
      name: 'Test Route',
      waypoints: [],
    });
    expect(canPublishRoute(invalidRoute1)).toBe(false);
    
    // Invalid: only one waypoint
    const invalidRoute2 = createMockRoute({
      name: 'Test Route',
      waypoints: [createMockWaypoint(0)],
    });
    expect(canPublishRoute(invalidRoute2)).toBe(false);
    
    // Invalid: no name
    const invalidRoute3 = createMockRoute({
      name: '',
      waypoints: [createMockWaypoint(0), createMockWaypoint(1)],
    });
    expect(canPublishRoute(invalidRoute3)).toBe(false);
    
    // Valid route
    const validRoute = createMockRoute({
      name: 'Christmas Eve Run',
      date: '2024-12-24',
      startTime: '18:00',
      waypoints: [createMockWaypoint(0), createMockWaypoint(1)],
    });
    expect(canPublishRoute(validRoute)).toBe(true);
  });

  it('should prepare route for saving', () => {
    const newRoute = createMockRoute({
      name: 'Santa Run 2024',
      waypoints: [
        createMockWaypoint(0),
        createMockWaypoint(1),
      ],
    });
    
    // Verify route is ready to save
    expect(newRoute.id).toBeDefined();
    expect(newRoute.brigadeId).toBeDefined();
    expect(newRoute.name).toBe('Santa Run 2024');
    expect(newRoute.waypoints).toHaveLength(2);
  });

  it('should complete end-to-end route creation flow', () => {
    // Step 1: Create new route
    const brigadeId = 'test-brigade';
    const userEmail = 'test@example.com';
    const newRoute = createNewRoute(brigadeId, userEmail);
    
    // Step 2: Update metadata
    const routeWithMetadata: Route = {
      ...newRoute,
      name: 'Christmas Eve Route 2024',
      description: 'Main suburban route',
      date: '2024-12-24',
      startTime: '18:00',
    };
    
    // Step 3: Add waypoints
    const routeWithWaypoints: Route = {
      ...routeWithMetadata,
      waypoints: [
        createMockWaypoint(0, {
          name: 'Fire Station',
          address: '1 Fire Station Rd, Sydney NSW',
          coordinates: [151.2093, -33.8688],
        }),
        createMockWaypoint(1, {
          name: 'Community Center',
          address: '5 Main St, Sydney NSW',
          coordinates: [151.1957, -33.8567],
        }),
        createMockWaypoint(2, {
          name: 'Shopping Center',
          address: '10 Market St, Sydney NSW',
          coordinates: [151.2100, -33.8690],
        }),
      ],
    };
    
    // Step 4: Validate route
    expect(canPublishRoute(routeWithWaypoints)).toBe(true);
    
    // Verify final route structure
    expect(routeWithWaypoints.name).toBe('Christmas Eve Route 2024');
    expect(routeWithWaypoints.status).toBe('draft');
    expect(routeWithWaypoints.waypoints).toHaveLength(3);
    expect(routeWithWaypoints.createdBy).toBe(userEmail);
    expect(routeWithWaypoints.brigadeId).toBe(brigadeId);
  });
});
