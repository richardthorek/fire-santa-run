/**
 * Custom hook for managing turn-by-turn navigation state
 * Handles location tracking, instruction updates, rerouting, and waypoint completion
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGeolocation } from './useGeolocation';
import type { Route, Waypoint } from '../types';
import {
  findCurrentStep,
  findNextWaypoint,
  calculateRouteProgress,
  isOffRoute,
  calculateETA,
  formatETA,
  isNearWaypoint,
  calculateDistance,
} from '../utils/navigation';
import {
  voiceService,
  formatInstructionForVoice,
  announceWaypointArrival,
  announceOffRoute,
  announceRouteComplete,
} from '../utils/voice';
import { getDirections } from '../utils/mapbox';
import { calculateRealTimeETAs } from '../utils/routeHelpers';

/**
 * Radius (metres) within which the navigator is considered "arrived" at a stop
 * and it auto-completes. Phone GPS under tree cover / near buildings drifts
 * 20–40m, and stop pins often sit on a house set back from the road, so 50m was
 * too tight to fire reliably. The manual "Skip to next stop" control is the
 * fallback when it still doesn't.
 */
const WAYPOINT_ARRIVAL_RADIUS_M = 75;

export interface NavigationState {
  isNavigating: boolean;
  currentStepIndex: number;
  currentInstruction: string;
  distanceToNextManeuver: number;
  nextWaypoint: Waypoint | null;
  distanceToNextWaypoint: number;
  etaToNextWaypoint: string | null;
  /** Minutes ahead (positive) or behind (negative) the planned schedule. Null until a waypoint with both estimatedArrival and actualArrival exists. */
  scheduleVarianceMinutes: number | null;
  routeProgress: number;
  isOffRoute: boolean;
  isRerouting: boolean;
  completedWaypointIds: string[];
  showOffRouteBanner: boolean;
  rerouteCount: number;
}

export interface UseNavigationOptions {
  route: Route;
  onRouteComplete?: (rerouteCount: number) => void;
  onWaypointComplete?: (waypoint: Waypoint) => void;
  voiceEnabled?: boolean;
  /** Gates the underlying geolocation watch. iOS Safari silently denies
   *  location requests that aren't triggered by a direct user gesture (no
   *  native prompt, just an immediate PERMISSION_DENIED) — so callers should
   *  default this to false and only flip it true from a tap handler. */
  locationEnabled?: boolean;
}

