/**
 * React hook for Media Session API integration
 *
 * Registers the navigation session as an OS media player so that:
 * - The lock screen / notification shade shows the current route and instruction
 * - Hardware/software media buttons control voice (Play/Pause) and waypoints
 *   (Next/Previous)
 * - Audio focus is claimed, enabling the OS to duck other media automatically
 *   during voice announcements
 */

import { useEffect, useRef, useCallback } from 'react';
import { mediaSessionService } from '../utils/mediaSession';
import { voiceService } from '../utils/voice';
import type { Route } from '../types';

export interface UseMediaSessionOptions {
  /** The current route being navigated. */
  route: Route;
  /** The instruction currently displayed in the navigation header. */
  currentInstruction: string;
  /** Whether voice announcements are currently enabled. */
  voiceEnabled: boolean;
  /** Toggle voice on/off (called by Play and Pause lock-screen buttons). */
  onToggleVoice: () => void;
  /** Skip to the next waypoint (called by the Next Track lock-screen button). */
  onNextWaypoint: () => void;
  /** Skip back to the previous waypoint, if provided. */
  onPreviousWaypoint?: () => void;
  /** Whether navigation is active. The session is created/destroyed accordingly. */
  isNavigating: boolean;
}

export function useMediaSession({
  route,
  currentInstruction,
  voiceEnabled,
  onToggleVoice,
  onNextWaypoint,
  onPreviousWaypoint,
  isNavigating,
}: UseMediaSessionOptions) {
  const prevInstructionRef = useRef<string>('');
  const isSupported = mediaSessionService.supported();

  // --- Stable action handler callbacks ---

  const handlePlay = useCallback(() => {
    if (!voiceEnabled) {
      onToggleVoice();
    }
  }, [voiceEnabled, onToggleVoice]);

  const handlePause = useCallback(() => {
    if (voiceEnabled) {
      onToggleVoice();
    }
  }, [voiceEnabled, onToggleVoice]);

  // --- Initialise / tear down the media session with navigation lifecycle ---

  useEffect(() => {
    if (!isNavigating || !isSupported) return;

    // Claim audio focus (requires a prior user gesture; NavigationView starts
    // navigation from a button press, satisfying autoplay policy).
    mediaSessionService.initAudioFocus();

    mediaSessionService.updateMetadata({
      routeName: route.name,
      currentInstruction: currentInstruction || 'Navigation Active',
    });
    mediaSessionService.setPlaybackState(voiceEnabled ? 'playing' : 'paused');
    prevInstructionRef.current = currentInstruction;

    return () => {
      mediaSessionService.clearActionHandlers();
      mediaSessionService.releaseAudioFocus();
    };
    // Only re-run when navigation starts/stops to avoid redundant teardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, isSupported]);

  // --- Keep lock-screen metadata in sync with the current instruction ---

  useEffect(() => {
    if (!isNavigating || !isSupported) return;
    if (!currentInstruction || currentInstruction === prevInstructionRef.current) return;

    mediaSessionService.updateMetadata({
      routeName: route.name,
      currentInstruction,
    });
    prevInstructionRef.current = currentInstruction;
  }, [isNavigating, isSupported, route.name, currentInstruction]);

  // --- Keep playback state in sync with voice enabled flag ---

  useEffect(() => {
    if (!isNavigating || !isSupported) return;
    mediaSessionService.setPlaybackState(voiceEnabled ? 'playing' : 'paused');
  }, [isNavigating, isSupported, voiceEnabled]);

  // --- Re-register action handlers when callbacks change ---

  useEffect(() => {
    if (!isNavigating || !isSupported) return;

    mediaSessionService.setActionHandlers({
      onPlay: handlePlay,
      onPause: handlePause,
      onNextTrack: onNextWaypoint,
      onPreviousTrack: onPreviousWaypoint ?? null,
    });
  }, [isNavigating, isSupported, handlePlay, handlePause, onNextWaypoint, onPreviousWaypoint]);

  // --- Audio ducking: set playback state while voice is speaking ---

  useEffect(() => {
    if (!isNavigating || !isSupported) return;

    // Temporarily mark playback state as 'playing' when the synthesiser speaks
    // so the OS knows to duck other media. Revert to user's preferred state when
    // speech ends and the queue is drained.
    const handleSpeakStart = () => {
      mediaSessionService.setPlaybackState('playing');
    };

    const handleSpeakEnd = () => {
      // Reflect the actual voice-enabled state once speech finishes
      mediaSessionService.setPlaybackState(voiceEnabled ? 'playing' : 'paused');
    };

    voiceService.onSpeakStart(handleSpeakStart);
    voiceService.onSpeakEnd(handleSpeakEnd);

    return () => {
      // Pass null to unregister; avoids leaving stale closures in the service
      voiceService.onSpeakStart(null);
      voiceService.onSpeakEnd(null);
    };
  }, [isNavigating, isSupported, voiceEnabled]);

  return { isSupported };
}
