/**
 * Integration Test Utilities
 * Shared mocks, helpers, and setup for integration tests
 */

import { vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import React from 'react';
import type { Route, Waypoint, LocationBroadcast } from '../../types';

/**
 * Mock Mapbox GL JS
 */
export const mockMapboxGL = () => {
  const mockMap = {
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'load') {
        setTimeout(handler, 0);
      }
      return mockMap;
    }),
    remove: vi.fn(),
    addControl: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getLayer: vi.fn(),
    getSource: vi.fn(),
    fitBounds: vi.fn(),
    getBounds: vi.fn(() => ({
      toArray: () => [[-180, -90], [180, 90]],
    })),
    getCanvas: vi.fn(() => ({
      style: { cursor: '' },
    })),
  };

  vi.mock('mapbox-gl', () => ({
    default: {
      Map: vi.fn(() => mockMap),
      Marker: vi.fn(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      LngLatBounds: vi.fn(() => ({
        extend: vi.fn().mockReturnThis(),
        isEmpty: vi.fn(() => false),
      })),
      accessToken: '',
    },
  }));

  return mockMap;
};

/**
 * Mock Mapbox Directions API
 */
export const mockDirectionsAPI = () => {
  const mockRoute = {
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [151.2093, -33.8688], // Sydney coords
        [151.2100, -33.8690],
      ],
    },
    distance: 1234.5,
    duration: 300,
    legs: [
      {
        steps: [
          {
            maneuver: {
              type: 'depart',
              instruction: 'Head north',
              location: [151.2093, -33.8688],
            },
            distance: 500,
            duration: 120,
            geometry: {
              type: 'LineString' as const,
              coordinates: [[151.2093, -33.8688], [151.2095, -33.8680]],
            },
          },
          {
            maneuver: {
              type: 'turn',
              modifier: 'left',
              instruction: 'Turn left onto George Street',
              location: [151.2095, -33.8680],
            },
            distance: 734.5,
            duration: 180,
            geometry: {
              type: 'LineString' as const,
              coordinates: [[151.2095, -33.8680], [151.2100, -33.8690]],
            },
          },
        ],
      },
    ],
  };

  global.fetch = vi.fn((url: string) => {
    if (typeof url === 'string' && url.includes('mapbox.com/directions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          routes: [mockRoute],
          code: 'Ok',
        }),
      } as Response);
    }
    if (typeof url === 'string' && url.includes('mapbox.com/geocoding')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          features: [{
            place_name: 'Test Address, Sydney NSW',
            center: [151.2093, -33.8688],
          }],
        }),
      } as Response);
    }
    return Promise.reject(new Error('Unknown URL'));
  });
};

/**
 * Mock Geolocation API
 */
export class MockGeolocation {
  private watchId = 0;
  private watchers: Map<number, PositionCallback> = new Map();

  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback
  ): void {
    const position = this.createMockPosition();
    setTimeout(() => success(position), 10);
  }

  watchPosition(
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions
  ): number {
    const id = ++this.watchId;
    this.watchers.set(id, success);
    
    // Send initial position
    const position = this.createMockPosition();
    setTimeout(() => success(position), 10);
    
    return id;
  }

  clearWatch(id: number): void {
    this.watchers.delete(id);
  }

  // Test helper to simulate location updates
  updatePosition(coords: Partial<GeolocationCoordinates>): void {
    const position = this.createMockPosition(coords);
    this.watchers.forEach(callback => callback(position));
  }

  private createMockPosition(coords?: Partial<GeolocationCoordinates>): GeolocationPosition {
    return {
      coords: {
        latitude: coords?.latitude ?? -33.8688,
        longitude: coords?.longitude ?? 151.2093,
        accuracy: coords?.accuracy ?? 10,
        altitude: coords?.altitude ?? null,
        altitudeAccuracy: coords?.altitudeAccuracy ?? null,
        heading: coords?.heading ?? null,
        speed: coords?.speed ?? null,
      },
      timestamp: Date.now(),
    };
  }
}

/**
 * Mock BroadcastChannel for real-time tracking tests
 */
export class MockBroadcastChannel {
  private static channels: Map<string, MockBroadcastChannel[]> = new Map();
  public name: string;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    
    // Register this channel
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  postMessage(data: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    
    // Broadcast to all other channels with the same name
    channels.forEach(channel => {
      if (channel !== this && channel.onmessage) {
        const event = new MessageEvent('message', { data });
        setTimeout(() => channel.onmessage?.(event), 0);
      }
    });
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    const index = channels.indexOf(this);
    if (index > -1) {
      channels.splice(index, 1);
    }
  }

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }
}

/**
 * Create mock route data
 */
export const createMockRoute = (overrides?: Partial<Route>): Route => ({
  id: 'test-route-123',
  brigadeId: 'test-brigade',
  name: 'Test Santa Run 2024',
  description: 'Annual Christmas Eve route',
  date: '2024-12-24',
  startTime: '18:00',
  status: 'draft',
  waypoints: [],
  createdAt: new Date().toISOString(),
  createdBy: 'test-user',
  ...overrides,
});

/**
 * Create mock waypoint data
 */
export const createMockWaypoint = (order: number, overrides?: Partial<Waypoint>): Waypoint => ({
  id: `waypoint-${order}`,
  coordinates: [151.2093 + (order * 0.001), -33.8688 - (order * 0.001)],
  address: `${order} Test Street, Sydney NSW`,
  name: `Stop ${order}`,
  order,
  isCompleted: false,
  ...overrides,
});

/**
 * Create mock location broadcast
 */
export const createMockLocationBroadcast = (overrides?: Partial<LocationBroadcast>): LocationBroadcast => ({
  routeId: 'test-route-123',
  location: [151.2093, -33.8688],
  timestamp: Date.now(),
  heading: 45,
  speed: 10,
  currentWaypointIndex: 0,
  ...overrides,
});

/**
 * Mock Auth Provider for tests
 */
export const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

/**
 * Mock Brigade Provider for tests
 */
export const MockBrigadeProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

/**
 * Render component with router and context providers
 */
export const renderWithRouter = (ui: ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

/**
 * Render hook with required context providers
 */
export const renderHookWithProviders = <TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: { initialProps?: TProps }
) => {
  return renderHook(hook, {
    ...options,
    wrapper: ({ children }) => (
      <MockAuthProvider>
        <MockBrigadeProvider>
          {children}
        </MockBrigadeProvider>
      </MockAuthProvider>
    ),
  });
};

/**
 * Wait for async operations
 */
export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));
