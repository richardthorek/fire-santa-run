/**
 * useLocationBroadcast hook
 * Broadcasts GPS location updates from the navigator device
 * Throttles updates to 5 second intervals
 *
 * When the device is offline, broadcast attempts are still made so the
 * service worker BackgroundSync plugin can queue and replay them once
 * the connection is restored.
 */

import { useEffect, useRef } from 'react';
import { useWebPubSub } from './useWebPubSub';
import { useNetworkStatus } from './useNetworkStatus';
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

  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    // Always require an active navigation session and a known position.
    // We intentionally do NOT gate on `isConnected` here: in production
    // mode the broadcast is a plain HTTP POST to /api/broadcast, so the
    // service worker can queue it via BackgroundSync when the device is
    // offline and replay it once connectivity is restored. In dev mode
    // `sendLocation` checks for BroadcastChannel availability internally
    // and is a no-op if the channel has not been opened yet.
    if (!isNavigating || !position) {
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

    // Send location update (service worker queues when offline in production)
    sendLocation(broadcast);
  }, [isNavigating, position, routeId, routeProgress, nextWaypointEta, sendLocation]);

  return {
    isConnected,
    isOnline,
  };
}
