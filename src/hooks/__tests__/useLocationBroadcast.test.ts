/**
 * Tests for useLocationBroadcast hook
 *
 * Verifies that:
 * - Location broadcasts are sent during active navigation
 * - Broadcasts are throttled to BROADCAST_INTERVAL_MS
 * - Broadcasts are attempted even when offline (WebPubSub not connected)
 *   so the service worker can queue them via BackgroundSync
 * - No broadcasts are sent when not navigating or position is null
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocationBroadcast } from '../useLocationBroadcast';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockSendLocation = vi.fn();
const mockDisconnect = vi.fn();
const mockConnect = vi.fn();

// Default: WebPubSub appears connected
let mockIsConnected = true;

vi.mock('../useWebPubSub', () => ({
  useWebPubSub: () => ({
    isConnected: mockIsConnected,
    isConnecting: false,
    error: null,
    viewerCount: null,
    sendLocation: mockSendLocation,
    disconnect: mockDisconnect,
    connect: mockConnect,
  }),
}));

// Default: device is online
let mockIsOnline = true;

vi.mock('../useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE_ID = 'route-123';

function makePosition(lng = 151.2093, lat = -33.8688) {
  return {
    coordinates: [lng, lat] as [number, number],
    timestamp: Date.now(),
    heading: null,
    speed: null,
    accuracy: 10,
  };
}

const routeProgress = {
  currentWaypointIndex: 0,
  completedWaypoints: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLocationBroadcast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIsConnected = true;
    mockIsOnline = true;
    mockSendLocation.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends a location broadcast when navigating with a known position', () => {
    const position = makePosition();

    renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position,
        routeProgress,
        isNavigating: true,
      })
    );

    expect(mockSendLocation).toHaveBeenCalledTimes(1);
    expect(mockSendLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: ROUTE_ID,
        location: position.coordinates,
        timestamp: position.timestamp,
      })
    );
  });

  it('does not send a broadcast when isNavigating is false', () => {
    renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: makePosition(),
        routeProgress,
        isNavigating: false,
      })
    );

    expect(mockSendLocation).not.toHaveBeenCalled();
  });

  it('does not send a broadcast when position is null', () => {
    renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: null,
        routeProgress,
        isNavigating: true,
      })
    );

    expect(mockSendLocation).not.toHaveBeenCalled();
  });

  it('sends a broadcast even when the WebPubSub connection is down (offline queuing)', () => {
    // Simulate being disconnected from WebPubSub (e.g., negotiate failed while offline)
    mockIsConnected = false;

    renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: makePosition(),
        routeProgress,
        isNavigating: true,
      })
    );

    // The broadcast should still be attempted so the service worker can queue it
    expect(mockSendLocation).toHaveBeenCalledTimes(1);
  });

  it('sends a broadcast even when the device is offline (isOnline false)', () => {
    mockIsOnline = false;

    renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: makePosition(),
        routeProgress,
        isNavigating: true,
      })
    );

    // Broadcast still attempted; service worker will queue via BackgroundSync
    expect(mockSendLocation).toHaveBeenCalledTimes(1);
  });

  it('throttles broadcasts to the 5-second interval', () => {
    const { rerender } = renderHook(
      ({ position }: { position: ReturnType<typeof makePosition> }) =>
        useLocationBroadcast({
          routeId: ROUTE_ID,
          position,
          routeProgress,
          isNavigating: true,
        }),
      { initialProps: { position: makePosition() } }
    );

    expect(mockSendLocation).toHaveBeenCalledTimes(1);

    // Re-render with a new position before the throttle window expires
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ position: makePosition(151.21, -33.87) });
    expect(mockSendLocation).toHaveBeenCalledTimes(1); // still throttled

    // Advance past the throttle window
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    rerender({ position: makePosition(151.22, -33.86) });
    expect(mockSendLocation).toHaveBeenCalledTimes(2);
  });

  it('returns isConnected and isOnline', () => {
    mockIsConnected = true;
    mockIsOnline = true;

    const { result } = renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: makePosition(),
        routeProgress,
        isNavigating: true,
      })
    );

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isOnline).toBe(true);
  });

  it('reflects offline status via isOnline return value', () => {
    mockIsOnline = false;

    const { result } = renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: makePosition(),
        routeProgress,
        isNavigating: true,
      })
    );

    expect(result.current.isOnline).toBe(false);
  });

  it('includes nextWaypointEta in the broadcast when provided', () => {
    const ETA = '10:30 AM';

    renderHook(() =>
      useLocationBroadcast({
        routeId: ROUTE_ID,
        position: makePosition(),
        routeProgress,
        isNavigating: true,
        nextWaypointEta: ETA,
      })
    );

    expect(mockSendLocation).toHaveBeenCalledWith(
      expect.objectContaining({ nextWaypointEta: ETA })
    );
  });
});