export function useNavigation({ route, onRouteComplete, onWaypointComplete, voiceEnabled = true, locationEnabled = true }: UseNavigationOptions) {
  const { position, error: locationError, permission } = useGeolocation({
    watch: locationEnabled,
    enableHighAccuracy: true,
    backgroundTracking: true,
  });

  const [isNavigating, setIsNavigating] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [completedWaypointIds, setCompletedWaypointIds] = useState<string[]>([]);
  const [updatedRoute, setUpdatedRoute] = useState<Route>(route);
  const [rerouteCount, setRerouteCount] = useState(0);
  
  // Per-step voice de-duplication: a step gets at most one "approach"
  // announcement (spoken once when first within range) and one "now"
  // announcement (within ~40m). Sets rather than a single "last step" marker so
  // GPS jitter that flips findCurrentStep between adjacent steps can't re-trigger
  // an announcement. Cleared on start and after a reroute (steps change).
  const announcedApproachStepsRef = useRef<Set<number>>(new Set());
  const announcedImminentStepsRef = useRef<Set<number>>(new Set());
  const lastAnnouncedWaypointRef = useRef<string | null>(null);
  const hasAnnouncedOffRouteRef = useRef(false);
  const rerouteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointCompletionQueueRef = useRef<Set<string>>(new Set());
  // Frozen plan-time estimated arrival per waypoint id, captured at navigation
  // start. The live ETA recalc overwrites waypoint.estimatedArrival, so the
  // schedule-variance indicator must compare against this immutable baseline.
  // Held in state (not a ref) so it can be read safely during render.
  const [plannedArrivals, setPlannedArrivals] = useState<Map<string, string>>(new Map());

  // Configure voice settings
  useEffect(() => {
    voiceService.updateSettings({ 
      enabled: voiceEnabled,
      language: 'en-AU' 
    });
  }, [voiceEnabled]);

  // Calculate navigation state from position (derived state, no setState in effect)
  const navigationState = useMemo<NavigationState>(() => {
    if (!isNavigating || !position || !updatedRoute.geometry || !updatedRoute.navigationSteps) {
      return {
        isNavigating,
        currentStepIndex: 0,
        currentInstruction: '',
        distanceToNextManeuver: 0,
        nextWaypoint: null,
        distanceToNextWaypoint: 0,
        etaToNextWaypoint: null,
        scheduleVarianceMinutes: null,
        routeProgress: 0,
        isOffRoute: false,
        isRerouting,
        completedWaypointIds,
        showOffRouteBanner: false,
        rerouteCount,
      };
    }

    const steps = updatedRoute.navigationSteps;
    const userLocation = position.coordinates;

    // Find current step
    const { stepIndex, distanceToManeuver } = findCurrentStep(userLocation, steps);
    const currentStep = steps[stepIndex];

    // Find next waypoint
    const nextWaypoint = findNextWaypoint(updatedRoute.waypoints);
    const distanceToNextWaypoint = nextWaypoint 
      ? calculateDistance(userLocation, nextWaypoint.coordinates)
      : 0;

    // Calculate ETA
    const eta = nextWaypoint
      ? calculateETA(distanceToNextWaypoint, position.speed)
      : null;

    // Calculate progress
    const progress = calculateRouteProgress(
      userLocation,
      updatedRoute.geometry,
      updatedRoute.waypoints
    );

    // Check if off route
    const offRoute = isOffRoute(userLocation, updatedRoute.geometry, 100);

    // Schedule variance: compare the FROZEN planned arrival (captured at nav
    // start) against the actual arrival for the most recently completed
    // waypoint. Positive = ahead of schedule (arrived earlier than planned).
    let scheduleVarianceMinutes: number | null = null;
    const completedWithTimes = updatedRoute.waypoints.filter(
      (wp) => wp.isCompleted && wp.actualArrival && plannedArrivals.has(wp.id),
    );
    if (completedWithTimes.length > 0) {
      const last = completedWithTimes[completedWithTimes.length - 1];
      const plannedMs = new Date(plannedArrivals.get(last.id)!).getTime();
      const actualMs = new Date(last.actualArrival!).getTime();
      if (!Number.isNaN(plannedMs) && !Number.isNaN(actualMs)) {
        scheduleVarianceMinutes = Math.round((plannedMs - actualMs) / 60_000);
      }
    }

    return {
      isNavigating,
      currentStepIndex: stepIndex,
      currentInstruction: currentStep?.instruction || '',
      distanceToNextManeuver: distanceToManeuver,
      nextWaypoint,
      distanceToNextWaypoint,
      etaToNextWaypoint: eta ? formatETA(eta) : null,
      scheduleVarianceMinutes,
      routeProgress: progress,
      isOffRoute: offRoute,
      isRerouting,
      completedWaypointIds,
      showOffRouteBanner: offRoute && !isRerouting,
      rerouteCount,
    };
  }, [isNavigating, position, updatedRoute, isRerouting, completedWaypointIds, rerouteCount, plannedArrivals]);

  // Start navigation
  const startNavigation = useCallback(() => {
    setIsNavigating(true);
    announcedApproachStepsRef.current.clear();
    announcedImminentStepsRef.current.clear();
    lastAnnouncedWaypointRef.current = null;
    hasAnnouncedOffRouteRef.current = false;

    // Freeze the planned schedule so we can measure ahead/behind against it.
    const planned = new Map<string, string>();
    for (const wp of updatedRoute.waypoints) {
      if (wp.estimatedArrival) planned.set(wp.id, wp.estimatedArrival);
    }
    setPlannedArrivals(planned);

    // Initial announcement
    if (voiceEnabled && updatedRoute.navigationSteps && updatedRoute.navigationSteps.length > 0) {
      voiceService.speak('Navigation started', 'high').catch(() => {
        // Ignore voice errors
      });
    }
  }, [voiceEnabled, updatedRoute]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    voiceService.cancel();
    if (rerouteTimeoutRef.current) {
      clearTimeout(rerouteTimeoutRef.current);
      rerouteTimeoutRef.current = null;
    }
  }, []);

  // Dismiss the off-route banner without rerouting
  const dismissOffRouteBanner = useCallback(() => {
    hasAnnouncedOffRouteRef.current = false;
    if (rerouteTimeoutRef.current) {
      clearTimeout(rerouteTimeoutRef.current);
      rerouteTimeoutRef.current = null;
    }
  }, []);

  // Mark waypoint as completed
  const completeWaypoint = useCallback((waypointId: string) => {
    const waypoint = updatedRoute.waypoints.find(wp => wp.id === waypointId);
    if (!waypoint || waypoint.isCompleted) return;

    const actualArrival = new Date().toISOString();

    // Immutable update: mutating the waypoint object in place left `updatedRoute`
    // with the same identity, so the derived navigation state (next waypoint,
    // distances, the bottom panel) didn't re-render — the "current stop" card
    // stayed stuck on the completed waypoint.
    setUpdatedRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp =>
        wp.id === waypointId ? { ...wp, isCompleted: true, actualArrival } : wp,
      ),
    }));
    setCompletedWaypointIds(prev => (prev.includes(waypointId) ? prev : [...prev, waypointId]));

    if (onWaypointComplete) {
      onWaypointComplete({ ...waypoint, isCompleted: true, actualArrival });
    }

    // Announce completion
    if (voiceEnabled && lastAnnouncedWaypointRef.current !== waypointId) {
      voiceService.speak(announceWaypointArrival(waypoint.name), 'high').catch(() => {
        // Ignore voice errors
      });
      lastAnnouncedWaypointRef.current = waypointId;
    }

    // Check if this completion was the last outstanding waypoint
    const allCompleted = updatedRoute.waypoints.every(
      wp => wp.isCompleted || wp.id === waypointId,
    );
    if (allCompleted) {
      setIsNavigating(false);
      if (voiceEnabled) {
        voiceService.speak(announceRouteComplete(), 'high').catch(() => {
          // Ignore voice errors
        });
      }
      if (onRouteComplete) {
        onRouteComplete(rerouteCount);
      }
    }
  }, [updatedRoute, onWaypointComplete, onRouteComplete, voiceEnabled, rerouteCount]);

  // Skip to next waypoint manually (complete current without proximity check)
  const skipToNextWaypoint = useCallback(() => {
    const nextWaypoint = findNextWaypoint(updatedRoute.waypoints);
    if (nextWaypoint) {
      completeWaypoint(nextWaypoint.id);
    }
  }, [updatedRoute.waypoints, completeWaypoint]);

  // Reroute when off course
  const reroute = useCallback(async () => {
    if (!position || !navigationState.nextWaypoint || isRerouting) return;

    setIsRerouting(true);
    
    try {
      // Announce rerouting
      if (voiceEnabled) {
        voiceService.speak(announceOffRoute(), 'high').catch(() => {
          // Ignore voice errors
        });
        hasAnnouncedOffRouteRef.current = true;
      }

      // Get remaining waypoints (not completed)
      const remainingWaypoints = updatedRoute.waypoints.filter(wp => !wp.isCompleted);
      const coordinates = [
        position.coordinates,
        ...remainingWaypoints.map(wp => wp.coordinates),
      ];

      // Get new route from current position to remaining waypoints
      const newDirections = await getDirections(coordinates);

      // Recalculate ETAs for remaining waypoints based on current time
      const updatedWaypointsWithETAs = calculateRealTimeETAs(
        {
          ...updatedRoute,
          geometry: newDirections.geometry,
          navigationSteps: newDirections.steps,
        },
        remainingWaypoints.findIndex(wp => !wp.isCompleted),
        new Date(),
        position.speed ?? undefined
      );

      // Update route with new geometry, steps, and ETAs
      setUpdatedRoute(prev => ({
        ...prev,
        geometry: newDirections.geometry,
        navigationSteps: newDirections.steps,
        distance: newDirections.distance,
        estimatedDuration: newDirections.duration,
        waypoints: updatedWaypointsWithETAs,
      }));

      // Increment reroute count and log event
      setRerouteCount(prev => prev + 1);

      // New geometry means new steps — reset per-step voice de-dup so the
      // rerouted instructions are announced.
      announcedApproachStepsRef.current.clear();
      announcedImminentStepsRef.current.clear();

      setIsRerouting(false);
      hasAnnouncedOffRouteRef.current = false;
    } catch (error) {
      console.error('Rerouting failed:', error);
      setIsRerouting(false);
    }
  }, [position, navigationState.nextWaypoint, updatedRoute, voiceEnabled, isRerouting]);

  // Handle side effects (voice announcements, waypoint completion, rerouting)
  useEffect(() => {
    if (!isNavigating || !position || !updatedRoute.navigationSteps) {
      return;
    }

    const { currentStepIndex, distanceToNextManeuver, currentInstruction, nextWaypoint, isOffRoute: offRoute } = navigationState;
    const userLocation = position.coordinates;

    // Voice announcements based on distance to the maneuver. Each step gets at
    // most two spoken cues: one "approach" ("In 200 metres, turn right") the
    // first time we're within range, and one "now" within ~40m. The old code
    // re-queued the approach cue on every GPS tick inside a 150–200m band, so
    // instructions stacked up and kept playing after the turn.
    if (voiceEnabled && currentInstruction) {
      if (
        distanceToNextManeuver <= 40 &&
        !announcedImminentStepsRef.current.has(currentStepIndex)
      ) {
        voiceService
          .speak(formatInstructionForVoice(currentInstruction, distanceToNextManeuver), 'high')
          .catch(() => {
            // Ignore voice errors (e.g., interrupted)
          });
        announcedImminentStepsRef.current.add(currentStepIndex);
        // Suppress a late approach cue for a step we're already on top of.
        announcedApproachStepsRef.current.add(currentStepIndex);
      } else if (
        distanceToNextManeuver <= 250 &&
        distanceToNextManeuver > 40 &&
        !announcedApproachStepsRef.current.has(currentStepIndex)
      ) {
        voiceService
          .speak(formatInstructionForVoice(currentInstruction, distanceToNextManeuver), 'low')
          .catch(() => {
            // Ignore voice errors (e.g., interrupted)
          });
        announcedApproachStepsRef.current.add(currentStepIndex);
      }
    }

    // Auto-complete waypoint when near
    // Queue waypoint for completion if not already completed or queued
    if (nextWaypoint && isNearWaypoint(userLocation, nextWaypoint, WAYPOINT_ARRIVAL_RADIUS_M)) {
      if (!completedWaypointIds.includes(nextWaypoint.id) && 
          !waypointCompletionQueueRef.current.has(nextWaypoint.id)) {
        waypointCompletionQueueRef.current.add(nextWaypoint.id);
        // Use queueMicrotask to defer state update to next microtask queue
        queueMicrotask(() => {
          completeWaypoint(nextWaypoint.id);
          waypointCompletionQueueRef.current.delete(nextWaypoint.id);
        });
      }
    }

    // Show off-route banner when off route (instead of auto-rerouting)
    // hasAnnouncedOffRouteRef tracks whether an announcement has been made;
    // reset it when the user is back on route.
    if (!offRoute) {
      hasAnnouncedOffRouteRef.current = false;
      if (rerouteTimeoutRef.current) {
        clearTimeout(rerouteTimeoutRef.current);
        rerouteTimeoutRef.current = null;
      }
    }
  }, [isNavigating, position, updatedRoute, voiceEnabled, navigationState, completedWaypointIds, isRerouting, completeWaypoint, reroute]);

  // Periodically update ETAs during navigation (every 30 seconds)
  useEffect(() => {
    if (!isNavigating || !position || !updatedRoute.navigationSteps) {
      return;
    }

    const updateETAs = () => {
      const nextWaypoint = findNextWaypoint(updatedRoute.waypoints);
      if (!nextWaypoint) return;

      const currentWaypointIndex = updatedRoute.waypoints.findIndex(wp => wp.id === nextWaypoint.id);

      // Recalculate ETAs for all remaining waypoints
      const updatedWaypointsWithETAs = calculateRealTimeETAs(
        updatedRoute,
        currentWaypointIndex,
        new Date(),
        position.speed ?? undefined
      );

      setUpdatedRoute(prev => ({
        ...prev,
        waypoints: updatedWaypointsWithETAs,
      }));
    };

    // Update ETAs every 30 seconds
    const intervalId = setInterval(updateETAs, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isNavigating, position, updatedRoute]);

  return {
    navigationState,
    position,
    locationError,
    permission,
    updatedRoute,
    startNavigation,
    stopNavigation,
    completeWaypoint,
    skipToNextWaypoint,
    reroute,
    dismissOffRouteBanner,
  };
}
