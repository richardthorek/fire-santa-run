/**
 * NavigationView page
 * Main turn-by-turn navigation interface for brigade operators
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '../hooks';
import { useWakeLock } from '../utils/wakeLock';
import { NavigationHeader } from '../components/NavigationHeader';
import { NavigationMap } from '../components/NavigationMap';
import { NavigationPanel } from '../components/NavigationPanel';
import { isNearWaypoint } from '../utils/navigation';
import type { Route } from '../types';

export interface NavigationViewProps {
  route: Route;
  onComplete?: () => void;
  onExit?: () => void;
}

export function NavigationView({ route, onComplete, onExit }: NavigationViewProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const {
    navigationState,
    position,
    locationError,
    permission,
    updatedRoute,
    startNavigation,
    stopNavigation,
    completeWaypoint,
  } = useNavigation({
    route,
    onRouteComplete: () => {
      if (onComplete) {
        onComplete();
      }
    },
    voiceEnabled,
  });

  // Keep screen awake during navigation
  const { isSupported: wakeLockSupported } = useWakeLock(navigationState.isNavigating);

  // Auto-start navigation on mount
  useEffect(() => {
    if (!hasStarted) {
      startNavigation();
      setHasStarted(true);
    }
  }, [hasStarted, startNavigation]);

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

  // Determine if waypoint can be completed (within 100m)
  const canCompleteWaypoint =
    position &&
    navigationState.nextWaypoint &&
    isNearWaypoint(position.coordinates, navigationState.nextWaypoint, 100);

  // Get current step for header
  const currentStep = updatedRoute.navigationSteps?.[navigationState.currentStepIndex];

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
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Navigation Header */}
      <NavigationHeader
        instruction={currentStep?.instruction || navigationState.currentInstruction}
        distance={navigationState.distanceToNextManeuver}
        maneuverType={currentStep?.maneuver.type || 'continue'}
        maneuverModifier={currentStep?.maneuver.modifier}
        isOffRoute={navigationState.isOffRoute}
        isRerouting={navigationState.isRerouting}
      />

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <NavigationMap
          route={updatedRoute}
          userPosition={position}
          completedWaypointIds={navigationState.completedWaypointIds}
        />

        {/* Voice Toggle Button */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
          aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </button>

        {/* Wake Lock Indicator */}
        {!wakeLockSupported && (
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              zIndex: 1,
            }}
          >
            ⚠️ Keep screen on manually
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <NavigationPanel
        nextWaypoint={navigationState.nextWaypoint}
        distanceToWaypoint={navigationState.distanceToNextWaypoint}
        eta={navigationState.etaToNextWaypoint}
        routeProgress={navigationState.routeProgress}
        canCompleteWaypoint={canCompleteWaypoint || false}
        onCompleteWaypoint={handleCompleteWaypoint}
        onStopNavigation={handleStopNavigation}
        completedWaypoints={navigationState.completedWaypointIds.length}
        totalWaypoints={route.waypoints.length}
      />
    </div>
  );
}
