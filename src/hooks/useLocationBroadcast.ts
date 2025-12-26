/**
 * useLocationBroadcast hook
 * Broadcasts GPS location updates from the navigator device
 * Throttles updates to 5 second intervals
 */

import { useEffect, useRef } from 'react';
import { useWebPubSub } from './useWebPubSub';
import type { RouteProgress, LocationBroadcast } from '../types';
import type { GeolocationCoordinates } from './useGeolocation';

interface UseLocationBroadcastOptions {
  routeId: string;
  position: GeolocationCoordinates | null;
  routeProgress: RouteProgress;
  isNavigating: boolean;
  nextWaypointEta?: string;
}

const BROADCAST_INTERVAL_MS = 5000; // 5 seconds

export function useLocationBroadcast({
  routeId,
  position,
  routeProgress,
  isNavigating,
  nextWaypointEta,
}: UseLocationBroadcastOptions) {
  const lastBroadcastTimeRef = useRef(0);

  const { sendLocation, isConnected } = useWebPubSub({
    routeId,
    role: 'broadcaster',
  });

  useEffect(() => {
    if (!isNavigating || !position || !isConnected) {
      return;
    }

    // Throttle broadcasts to 5 second intervals
    const now = Date.now();
    if (now - lastBroadcastTimeRef.current < BROADCAST_INTERVAL_MS) {
      return;
    }

    lastBroadcastTimeRef.current = now;

    // Prepare location broadcast message
    const broadcast: LocationBroadcast = {
      routeId,
      location: position.coordinates,
      timestamp: position.timestamp,
      heading: position.heading ?? undefined,
      speed: position.speed ?? undefined,
      currentWaypointIndex: routeProgress.currentWaypointIndex,
      nextWaypointEta,
    };

    // Send location update
    sendLocation(broadcast);
  }, [isNavigating, position, isConnected, routeId, routeProgress, nextWaypointEta, sendLocation]);

  return {
    isConnected,
  };
}
