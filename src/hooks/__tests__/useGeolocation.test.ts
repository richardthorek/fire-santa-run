/**
 * Tests for useGeolocation hook — background tracking behaviour
 *
 * Verifies that:
 * - backgroundTracking switches to interval-based polling when the page is hidden
 * - watchPosition is resumed when the page becomes visible again
 * - the background interval is cleaned up on unmount
 * - backgroundTracking has no effect when watch is false
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation, BACKGROUND_TRACKING_INTERVAL_MS } from '../useGeolocation';

// ---------------------------------------------------------------------------
// Mock the Geolocation API
// ---------------------------------------------------------------------------

const mockWatchPosition = vi.fn();
const mockClearWatch = vi.fn();
const mockGetCurrentPosition = vi.fn();

function installGeolocationMock() {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      watchPosition: mockWatchPosition,
      clearWatch: mockClearWatch,
      getCurrentPosition: mockGetCurrentPosition,
    },
    writable: true,
    configurable: true,
  });
}

function installPermissionsMock(state: PermissionState = 'granted') {
  Object.defineProperty(navigator, 'permissions', {
    value: {
      query: vi.fn().mockResolvedValue({
        state,
        addEventListener: vi.fn(),
      }),
    },
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireVisibilityChange(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    writable: true,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGeolocation — background tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWatchPosition.mockReturnValue(42); // mock watch ID
    mockGetCurrentPosition.mockImplementation(() => {}); // no-op by default
    mockClearWatch.mockReset();
    installGeolocationMock();
    installPermissionsMock();

    // Reset visibilityState to 'visible'
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts watchPosition when watch=true and page is visible', () => {
    renderHook(() => useGeolocation({ watch: true, backgroundTracking: true }));
    expect(mockWatchPosition).toHaveBeenCalledTimes(1);
  });

  it('switches to interval polling when the page is hidden', () => {
    renderHook(() => useGeolocation({ watch: true, backgroundTracking: true }));

    // Page goes to background
    act(() => {
      fireVisibilityChange('hidden');
    });

    // watchPosition should have been cleared
    expect(mockClearWatch).toHaveBeenCalledWith(42);

    // Advance time by one interval — getCurrentPosition should fire once
    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS);
    });
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

    // Another interval
    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS);
    });
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('resumes watchPosition when the page becomes visible again', () => {
    renderHook(() => useGeolocation({ watch: true, backgroundTracking: true }));

    act(() => {
      fireVisibilityChange('hidden');
    });

    // Advance a bit while hidden
    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS);
    });

    // Page comes back to foreground
    act(() => {
      fireVisibilityChange('visible');
    });

    // watchPosition should be called again (once on mount + once on resume)
    expect(mockWatchPosition).toHaveBeenCalledTimes(2);

    // No more background polling after coming back to foreground
    const callsBeforeAdvance = mockGetCurrentPosition.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS);
    });
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(callsBeforeAdvance);
  });

  it('cleans up the background interval on unmount', () => {
    const { unmount } = renderHook(() =>
      useGeolocation({ watch: true, backgroundTracking: true })
    );

    act(() => {
      fireVisibilityChange('hidden');
    });

    unmount();

    // No further polling after unmount
    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS * 3);
    });
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('does NOT switch to interval polling when backgroundTracking is false', () => {
    renderHook(() => useGeolocation({ watch: true, backgroundTracking: false }));

    act(() => {
      fireVisibilityChange('hidden');
    });

    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS);
    });

    // clearWatch should NOT have been called (standard watch continues)
    expect(mockClearWatch).not.toHaveBeenCalled();
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('does NOT start background polling when watch is false', () => {
    renderHook(() => useGeolocation({ watch: false, backgroundTracking: true }));

    // Reset call count — the hook calls getCurrentPosition once for the initial
    // one-time position lookup, which is expected and unrelated to background tracking.
    mockGetCurrentPosition.mockClear();

    act(() => {
      fireVisibilityChange('hidden');
    });

    act(() => {
      vi.advanceTimersByTime(BACKGROUND_TRACKING_INTERVAL_MS);
    });

    // No interval-based background polling should have started
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });
});
