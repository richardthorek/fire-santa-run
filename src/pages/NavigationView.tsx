/**
 * NavigationView page
 * Main turn-by-turn navigation interface for brigade operators
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigation, useRoutes, useLocationBroadcast, useMediaSession } from '../hooks';
import { useWakeLock } from '../utils/wakeLock';
import { NavigationHeader } from '../components/NavigationHeader';
import { NavigationMap } from '../components/NavigationMap';
import { NavigationPanel } from '../components/NavigationPanel';
import { OffRouteBanner } from '../components/OffRouteBanner';
import { isNearWaypoint } from '../utils/navigation';
import type { Route } from '../types';

export interface NavigationViewProps {
  route: Route;
  onComplete?: () => void;
  onExit?: () => void;
}

export function NavigationView({ route, onComplete, onExit }: NavigationViewProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const { saveRoute } = useRoutes();

  const {
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
  } = useNavigation({
    route,
    onRouteComplete: async (finalRerouteCount) => {
      // Mark route as completed, saving the reroute count for summary display
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now(); // Capture timestamp once
      const completedRoute = {
        ...updatedRoute,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        rerouteCount: finalRerouteCount,
        actualDuration: updatedRoute.startedAt 
          ? Math.floor((now - new Date(updatedRoute.startedAt).getTime()) / 1000)
          : undefined,
      };
      await saveRoute(completedRoute);
      
      if (onComplete) {
        onComplete();
      }
    },
    voiceEnabled,
  });

  // Keep screen awake during navigation (only when user has enabled the toggle)
  const { isSupported: wakeLockSupported } = useWakeLock(
    navigationState.isNavigating && keepScreenOn
  );

  // Broadcast location updates for real-time tracking
  const { isOnline } = useLocationBroadcast({
    routeId: route.id,
    position,
    routeProgress: {
      currentWaypointIndex: navigationState.nextWaypoint?.order || 0,
      completedWaypoints: navigationState.completedWaypointIds,
      estimatedArrival: navigationState.etaToNextWaypoint || undefined,
    },
    isNavigating: navigationState.isNavigating,
    nextWaypointEta: navigationState.etaToNextWaypoint || undefined,
  });

  // Auto-start navigation on mount and mark route as active
  useEffect(() => {
    if (!hasStarted) {
      startNavigation();
      
      // Update route status to active
      if (route.status !== 'active') {
        const activeRoute = {
          ...route,
          status: 'active' as const,
          startedAt: new Date().toISOString(),
        };
        saveRoute(activeRoute).catch(error => {
          console.error('Failed to update route status:', error);
        });
      }
      
      setHasStarted(true);
    }
  }, [hasStarted, startNavigation, route, saveRoute]);

  const handleStopNavigation = useCallback(() => {
    stopNavigation();
    if (onExit) {
      onExit();
    } else {
      window.history.back();
    }
  }, [stopNavigation, onExit]);

  const handleCompleteWaypoint = useCallback(() => {
    if (navigationState.nextWaypoint) {
      completeWaypoint(navigationState.nextWaypoint.id);
    }
  }, [navigationState.nextWaypoint, completeWaypoint]);

  const handleSkipToNext = useCallback(() => {
    skipToNextWaypoint();
  }, [skipToNextWaypoint]);

  // Determine if waypoint can be completed (within 100m)
  const canCompleteWaypoint =
    position &&
    navigationState.nextWaypoint &&
    isNearWaypoint(position.coordinates, navigationState.nextWaypoint, 100);

  // Get current step for header
  const currentStep = updatedRoute.navigationSteps?.[navigationState.currentStepIndex];

  // Lock-screen media controls and audio ducking
  useMediaSession({
    route,
    currentInstruction: currentStep?.instruction || navigationState.currentInstruction,
    voiceEnabled,
    onToggleVoice: () => setVoiceEnabled(v => !v),
    onNextWaypoint: handleSkipToNext,
    isNavigating: navigationState.isNavigating,
  });

  // Handle location errors
  if (locationError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📍</div>
        <h2 style={{ color: '#D32F2F', marginBottom: '1rem' }}>Location Access Required</h2>
        <p style={{ color: '#616161', marginBottom: '2rem', maxWidth: '400px' }}>
          {locationError.code === 1
            ? 'Please enable location access in your browser settings to use navigation.'
            : locationError.code === 2
            ? 'Unable to determine your location. Please check your device settings.'
            : 'Location request timed out. Please try again.'}
        </p>
        <button
          onClick={handleStopNavigation}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          Exit Navigation
        </button>
      </div>
    );
  }

  // Handle permission denied
  if (permission === 'denied') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🚫</div>
        <h2 style={{ color: '#D32F2F', marginBottom: '1rem' }}>Location Permission Denied</h2>
        <p style={{ color: '#616161', marginBottom: '2rem', maxWidth: '400px' }}>
          Navigation requires access to your device location. Please enable location permissions in
          your browser settings and reload the page.
        </p>
        <button
          onClick={handleStopNavigation}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          Exit Navigation
        </button>
      </div>
    );
  }

  // Loading state
  if (!position || !updatedRoute.geometry) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#212121', marginBottom: '0.5rem' }}>
          Starting Navigation
        </div>
        <div style={{ color: '#616161' }}>Getting your location...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Full-screen Map */}
      <NavigationMap
        route={updatedRoute}
        userPosition={position}
        completedWaypointIds={navigationState.completedWaypointIds}
      />

      {/* Offline Banner — shown whenever the device loses internet connectivity.
          Map tiles served from cache and location broadcasts are queued
          by the service worker for replay when the connection returns. */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(66, 66, 66, 0.95)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            padding: '0.5rem 1rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 500,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span aria-hidden="true">📶</span>
          Offline — navigation continues; location updates will sync when reconnected
        </div>
      )}

      {/* Floating Navigation Header */}
      <NavigationHeader
        instruction={currentStep?.instruction || navigationState.currentInstruction}
        distance={navigationState.distanceToNextManeuver}
        maneuverType={currentStep?.maneuver.type || 'continue'}
        maneuverModifier={currentStep?.maneuver.modifier}
        isOffRoute={navigationState.isOffRoute}
        isRerouting={navigationState.isRerouting}
      />

      {/* Off-Route Banner — shown when driver is >100m from route */}
      <OffRouteBanner
        isVisible={navigationState.showOffRouteBanner}
        isRerouting={navigationState.isRerouting}
        onReroute={reroute}
        onDismiss={dismissOffRouteBanner}
      />

      {/* Voice Toggle Button */}
      <button
        onClick={() => setVoiceEnabled(!voiceEnabled)}
        style={{
          position: 'absolute',
          top: '7rem',
          left: '1rem',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontSize: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
        }}
        aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
      >
        {voiceEnabled ? '🔊' : '🔇'}
      </button>

      {/* Keep Screen On Toggle (only shown when Wake Lock API is supported) */}
      {wakeLockSupported && (
        <button
          onClick={() => setKeepScreenOn(!keepScreenOn)}
          style={{
            position: 'absolute',
            top: '7rem',
            left: '4.5rem',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: keepScreenOn
              ? 'rgba(251, 192, 45, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
          aria-label={keepScreenOn ? 'Disable keep screen on' : 'Enable keep screen on'}
          aria-pressed={keepScreenOn}
        >
          {keepScreenOn ? '☀️' : '🌙'}
        </button>
      )}

      {/* Wake Lock unsupported warning */}
      {!wakeLockSupported && (
        <div
          style={{
            position: 'absolute',
            top: '7rem',
            right: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            zIndex: 999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          ⚠️ Keep screen on manually
        </div>
      )}

      {/* Floating Bottom Panel */}
      <NavigationPanel
        nextWaypoint={navigationState.nextWaypoint}
        distanceToWaypoint={navigationState.distanceToNextWaypoint}
        eta={navigationState.etaToNextWaypoint}
        routeProgress={navigationState.routeProgress}
        canCompleteWaypoint={canCompleteWaypoint || false}
        onCompleteWaypoint={handleCompleteWaypoint}
        onSkipToNext={handleSkipToNext}
        onStopNavigation={handleStopNavigation}
        completedWaypoints={navigationState.completedWaypointIds.length}
        totalWaypoints={route.waypoints.length}
        waypoints={route.waypoints}
        rerouteCount={navigationState.rerouteCount}
      />
    </div>
  );
}
