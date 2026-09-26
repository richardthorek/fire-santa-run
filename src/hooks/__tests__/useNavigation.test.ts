/**
 * Tests for useNavigation — off-route debounce and rate-limited auto-reroute.
 *
 * Uses a mocked useGeolocation so each GPS "tick" is driven explicitly by
 * feeding a fresh position object and re-rendering, with fake timers standing
 * in for real elapsed time.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigation } from '../useNavigation';
import type { GeolocationCoordinates } from '../useGeolocation';
import type { Route } from '../../types';

vi.mock('../useGeolocation', () => ({
  useGeolocation: vi.fn(),
}));

vi.mock('../../utils/mapbox', () => ({
  getDirections: vi.fn(),
}));

import { useGeolocation } from '../useGeolocation';
import { getDirections } from '../../utils/mapbox';

const mockUseGeolocation = vi.mocked(useGeolocation);
const mockGetDirections = vi.mocked(getDirections);

// A straight, ~560m east-west route with two navigation steps, so
// findCurrentStep/projectOntoRoute have real geometry to work with. The
// waypoint sits at the far end, well beyond the arrival radius from the
// "on route" and "off route" test positions below, so it never auto-completes
// and doesn't interfere with the off-route assertions.
function buildRoute(): Route {
  return {
    id: 'route-1',
    brigadeId: 'brigade-1',
    name: 'Test Run',
    date: '2026-12-24',
    startTime: '18:00',
    status: 'published',
    createdAt: new Date().toISOString(),
    waypoints: [
      { id: 'wp-1', coordinates: [151.2060, -33.8688], order: 0, isCompleted: false },
    ],
    geometry: {
      type: 'LineString',
      coordinates: [
        [151.2000, -33.8688],
        [151.2030, -33.8688],
        [151.2060, -33.8688],
      ],
    },
    navigationSteps: [
      {
        instruction: 'Head east',
        distance: 300,
        duration: 60,
        geometry: { type: 'LineString', coordinates: [[151.2000, -33.8688], [151.2030, -33.8688]] },
        maneuver: { type: 'depart', location: [151.2000, -33.8688] },
      },
      {
        instruction: 'Arrive at destination',
        distance: 0,
        duration: 0,
        geometry: { type: 'LineString', coordinates: [[151.2060, -33.8688]] },
        maneuver: { type: 'arrive', location: [151.2060, -33.8688] },
      },
    ],
  };
}

function makePosition(coordinates: [number, number]): GeolocationCoordinates {
  return {
    coordinates,
    accuracy: 5,
    heading: null,
    speed: null,
    timestamp: Date.now(),
  };
}

const ON_ROUTE: [number, number] = [151.2015, -33.8688];
// ~0.0009 deg north of the route (~85m at this latitude) — past the 60m
// "enter off-route" threshold.
const OFF_ROUTE: [number, number] = [151.2015, -33.8697];

function setGeolocation(coordinates: [number, number], overrides: Partial<GeolocationCoordinates> = {}) {
  mockUseGeolocation.mockReturnValue({
    position: { ...makePosition(coordinates), ...overrides },
    error: null,
    isLoading: false,
    permission: 'granted',
    getCurrentPosition: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  });
}

describe('useNavigation — off-route debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetDirections.mockResolvedValue({
      geometry: { type: 'LineString', coordinates: [[151.2015, -33.8697], [151.2060, -33.8688]] },
      distance: 500,
      duration: 120,
      steps: [
        {
          instruction: 'Rejoin the route',
          distance: 500,
          duration: 120,
          geometry: { type: 'LineString', coordinates: [[151.2015, -33.8697], [151.2060, -33.8688]] },
          maneuver: { type: 'arrive', location: [151.2060, -33.8688] },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not flag off-route on a single fix beyond the threshold', () => {
    const route = buildRoute();
    setGeolocation(ON_ROUTE);
    const { result, rerender } = renderHook(() => useNavigation({ route, voiceEnabled: false }));

    act(() => {
      result.current.startNavigation();
    });

    setGeolocation(OFF_ROUTE);
    act(() => {
      rerender();
    });

    expect(result.current.navigationState.isOffRoute).toBe(false);
  });

  it('flags off-route after 3 consecutive fixes beyond the threshold', () => {
    const route = buildRoute();
    setGeolocation(ON_ROUTE);
    const { result, rerender } = renderHook(() => useNavigation({ route, voiceEnabled: false }));

    act(() => {
      result.current.startNavigation();
    });

    for (let i = 0; i < 3; i++) {
      setGeolocation(OFF_ROUTE);
      act(() => {
        rerender();
      });
    }

    expect(result.current.navigationState.isOffRoute).toBe(true);
    expect(result.current.navigationState.showOffRouteBanner).toBe(true);
  });

  it('flags off-route after ~8s continuously off, even with fewer than 3 fixes', () => {
    const route = buildRoute();
    setGeolocation(ON_ROUTE);
    const { result, rerender } = renderHook(() => useNavigation({ route, voiceEnabled: false }));

    act(() => {
      result.current.startNavigation();
    });

    setGeolocation(OFF_ROUTE);
    act(() => {
      rerender();
    });
    expect(result.current.navigationState.isOffRoute).toBe(false);

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    // Second off-route fix, 9s after the first — still only 2 consecutive
    // fixes, but past the 8s debounce window.
    setGeolocation(OFF_ROUTE);
    act(() => {
      rerender();
    });

    expect(result.current.navigationState.isOffRoute).toBe(true);
  });

  it('clears as soon as a fix comes back within the clear threshold', () => {
    const route = buildRoute();
    setGeolocation(ON_ROUTE);
    const { result, rerender } = renderHook(() => useNavigation({ route, voiceEnabled: false }));

    act(() => {
      result.current.startNavigation();
    });

    for (let i = 0; i < 3; i++) {
      setGeolocation(OFF_ROUTE);
      act(() => {
        rerender();
      });
    }
    expect(result.current.navigationState.isOffRoute).toBe(true);

    setGeolocation(ON_ROUTE);
    act(() => {
      rerender();
    });

    expect(result.current.navigationState.isOffRoute).toBe(false);
  });

  it('dismissing the banner hides it, and it auto-resets once back on route', () => {
    const route = buildRoute();
    setGeolocation(ON_ROUTE);
    const { result, rerender } = renderHook(() => useNavigation({ route, voiceEnabled: false }));

    act(() => {
      result.current.startNavigation();
    });

    for (let i = 0; i < 3; i++) {
      setGeolocation(OFF_ROUTE);
      act(() => {
        rerender();
      });
    }
    expect(result.current.navigationState.showOffRouteBanner).toBe(true);

    act(() => {
      result.current.dismissOffRouteBanner();
    });
    expect(result.current.navigationState.showOffRouteBanner).toBe(false);
    // Still off-route, just hidden.
    expect(result.current.navigationState.isOffRoute).toBe(true);

    setGeolocation(ON_ROUTE);
    act(() => {
      rerender();
    });
    expect(result.current.navigationState.isOffRoute).toBe(false);

    // Dismissal auto-reset: going off-route again should show the banner
    // without needing dismissOffRouteBanner to be called again.
    for (let i = 0; i < 3; i++) {
      setGeolocation(OFF_ROUTE);
      act(() => {
        rerender();
      });
    }
    expect(result.current.navigationState.showOffRouteBanner).toBe(true);
  });

  it('auto-reroutes after ~15s confirmed off-route, and rate-limits further reroutes', async () => {
    const route = buildRoute();
    setGeolocation(ON_ROUTE);
    const { result, rerender } = renderHook(() => useNavigation({ route, voiceEnabled: false }));

    act(() => {
      result.current.startNavigation();
    });

    // Confirm off-route via 3 consecutive fixes.
    for (let i = 0; i < 3; i++) {
      setGeolocation(OFF_ROUTE);
      act(() => {
        rerender();
      });
    }
    expect(result.current.navigationState.isOffRoute).toBe(true);
    expect(mockGetDirections).not.toHaveBeenCalled();

    // Advance past the 15s auto-reroute delay, feeding more off-route fixes
    // (each render's effect checks the clock).
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        vi.advanceTimersByTime(4_000);
      });
      setGeolocation(OFF_ROUTE);
      await act(async () => {
        rerender();
        await vi.runOnlyPendingTimersAsync();
      });
    }

    expect(mockGetDirections).toHaveBeenCalledTimes(1);
  });
});
