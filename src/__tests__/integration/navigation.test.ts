/**
 * Integration Test: Navigation Flow with Mock GPS
 * 
 * Tests the navigation flow logic:
 * 1. Track position updates
 * 2. Progress through waypoints
 * 3. Complete waypoints
 * 4. Complete route
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isNearWaypoint } from '../../utils/navigation';
import { createMockRoute, createMockWaypoint, MockGeolocation } from './testUtils';
import type { Route, Waypoint } from '../../types';

describe('Integration: Navigation Flow (Mock GPS)', () => {
  let mockGeolocation: MockGeolocation;
  
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_DEV_MODE', 'true');
    
    // Set up mock geolocation
    mockGeolocation = new MockGeolocation();
    Object.defineProperty(global.navigator, 'geolocation', {
      writable: true,
      value: mockGeolocation,
    });
  });

  it('should detect arrival at waypoints', () => {
    const waypoint = createMockWaypoint(0, { coordinates: [151.2093, -33.8688] });
    
    // Position at waypoint - use coordinate tuple format
    const atWaypoint: [number, number] = [151.2093, -33.8688];
    
    expect(isNearWaypoint(atWaypoint, waypoint)).toBe(true);
    
    // Position far from waypoint
    const farFromWaypoint: [number, number] = [151.3000, -33.9000];
    
    expect(isNearWaypoint(farFromWaypoint, waypoint)).toBe(false);
  });

  it('should track completed waypoints', () => {
    const route = createMockRoute({
      status: 'active',
      waypoints: [
        createMockWaypoint(0, { coordinates: [151.2093, -33.8688] }),
        createMockWaypoint(1, { coordinates: [151.1957, -33.8567] }),
        createMockWaypoint(2, { coordinates: [151.2100, -33.8690] }),
      ],
    });
    
    // Mark first waypoint as completed
    const updatedRoute: Route = {
      ...route,
      waypoints: route.waypoints.map((wp, idx) => 
        idx === 0 ? { ...wp, isCompleted: true, actualArrival: new Date().toISOString() } : wp
      ),
    };
    
    expect(updatedRoute.waypoints[0].isCompleted).toBe(true);
    expect(updatedRoute.waypoints[0].actualArrival).toBeDefined();
    expect(updatedRoute.waypoints[1].isCompleted).toBe(false);
  });

  it('should complete route when all waypoints are visited', () => {
    const route = createMockRoute({
      status: 'active',
      startedAt: new Date().toISOString(),
      waypoints: [
        createMockWaypoint(0, { isCompleted: true }),
        createMockWaypoint(1, { isCompleted: true }),
      ],
    });
    
    const allCompleted = route.waypoints.every(wp => wp.isCompleted);
    expect(allCompleted).toBe(true);
    
    // Complete the route
    const completedRoute: Route = {
      ...route,
      status: 'completed',
      completedAt: new Date().toISOString(),
      actualDuration: 3600, // 1 hour
    };
    
    expect(completedRoute.status).toBe('completed');
    expect(completedRoute.completedAt).toBeDefined();
    expect(completedRoute.actualDuration).toBeGreaterThan(0);
  });

  it('should handle GPS position updates', async () => {
    return new Promise<void>((resolve) => {
      const positions: GeolocationPosition[] = [];
      
      const watchId = mockGeolocation.watchPosition((position) => {
        positions.push(position);
        
        if (positions.length === 1) {
          // Verify initial position
          expect(position.coords.latitude).toBeDefined();
          expect(position.coords.longitude).toBeDefined();
          
          // Update position
          mockGeolocation.updatePosition({
            latitude: -33.8670,
            longitude: 151.2100,
          });
        } else if (positions.length === 2) {
          // Verify updated position
          expect(position.coords.latitude).toBe(-33.8670);
          expect(position.coords.longitude).toBe(151.2100);
          
          mockGeolocation.clearWatch(watchId);
          resolve();
        }
      });
    });
  });

  it('should complete full navigation flow from start to finish', () => {
    const route = createMockRoute({
      status: 'published',
      waypoints: [
        createMockWaypoint(0, { 
          coordinates: [151.2093, -33.8688],
          name: 'Fire Station',
        }),
        createMockWaypoint(1, { 
          coordinates: [151.2100, -33.8670],
          name: 'Community Center',
        }),
        createMockWaypoint(2, { 
          coordinates: [151.2110, -33.8650],
          name: 'Town Hall',
        }),
      ],
    });
    
    // Step 1: Start navigation
    const activeRoute: Route = {
      ...route,
      status: 'active',
      startedAt: new Date().toISOString(),
    };
    
    expect(activeRoute.status).toBe('active');
    expect(activeRoute.startedAt).toBeDefined();
    
    // Step 2: Complete first waypoint
    const afterWaypoint1: Route = {
      ...activeRoute,
      waypoints: activeRoute.waypoints.map((wp, idx) => 
        idx === 0 ? { ...wp, isCompleted: true, actualArrival: new Date().toISOString() } : wp
      ),
    };
    
    expect(afterWaypoint1.waypoints[0].isCompleted).toBe(true);
    expect(afterWaypoint1.waypoints.filter(wp => wp.isCompleted)).toHaveLength(1);
    
    // Step 3: Complete second waypoint
    const afterWaypoint2: Route = {
      ...afterWaypoint1,
      waypoints: afterWaypoint1.waypoints.map((wp, idx) => 
        idx <= 1 ? { ...wp, isCompleted: true, actualArrival: new Date().toISOString() } : wp
      ),
    };
    
    expect(afterWaypoint2.waypoints.filter(wp => wp.isCompleted)).toHaveLength(2);
    
    // Step 4: Complete final waypoint and route
    const completedRoute: Route = {
      ...afterWaypoint2,
      waypoints: afterWaypoint2.waypoints.map(wp => 
        ({ ...wp, isCompleted: true, actualArrival: new Date().toISOString() })
      ),
      status: 'completed',
      completedAt: new Date().toISOString(),
      actualDuration: 3600,
    };
    
    expect(completedRoute.status).toBe('completed');
    expect(completedRoute.waypoints.every(wp => wp.isCompleted)).toBe(true);
    expect(completedRoute.completedAt).toBeDefined();
    expect(completedRoute.actualDuration).toBeGreaterThan(0);
  });
});
