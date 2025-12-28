/**
 * Integration Test: Real-Time Tracking (Mock BroadcastChannel)
 * 
 * Tests the real-time location broadcasting and receiving using BroadcastChannel API:
 * 1. Broadcaster sends location updates
 * 2. Viewers receive location updates
 * 3. Multiple viewers can track simultaneously
 * 4. Connection handling (connect/disconnect)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createMockLocationBroadcast, 
  MockBroadcastChannel,
} from './testUtils';
import type { LocationBroadcast } from '../../types';

describe('Integration: Real-Time Tracking (Mock BroadcastChannel)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_DEV_MODE', 'true');
    
    // Set up BroadcastChannel mock
    global.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
  });

  it('should broadcast location updates', async () => {
    const routeId = 'test-route-456';
    const receivedLocations: LocationBroadcast[] = [];
    
    await new Promise<void>((resolve) => {
      // Set up viewer to receive updates
      const viewer = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      viewer.onmessage = (event) => {
        receivedLocations.push(event.data as LocationBroadcast);
        
        if (receivedLocations.length === 1) {
          expect(receivedLocations[0].location).toEqual([151.2093, -33.8688]);
          expect(receivedLocations[0].routeId).toBe(routeId);
          viewer.close();
          broadcaster.close();
          resolve();
        }
      };
      
      // Set up broadcaster to send updates
      const broadcaster = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      
      // Send location update
      const locationUpdate = createMockLocationBroadcast({
        routeId,
        location: [151.2093, -33.8688],
      });
      
      broadcaster.postMessage(locationUpdate);
    });
  });

  it('should support multiple viewers tracking same route', async () => {
    const routeId = 'multi-viewer-route';
    const viewer1Updates: LocationBroadcast[] = [];
    const viewer2Updates: LocationBroadcast[] = [];
    
    await new Promise<void>((resolve) => {
      // Viewer 1
      const viewer1 = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      viewer1.onmessage = (event) => {
        viewer1Updates.push(event.data as LocationBroadcast);
      };
      
      // Viewer 2
      const viewer2 = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      viewer2.onmessage = (event) => {
        viewer2Updates.push(event.data as LocationBroadcast);
        
        // Both viewers should have received the update
        if (viewer1Updates.length === 1 && viewer2Updates.length === 1) {
          expect(viewer1Updates[0].routeId).toBe(routeId);
          expect(viewer2Updates[0].routeId).toBe(routeId);
          viewer1.close();
          viewer2.close();
          broadcaster.close();
          resolve();
        }
      };
      
      // Broadcaster
      const broadcaster = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      
      // Send location update
      const location = createMockLocationBroadcast({ routeId });
      broadcaster.postMessage(location);
    });
  });

  it('should include waypoint progress in broadcasts', async () => {
    const routeId = 'progress-route';
    const receivedUpdates: LocationBroadcast[] = [];
    
    await new Promise<void>((resolve) => {
      // Viewer
      const viewer = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      viewer.onmessage = (event) => {
        receivedUpdates.push(event.data as LocationBroadcast);
        
        if (receivedUpdates.length === 1) {
          const update = receivedUpdates[0];
          expect(update.currentWaypointIndex).toBe(2);
          expect(update.nextWaypointEta).toBe('18:15');
          viewer.close();
          broadcaster.close();
          resolve();
        }
      };
      
      // Broadcaster
      const broadcaster = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      
      // Send update with waypoint progress
      const locationWithProgress = createMockLocationBroadcast({
        routeId,
        currentWaypointIndex: 2,
        nextWaypointEta: '18:15',
      });
      
      broadcaster.postMessage(locationWithProgress);
    });
  });

  it('should isolate broadcasts by route ID', async () => {
    const route1Id = 'route-1';
    const route2Id = 'route-2';
    const route1Updates: LocationBroadcast[] = [];
    const route2Updates: LocationBroadcast[] = [];
    
    await new Promise<void>((resolve) => {
      // Viewer for route 1
      const viewer1 = new MockBroadcastChannel(`santa-tracking-${route1Id}`);
      viewer1.onmessage = (event) => {
        route1Updates.push(event.data as LocationBroadcast);
      };
      
      // Viewer for route 2
      const viewer2 = new MockBroadcastChannel(`santa-tracking-${route2Id}`);
      viewer2.onmessage = (event) => {
        route2Updates.push(event.data as LocationBroadcast);
        
        // Check isolation
        if (route1Updates.length === 1 && route2Updates.length === 1) {
          expect(route1Updates[0].routeId).toBe(route1Id);
          expect(route2Updates[0].routeId).toBe(route2Id);
          expect(route1Updates[0].location).toEqual([151.2093, -33.8688]);
          expect(route2Updates[0].location).toEqual([151.1957, -33.8567]);
          
          viewer1.close();
          viewer2.close();
          broadcaster1.close();
          broadcaster2.close();
          resolve();
        }
      };
      
      // Broadcaster for route 1
      const broadcaster1 = new MockBroadcastChannel(`santa-tracking-${route1Id}`);
      
      // Broadcaster for route 2
      const broadcaster2 = new MockBroadcastChannel(`santa-tracking-${route2Id}`);
      
      // Send updates to different routes
      const location1 = createMockLocationBroadcast({ 
        routeId: route1Id,
        location: [151.2093, -33.8688],
      });
      const location2 = createMockLocationBroadcast({ 
        routeId: route2Id,
        location: [151.1957, -33.8567],
      });
      
      broadcaster1.postMessage(location1);
      broadcaster2.postMessage(location2);
    });
  });

  it('should complete full real-time tracking flow', async () => {
    const routeId = 'full-flow-route';
    const viewerUpdates: LocationBroadcast[] = [];
    
    await new Promise<void>((resolve) => {
      // Step 1: Viewer connects to track route
      const viewer = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      viewer.onmessage = (event) => {
        viewerUpdates.push(event.data as LocationBroadcast);
        
        if (viewerUpdates.length === 3) {
          // Verify complete tracking history
          expect(viewerUpdates).toHaveLength(3);
          expect(viewerUpdates[0].currentWaypointIndex).toBe(0);
          expect(viewerUpdates[1].currentWaypointIndex).toBe(1);
          expect(viewerUpdates[2].currentWaypointIndex).toBe(2);
          expect(viewerUpdates.every(u => u.routeId === routeId)).toBe(true);
          
          viewer.close();
          broadcaster.close();
          resolve();
        }
      };
      
      // Step 2: Broadcaster starts navigation
      const broadcaster = new MockBroadcastChannel(`santa-tracking-${routeId}`);
      
      // Step 3: Broadcaster sends location at waypoint 0
      const location1 = createMockLocationBroadcast({
        routeId,
        location: [151.2093, -33.8688],
        currentWaypointIndex: 0,
        nextWaypointEta: '18:05',
      });
      
      broadcaster.postMessage(location1);
      
      // Step 4: Broadcaster moves to waypoint 1
      setTimeout(() => {
        const location2 = createMockLocationBroadcast({
          routeId,
          location: [151.2100, -33.8670],
          currentWaypointIndex: 1,
          nextWaypointEta: '18:10',
        });
        
        broadcaster.postMessage(location2);
        
        // Step 5: Broadcaster completes route
        setTimeout(() => {
          const location3 = createMockLocationBroadcast({
            routeId,
            location: [151.2110, -33.8650],
            currentWaypointIndex: 2,
          });
          
          broadcaster.postMessage(location3);
        }, 10);
      }, 10);
    });
  });
});
