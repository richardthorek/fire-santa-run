/**
 * Tests for useMediaSession hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaSession } from '../useMediaSession';

// ---------------------------------------------------------------------------
// Mock mediaSessionService
// ---------------------------------------------------------------------------

vi.mock('../../utils/mediaSession', () => ({
  mediaSessionService: {
    supported: vi.fn(() => true),
    initAudioFocus: vi.fn(),
    releaseAudioFocus: vi.fn(),
    updateMetadata: vi.fn(),
    setPlaybackState: vi.fn(),
    setActionHandlers: vi.fn(),
    clearActionHandlers: vi.fn(),
  },
}));

vi.mock('../../utils/voice', () => ({
  voiceService: {
    onSpeakStart: vi.fn(),
    onSpeakEnd: vi.fn(),
  },
}));

import { mediaSessionService } from '../../utils/mediaSession';
import { voiceService } from '../../utils/voice';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoute(overrides: Partial<{ name: string }> = {}) {
  return {
    id: 'route-1',
    brigadeId: 'brigade-1',
    name: overrides.name ?? 'Test Route',
    date: '2025-12-24',
    startTime: '18:00',
    status: 'active' as const,
    waypoints: [],
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function defaultOptions(
  overrides: Partial<Parameters<typeof useMediaSession>[0]> = {}
): Parameters<typeof useMediaSession>[0] {
  return {
    route: makeRoute(),
    currentInstruction: 'Turn left onto Main St',
    voiceEnabled: true,
    onToggleVoice: vi.fn(),
    onNextWaypoint: vi.fn(),
    isNavigating: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMediaSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // supported() must return true after clear so the hook's isSupported stays true
    (mediaSessionService.supported as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns isSupported=true when Media Session API is available', () => {
    const { result } = renderHook(() => useMediaSession(defaultOptions()));
    expect(result.current.isSupported).toBe(true);
  });

  it('returns isSupported=false when Media Session API is unavailable', () => {
    (mediaSessionService.supported as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { result } = renderHook(() => useMediaSession(defaultOptions()));
    expect(result.current.isSupported).toBe(false);
  });

  it('calls initAudioFocus when navigation starts', () => {
    renderHook(() => useMediaSession(defaultOptions({ isNavigating: true })));
    expect(mediaSessionService.initAudioFocus).toHaveBeenCalledTimes(1);
  });

  it('does not call initAudioFocus when not navigating', () => {
    renderHook(() => useMediaSession(defaultOptions({ isNavigating: false })));
    expect(mediaSessionService.initAudioFocus).not.toHaveBeenCalled();
  });

  it('sets initial metadata on mount', () => {
    renderHook(() =>
      useMediaSession(
        defaultOptions({ currentInstruction: 'Head north on Bridge St' })
      )
    );
    expect(mediaSessionService.updateMetadata).toHaveBeenCalledWith({
      routeName: 'Test Route',
      currentInstruction: 'Head north on Bridge St',
    });
  });

  it('sets playback state to "playing" when voice is enabled', () => {
    renderHook(() => useMediaSession(defaultOptions({ voiceEnabled: true })));
    expect(mediaSessionService.setPlaybackState).toHaveBeenCalledWith('playing');
  });

  it('sets playback state to "paused" when voice is disabled', () => {
    renderHook(() => useMediaSession(defaultOptions({ voiceEnabled: false })));
    expect(mediaSessionService.setPlaybackState).toHaveBeenCalledWith('paused');
  });

  it('registers action handlers when navigating', () => {
    renderHook(() => useMediaSession(defaultOptions()));
    expect(mediaSessionService.setActionHandlers).toHaveBeenCalled();
  });

  it('passes onNextWaypoint to the nexttrack handler', () => {
    const onNextWaypoint = vi.fn();
    renderHook(() => useMediaSession(defaultOptions({ onNextWaypoint })));

    const callArgs = (
      mediaSessionService.setActionHandlers as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(callArgs.onNextTrack).toBe(onNextWaypoint);
  });

  it('passes null as previoustrack handler when no callback provided', () => {
    renderHook(() =>
      useMediaSession(defaultOptions({ onPreviousWaypoint: undefined }))
    );
    const callArgs = (
      mediaSessionService.setActionHandlers as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(callArgs.onPreviousTrack).toBeNull();
  });

  it('passes onPreviousWaypoint to the previoustrack handler when provided', () => {
    const onPreviousWaypoint = vi.fn();
    renderHook(() =>
      useMediaSession(defaultOptions({ onPreviousWaypoint }))
    );
    const callArgs = (
      mediaSessionService.setActionHandlers as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(callArgs.onPreviousTrack).toBe(onPreviousWaypoint);
  });

  it('updates metadata when instruction changes', () => {
    const { rerender } = renderHook(
      (opts: Parameters<typeof useMediaSession>[0]) => useMediaSession(opts),
      { initialProps: defaultOptions({ currentInstruction: 'Turn left' }) }
    );

    vi.clearAllMocks();
    (mediaSessionService.supported as ReturnType<typeof vi.fn>).mockReturnValue(true);

    act(() => {
      rerender(defaultOptions({ currentInstruction: 'Turn right' }));
    });

    expect(mediaSessionService.updateMetadata).toHaveBeenCalledWith({
      routeName: 'Test Route',
      currentInstruction: 'Turn right',
    });
  });

  it('does not re-update metadata when instruction is unchanged', () => {
    const { rerender } = renderHook(
      (opts: Parameters<typeof useMediaSession>[0]) => useMediaSession(opts),
      { initialProps: defaultOptions({ currentInstruction: 'Turn left' }) }
    );

    vi.clearAllMocks();
    (mediaSessionService.supported as ReturnType<typeof vi.fn>).mockReturnValue(true);

    act(() => {
      rerender(defaultOptions({ currentInstruction: 'Turn left' }));
    });

    expect(mediaSessionService.updateMetadata).not.toHaveBeenCalled();
  });

  it('clears action handlers and releases audio focus on unmount', () => {
    const { unmount } = renderHook(() => useMediaSession(defaultOptions()));

    vi.clearAllMocks();
    (mediaSessionService.supported as ReturnType<typeof vi.fn>).mockReturnValue(true);

    act(() => {
      unmount();
    });

    expect(mediaSessionService.clearActionHandlers).toHaveBeenCalledTimes(1);
    expect(mediaSessionService.releaseAudioFocus).toHaveBeenCalledTimes(1);
  });

  it('registers voiceService speak callbacks when navigating', () => {
    renderHook(() => useMediaSession(defaultOptions()));
    expect(voiceService.onSpeakStart).toHaveBeenCalled();
    expect(voiceService.onSpeakEnd).toHaveBeenCalled();
  });

  it('play handler enables voice when currently disabled', () => {
    const onToggleVoice = vi.fn();
    renderHook(() =>
      useMediaSession(defaultOptions({ voiceEnabled: false, onToggleVoice }))
    );

    const callArgs = (
      mediaSessionService.setActionHandlers as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];

    act(() => {
      callArgs.onPlay();
    });

    expect(onToggleVoice).toHaveBeenCalledTimes(1);
  });

  it('play handler does nothing when voice is already enabled', () => {
    const onToggleVoice = vi.fn();
    renderHook(() =>
      useMediaSession(defaultOptions({ voiceEnabled: true, onToggleVoice }))
    );

    const callArgs = (
      mediaSessionService.setActionHandlers as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];

    act(() => {
      callArgs.onPlay();
    });

    expect(onToggleVoice).not.toHaveBeenCalled();
  });

  it('pause handler disables voice when currently enabled', () => {
    const onToggleVoice = vi.fn();
    renderHook(() =>
      useMediaSession(defaultOptions({ voiceEnabled: true, onToggleVoice }))
    );

    const callArgs = (
      mediaSessionService.setActionHandlers as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];

    act(() => {
      callArgs.onPause();
    });

    expect(onToggleVoice).toHaveBeenCalledTimes(1);
  });
});
