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

export interface NavigationState {
  isNavigating: boolean;
  currentStepIndex: number;
  currentInstruction: string;
  distanceToNextManeuver: number;
  nextWaypoint: Waypoint | null;
  distanceToNextWaypoint: number;
  etaToNextWaypoint: string | null;
  routeProgress: number;
  isOffRoute: boolean;
  isRerouting: boolean;
  completedWaypointIds: string[];
}

export interface UseNavigationOptions {
  route: Route;
  onRouteComplete?: () => void;
  onWaypointComplete?: (waypoint: Waypoint) => void;
  voiceEnabled?: boolean;
}

export function useNavigation({ route, onRouteComplete, onWaypointComplete, voiceEnabled = true }: UseNavigationOptions) {
  const { position, error: locationError, permission } = useGeolocation({ 
    watch: true, 
    enableHighAccuracy: true 
  });

  const [isNavigating, setIsNavigating] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [completedWaypointIds, setCompletedWaypointIds] = useState<string[]>([]);
  const [updatedRoute, setUpdatedRoute] = useState<Route>(route);
  
  const lastAnnouncedStepRef = useRef<number>(-1);
  const lastAnnouncedWaypointRef = useRef<string | null>(null);
  const hasAnnouncedOffRouteRef = useRef(false);
  const rerouteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointCompletionQueueRef = useRef<Set<string>>(new Set());

  // Constants
  const REROUTE_DEBOUNCE_MS = 2000;

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
        routeProgress: 0,
        isOffRoute: false,
        isRerouting,
        completedWaypointIds,
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

    return {
      isNavigating,
      currentStepIndex: stepIndex,
      currentInstruction: currentStep?.instruction || '',
      distanceToNextManeuver: distanceToManeuver,
      nextWaypoint,
      distanceToNextWaypoint,
      etaToNextWaypoint: eta ? formatETA(eta) : null,
      routeProgress: progress,
      isOffRoute: offRoute,
      isRerouting,
      completedWaypointIds,
    };
  }, [isNavigating, position, updatedRoute, isRerouting, completedWaypointIds]);

  // Start navigation
  const startNavigation = useCallback(() => {
    setIsNavigating(true);
    lastAnnouncedStepRef.current = -1;
    lastAnnouncedWaypointRef.current = null;
    hasAnnouncedOffRouteRef.current = false;

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

  // Mark waypoint as completed
  const completeWaypoint = useCallback((waypointId: string) => {
    setCompletedWaypointIds(prev => [...prev, waypointId]);

    const waypoint = updatedRoute.waypoints.find(wp => wp.id === waypointId);
    if (waypoint) {
      waypoint.isCompleted = true;
      waypoint.actualArrival = new Date().toISOString();
      
      if (onWaypointComplete) {
        onWaypointComplete(waypoint);
      }

      // Announce completion
      if (voiceEnabled && lastAnnouncedWaypointRef.current !== waypointId) {
        voiceService.speak(announceWaypointArrival(waypoint.name), 'high').catch(() => {
          // Ignore voice errors
        });
        lastAnnouncedWaypointRef.current = waypointId;
      }
    }

    // Check if all waypoints are completed
    const allCompleted = updatedRoute.waypoints.every(wp => wp.isCompleted);
    if (allCompleted) {
      setIsNavigating(false);
      if (voiceEnabled) {
        voiceService.speak(announceRouteComplete(), 'high').catch(() => {
          // Ignore voice errors
        });
      }
      if (onRouteComplete) {
        onRouteComplete();
      }
    }
  }, [updatedRoute, onWaypointComplete, onRouteComplete, voiceEnabled]);

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
      if (voiceEnabled && !hasAnnouncedOffRouteRef.current) {
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
      
      // Update route with new geometry and steps
      setUpdatedRoute(prev => ({
        ...prev,
        geometry: newDirections.geometry,
        navigationSteps: newDirections.steps,
        distance: newDirections.distance,
        estimatedDuration: newDirections.duration,
      }));

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

    // Voice announcements based on distance to maneuver
    if (voiceEnabled && currentInstruction && currentStepIndex !== lastAnnouncedStepRef.current) {
      if (distanceToNextManeuver < 50) {
        // Immediate instruction
        voiceService.speak(
          formatInstructionForVoice(currentInstruction, distanceToNextManeuver),
          'high'
        ).catch(() => {
          // Ignore voice errors (e.g., interrupted)
        });
        lastAnnouncedStepRef.current = currentStepIndex;
      } else if (distanceToNextManeuver < 200 && distanceToNextManeuver > 150) {
        // Advanced warning
        voiceService.speak(
          formatInstructionForVoice(currentInstruction, distanceToNextManeuver),
          'low'
        ).catch(() => {
          // Ignore voice errors (e.g., interrupted)
        });
      }
    }

    // Auto-complete waypoint when near
    // Queue waypoint for completion if not already completed or queued
    if (nextWaypoint && isNearWaypoint(userLocation, nextWaypoint, 50)) {
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

    // Trigger rerouting if off route and not already rerouting (with debounce)
    if (offRoute && !isRerouting) {
      if (rerouteTimeoutRef.current) {
        clearTimeout(rerouteTimeoutRef.current);
      }
      rerouteTimeoutRef.current = setTimeout(() => {
        reroute();
      }, REROUTE_DEBOUNCE_MS);
    } else if (!offRoute && rerouteTimeoutRef.current) {
      clearTimeout(rerouteTimeoutRef.current);
      rerouteTimeoutRef.current = null;
    }
  }, [isNavigating, position, updatedRoute, voiceEnabled, navigationState, completedWaypointIds, isRerouting, completeWaypoint, reroute, REROUTE_DEBOUNCE_MS]);

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
  };
}
