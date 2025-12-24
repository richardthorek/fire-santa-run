/**
 * Custom hook for managing turn-by-turn navigation state
 * Handles location tracking, instruction updates, rerouting, and waypoint completion
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeolocation } from './useGeolocation';
import type { Route, Waypoint, NavigationStep } from '../types';
import {
  findCurrentStep,
  findNextWaypoint,
  calculateRouteProgress,
  isOffRoute,
  calculateETA,
  formatETA,
  isNearWaypoint,
  getRemainingDistance,
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

  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    currentStepIndex: 0,
    currentInstruction: '',
    distanceToNextManeuver: 0,
    nextWaypoint: null,
    distanceToNextWaypoint: 0,
    etaToNextWaypoint: null,
    routeProgress: 0,
    isOffRoute: false,
    isRerouting: false,
    completedWaypointIds: [],
  });

  const [updatedRoute, setUpdatedRoute] = useState<Route>(route);
  const lastAnnouncedStepRef = useRef<number>(-1);
  const lastAnnouncedWaypointRef = useRef<string | null>(null);
  const hasAnnouncedOffRouteRef = useRef(false);

  // Configure voice settings
  useEffect(() => {
    voiceService.updateSettings({ 
      enabled: voiceEnabled,
      language: 'en-AU' 
    });
  }, [voiceEnabled]);

  // Start navigation
  const startNavigation = useCallback(() => {
    setNavigationState(prev => ({ ...prev, isNavigating: true }));
    lastAnnouncedStepRef.current = -1;
    lastAnnouncedWaypointRef.current = null;
    hasAnnouncedOffRouteRef.current = false;

    // Initial announcement
    if (voiceEnabled && updatedRoute.navigationSteps && updatedRoute.navigationSteps.length > 0) {
      voiceService.speak('Navigation started', 'high');
    }
  }, [voiceEnabled, updatedRoute]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setNavigationState(prev => ({ ...prev, isNavigating: false }));
    voiceService.cancel();
  }, []);

  // Mark waypoint as completed
  const completeWaypoint = useCallback((waypointId: string) => {
    setNavigationState(prev => ({
      ...prev,
      completedWaypointIds: [...prev.completedWaypointIds, waypointId],
    }));

    const waypoint = updatedRoute.waypoints.find(wp => wp.id === waypointId);
    if (waypoint) {
      waypoint.isCompleted = true;
      waypoint.actualArrival = new Date().toISOString();
      
      if (onWaypointComplete) {
        onWaypointComplete(waypoint);
      }

      // Announce completion
      if (voiceEnabled && lastAnnouncedWaypointRef.current !== waypointId) {
        voiceService.speak(announceWaypointArrival(waypoint.name), 'high');
        lastAnnouncedWaypointRef.current = waypointId;
      }
    }

    // Check if all waypoints are completed
    const allCompleted = updatedRoute.waypoints.every(wp => wp.isCompleted);
    if (allCompleted) {
      setNavigationState(prev => ({ ...prev, isNavigating: false }));
      if (voiceEnabled) {
        voiceService.speak(announceRouteComplete(), 'high');
      }
      if (onRouteComplete) {
        onRouteComplete();
      }
    }
  }, [updatedRoute, onWaypointComplete, onRouteComplete, voiceEnabled]);

  // Reroute when off course
  const reroute = useCallback(async () => {
    if (!position || !navigationState.nextWaypoint) return;

    setNavigationState(prev => ({ ...prev, isRerouting: true }));
    
    try {
      // Announce rerouting
      if (voiceEnabled && !hasAnnouncedOffRouteRef.current) {
        voiceService.speak(announceOffRoute(), 'high');
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

      setNavigationState(prev => ({
        ...prev,
        isRerouting: false,
        isOffRoute: false,
        currentStepIndex: 0,
      }));

      hasAnnouncedOffRouteRef.current = false;
    } catch (error) {
      console.error('Rerouting failed:', error);
      setNavigationState(prev => ({ ...prev, isRerouting: false }));
    }
  }, [position, navigationState.nextWaypoint, updatedRoute, voiceEnabled]);

  // Update navigation state based on current position
  useEffect(() => {
    if (!navigationState.isNavigating || !position || !updatedRoute.geometry || !updatedRoute.navigationSteps) {
      return;
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

    // Update state
    setNavigationState(prev => ({
      ...prev,
      currentStepIndex: stepIndex,
      currentInstruction: currentStep?.instruction || '',
      distanceToNextManeuver,
      nextWaypoint,
      distanceToNextWaypoint,
      etaToNextWaypoint: eta ? formatETA(eta) : null,
      routeProgress: progress,
      isOffRoute: offRoute,
    }));

    // Voice announcements based on distance to maneuver
    if (voiceEnabled && currentStep && stepIndex !== lastAnnouncedStepRef.current) {
      if (distanceToManeuver < 50) {
        // Immediate instruction
        voiceService.speak(
          formatInstructionForVoice(currentStep.instruction, distanceToManeuver),
          'high'
        );
        lastAnnouncedStepRef.current = stepIndex;
      } else if (distanceToManeuver < 200 && distanceToManeuver > 150) {
        // Advanced warning
        voiceService.speak(
          formatInstructionForVoice(currentStep.instruction, distanceToManeuver),
          'low'
        );
      }
    }

    // Auto-complete waypoint when near
    if (nextWaypoint && isNearWaypoint(userLocation, nextWaypoint, 50)) {
      if (!navigationState.completedWaypointIds.includes(nextWaypoint.id)) {
        completeWaypoint(nextWaypoint.id);
      }
    }

    // Trigger rerouting if off route and not already rerouting
    if (offRoute && !navigationState.isRerouting) {
      reroute();
    }
  }, [
    navigationState.isNavigating,
    navigationState.isRerouting,
    navigationState.completedWaypointIds,
    position,
    updatedRoute,
    voiceEnabled,
    completeWaypoint,
    reroute,
  ]);

  return {
    navigationState,
    position,
    locationError,
    permission,
    updatedRoute,
    startNavigation,
    stopNavigation,
    completeWaypoint,
    reroute,
  };
}
