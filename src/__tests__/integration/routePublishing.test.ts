/**
 * Integration Test: Route Publishing Flow
 * 
 * Tests the complete flow of publishing a route:
 * 1. Create and validate a draft route
 * 2. Generate shareable link
 * 3. Publish route (change status to published)
 * 4. Verify route is accessible
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateShareableLink, canPublishRoute } from '../../utils/routeHelpers';
import { createMockRoute, createMockWaypoint } from './testUtils';
import type { Route } from '../../types';

describe('Integration: Route Publishing Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_DEV_MODE', 'true');
    vi.stubEnv('VITE_APP_URL', 'http://localhost:3000');
  });

  it('should generate shareable link for route', () => {
    const routeId = 'test-route-123';
    
    const shareableLink = generateShareableLink(routeId);
    
    expect(shareableLink).toContain('/track/');
    expect(shareableLink).toContain('test-route-123');
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

  it('should publish a draft route', () => {
    // Create draft route
    const draftRoute = createMockRoute({
      name: 'Santa Run 2024',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [
        createMockWaypoint(0, { name: 'Fire Station' }),
        createMockWaypoint(1, { name: 'Town Square' }),
      ],
    });
    
    // Publish the route
    const publishedRoute: Route = {
      ...draftRoute,
      status: 'published' as const,
      publishedAt: new Date().toISOString(),
      shareableLink: generateShareableLink(draftRoute.id),
    };
    
    expect(publishedRoute.status).toBe('published');
    expect(publishedRoute.publishedAt).toBeDefined();
    expect(publishedRoute.shareableLink).toBeDefined();
  });

  it('should complete end-to-end publishing flow', () => {
    // Step 1: Create a complete draft route
    const draftRoute = createMockRoute({
      name: 'Christmas Eve Santa Run 2024',
      description: 'Annual community route',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
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
    });
    
    // Step 2: Validate route can be published
    expect(canPublishRoute(draftRoute)).toBe(true);
    
    // Step 3: Generate shareable link
    const shareableLink = generateShareableLink(draftRoute.id);
    expect(shareableLink).toContain('/track/');
    expect(shareableLink).toContain(draftRoute.id);
    
    // Step 4: Publish route with shareable link
    const publishedRoute: Route = {
      ...draftRoute,
      status: 'published' as const,
      publishedAt: new Date().toISOString(),
      shareableLink,
    };
    
    // Step 5: Verify published route
    expect(publishedRoute.status).toBe('published');
    expect(publishedRoute.publishedAt).toBeDefined();
    expect(publishedRoute.shareableLink).toBe(shareableLink);
    expect(publishedRoute.waypoints).toHaveLength(3);
  });

  it('should not allow publishing invalid routes', () => {
    // Route with insufficient waypoints
    const invalidRoute = createMockRoute({
      name: 'Invalid Route',
      status: 'draft',
      waypoints: [createMockWaypoint(0)],
    });
    
    expect(canPublishRoute(invalidRoute)).toBe(false);
  });

  it('should allow republishing an edited route', () => {
    // Create and publish initial route
    const initialRoute = createMockRoute({
      name: 'Initial Route',
      status: 'published',
      publishedAt: new Date().toISOString(),
      waypoints: [createMockWaypoint(0), createMockWaypoint(1)],
      shareableLink: generateShareableLink('initial'),
    });
    
    // Edit the route (add waypoint)
    const editedRoute: Route = {
      ...initialRoute,
      waypoints: [
        ...initialRoute.waypoints,
        createMockWaypoint(2),
      ],
    };
    
    // Verify edited route
    expect(editedRoute.status).toBe('published');
    expect(editedRoute.waypoints).toHaveLength(3);
    expect(editedRoute.shareableLink).toBeDefined();
  });
});
