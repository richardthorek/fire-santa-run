/**
 * NavigationView page
 * Main turn-by-turn navigation interface for brigade operators
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNavigation, useRoutes, useLocationBroadcast, useMediaSession, useSessionExpiry } from '../hooks';
import { useWakeLock } from '../utils/wakeLock';
import { voiceService } from '../utils/voice';
import { NavigationHeader } from '../components/NavigationHeader';
import { NavigationMap } from '../components/NavigationMap';
import { NavigationPanel } from '../components/NavigationPanel';
import { OffRouteBanner } from '../components/OffRouteBanner';
import { BroadcastHealthBanner } from '../components/BroadcastHealthBanner';
import { clearStoredToken } from '../auth/suiteAuth';
import { isNearWaypoint } from '../utils/navigation';
import { TOUCH_TARGET, Z_INDEX } from '../utils/constants';
import type { Route } from '../types';

/** Warn before starting when the Station Manager sign-in has under two hours left. */
const SESSION_WARNING_MS = 2 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export interface NavigationViewProps {
  route: Route;
  onComplete?: () => void;
  onExit?: () => void;
}

/** After this long with no GPS fix at all, show a hint that something may be wrong. */
const LOADING_HINT_DELAY_MS = 15_000;

export function NavigationView({ route, onComplete, onExit }: NavigationViewProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  // Location access must be requested from a direct tap — iOS Safari silently
  // denies geolocation calls made from a mount effect instead of a user
  // gesture, with no native prompt at all. See handleEnableLocation below.
  const [locationEnabled, setLocationEnabled] = useState(false);
  const { saveRoute } = useRoutes();
  // Run-level fields every save must carry. useNavigation's route snapshot
  // still holds the pre-run status (e.g. 'published') and no startedAt, so a
  // per-stop save spread from it would flip a live run back to published and
  // drop Santa off the public tracker.
  const runMetaRef = useRef<Pick<Route, 'status' | 'startedAt'>>({
    status: route.status,
    startedAt: route.startedAt,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { remainingMs: sessionRemainingMs } = useSessionExpiry();
  const sessionExpiresSoon =
    import.meta.env.VITE_DEV_MODE !== 'true' &&
    sessionRemainingMs !== null &&
    sessionRemainingMs < SESSION_WARNING_MS;
  // Filled in below once useLocationBroadcast has run; useNavigation's
  // onRouteComplete callback fires long after both hooks are initialised.
  const broadcastRunCompletedRef = useRef<() => void>(() => {});

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
    onRouteComplete: async (finalRerouteCount, finalRoute) => {
      // Mark route as completed, saving the reroute count for summary display.
      // `finalRoute` (passed by the hook) already includes the very last
      // waypoint's completion — reading `updatedRoute` here would still be
      // the pre-completion snapshot from this render's closure.
      const now = Date.now(); // Capture timestamp once
      const completedRoute = {
        ...finalRoute,
        startedAt: runMetaRef.current.startedAt,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        rerouteCount: finalRerouteCount,
        actualDuration: runMetaRef.current.startedAt
          ? Math.floor((now - new Date(runMetaRef.current.startedAt).getTime()) / 1000)
          : undefined,
      };
      await saveRoute(completedRoute);

      // Tell open tracking pages the run is done so they flip to the
      // thank-you state live instead of waiting for a refresh.
      broadcastRunCompletedRef.current();

      if (onComplete) {
        onComplete();
      }
    },
    onWaypointComplete: (_waypoint, waypoints) => {
      // Persist every completion as it happens (isCompleted + actualArrival),
      // not just the final one — otherwise a reload mid-run lost all progress.
      saveRoute({ ...updatedRoute, ...runMetaRef.current, waypoints }).catch(error => {
        console.error('Failed to save waypoint completion:', error);
      });
    },
    voiceEnabled,
    locationEnabled,
  });

  // Keep screen awake during navigation (only when user has enabled the toggle)
  const { isSupported: wakeLockSupported } = useWakeLock(
    navigationState.isNavigating && keepScreenOn
  );

  // Broadcast location updates for real-time tracking
  const {
    isOnline,
    viewerCount,
    viewerPins,
    broadcastRunCompleted,
    broadcastRunStatus,
    broadcastHealth,
    lastSuccessfulBroadcastAt,
  } = useLocationBroadcast({
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
  broadcastRunCompletedRef.current = broadcastRunCompleted;

  // Stable identity so NavigationMap's layer effect doesn't run every GPS tick.
  const viewerCells = useMemo(() => viewerPins?.cells ?? [], [viewerPins]);

  // Start navigation once the user has granted the location tap, and mark
  // the route as active. Gated on locationEnabled rather than firing on
  // mount so the geolocation request carries the tap's user gesture.
  useEffect(() => {
    if (locationEnabled && !hasStarted) {
      startNavigation();

      // Update route status to active — only if it isn't already, so
      // resuming an in-progress run (e.g. after a reload) doesn't reset
      // startedAt or re-trigger a status write.
      if (route.status !== 'active') {
        const activeRoute = {
          ...route,
          status: 'active' as const,
          startedAt: new Date().toISOString(),
        };
        runMetaRef.current = { status: 'active', startedAt: activeRoute.startedAt };
        saveRoute(activeRoute).catch(error => {
          console.error('Failed to update route status:', error);
        });
      }

      setHasStarted(true);
    }
  }, [locationEnabled, hasStarted, startNavigation, route, saveRoute]);

  const handleEnableLocation = useCallback(() => {
    // Unlock speechSynthesis synchronously inside this tap's call stack — iOS
    // Safari only allows the API to produce audio the first time when it's
    // invoked directly from a user gesture, not from a later async effect.
    voiceService.unlock();
    setLocationEnabled(true);
  }, []);

  // Skip the tap gate when permission is already resolved — e.g. the
  // "Navigate" button that brought the user here already primed the
  // request within its own click gesture (see primeGeolocationPermission).
  useEffect(() => {
    if (!locationEnabled && (permission === 'granted' || permission === 'denied')) {
      setLocationEnabled(true);
    }
  }, [locationEnabled, permission]);

  const handleStopNavigation = useCallback(() => {
    stopNavigation();
    if (onExit) {
      onExit();
    } else {
      window.history.back();
    }
  }, [stopNavigation, onExit]);

  const handleToggleVoice = useCallback(() => {
    // Also unlock on the voice toggle tap — a driver who starts with voice
    // off and switches it on mid-run needs the same gesture-bound unlock.
    voiceService.unlock();
    setVoiceEnabled(v => !v);
  }, []);

  // Pause/resume: a temporary hold the public sees ("back shortly"), without
  // stopping local navigation or GPS.
  const [isPaused, setIsPaused] = useState(false);
  const handleTogglePause = useCallback(() => {
    const next = !isPaused;
    setIsPaused(next);
    broadcastRunStatus(next ? 'paused' : 'active');
  }, [isPaused, broadcastRunStatus]);

  // Emergency stop: the truck has been called away (e.g. a real callout). Tell
  // viewers explicitly, then leave navigation. Guarded by a confirm because it
  // ends the public run.
  const handleEmergencyStop = useCallback(() => {
    const ok = window.confirm(
      'End the run now and tell everyone Santa has been called away? Use this if the truck has to leave for an emergency.',
    );
    if (!ok) return;
    broadcastRunStatus('aborted', 'Santa has been called away to help. We’ll share a new time as soon as we can.');
    handleStopNavigation();
  }, [broadcastRunStatus, handleStopNavigation]);

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
    onToggleVoice: handleToggleVoice,
    onNextWaypoint: handleSkipToNext,
    isNavigating: navigationState.isNavigating,
  });

  // Only block navigation entirely for a permission denial, or when we've
  // never received a single position fix. Any other transient GPS error
  // (timeout, temporary unavailability) while we already have a last-known
  // position keeps navigating and shows a small non-blocking strip instead —
  // a truck under tree cover shouldn't have its whole screen replaced by an
  // error every time a fix times out.
  const hasPosition = position !== null;
  const isPermissionDenied = permission === 'denied' || locationError?.code === 1;
  const showBlockingLocationError = isPermissionDenied || (!hasPosition && locationError !== null);

  // Hint shown on the loading screen if no fix has arrived after a while.
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  useEffect(() => {
    if (hasPosition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowLoadingHint(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingHint(true), LOADING_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasPosition]);

  // Require an explicit tap before requesting location. iOS Safari denies
  // geolocation requests made outside a user gesture without ever showing
  // the native permission prompt, so we can't request this on mount.
  if (!locationEnabled) {
    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.icon}>📍</div>
        <h2 style={screenStyles.heading}>Enable Location</h2>
        <p style={screenStyles.body}>
          Navigation needs your location to guide the run. Tap below and allow access when your
          device asks.
        </p>
        {sessionExpiresSoon && (
          <div role="alert" style={screenStyles.sessionWarning}>
            {sessionRemainingMs !== null && sessionRemainingMs <= 0
              ? 'Your sign-in has expired, so the public can’t see Santa. Sign in again before starting.'
              : `Your sign-in expires in ${formatRemaining(sessionRemainingMs ?? 0)}. Sign in again now so broadcasting doesn’t stop partway through the run.`}
            <button
              type="button"
              onClick={() => {
                clearStoredToken();
                const returnUrl = `${location.pathname}${location.search}${location.hash}`;
                navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
              }}
              style={screenStyles.sessionButton}
            >
              Sign in again
            </button>
          </div>
        )}
        <button onClick={handleEnableLocation} style={screenStyles.primaryButton}>
          Enable Location &amp; Start
        </button>
      </div>
    );
  }

  // Blocking location error — permission denied, or no fix has ever arrived.
  if (showBlockingLocationError) {
    const message = isPermissionDenied
      ? 'Navigation requires access to your device location. Please enable location permissions in your browser settings and reload the page.'
      : locationError?.code === 2
      ? 'Unable to determine your location. Please check your device settings and try again.'
      : 'Location request timed out and no position has been found yet. Please check your device settings and try again.';

    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.icon}>{isPermissionDenied ? '🚫' : '📍'}</div>
        <h2 style={{ ...screenStyles.heading, color: 'var(--santa-red)' }}>
          {isPermissionDenied ? 'Location Permission Denied' : 'Location Access Required'}
        </h2>
        <p style={screenStyles.body}>{message}</p>
        <button onClick={handleStopNavigation} style={screenStyles.dangerButton}>
          Exit Navigation
        </button>
      </div>
    );
  }

  // Loading state — waiting for the first GPS fix.
  if (!position || !updatedRoute.geometry) {
    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.icon}>🎅</div>
        <div style={screenStyles.loadingTitle}>Starting Navigation</div>
        <div style={screenStyles.body}>Getting your location...</div>
        {showLoadingHint && (
          <p style={{ ...screenStyles.body, fontSize: '0.875rem', marginTop: '-0.5rem' }}>
            Still waiting on a GPS fix. Check that location access is allowed and you have a clear
            view of the sky, or exit and try again.
          </p>
        )}
        <button onClick={handleStopNavigation} style={screenStyles.dangerButton}>
          Exit
        </button>
      </div>
    );
  }

  // Transient GPS trouble while we still have a last-known position — a
  // small strip under the header, not a blocking screen.
  const showWeakGpsStrip = locationError !== null && !showBlockingLocationError;

  return (
    <div
      className="full-viewport"
      style={{
        position: 'relative',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      {/* Full-screen Map */}
      <NavigationMap
        route={updatedRoute}
        userPosition={position}
        completedWaypointIds={navigationState.completedWaypointIds}
        viewerCells={viewerCells}
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

      {/* Banner stack — directly under the header, single column so nothing
          overlaps it. Off-route first, then broadcast health. */}
      <div style={bannerStackStyles.stack}>
        {showWeakGpsStrip && (
          <div role="status" aria-live="polite" style={bannerStackStyles.weakGpsStrip}>
            <span aria-hidden="true">📡</span>
            Weak GPS signal — using last known position
          </div>
        )}
        <OffRouteBanner
          isVisible={navigationState.showOffRouteBanner}
          isRerouting={navigationState.isRerouting}
          onReroute={reroute}
          onDismiss={dismissOffRouteBanner}
        />
        <BroadcastHealthBanner
          broadcastHealth={broadcastHealth}
          lastSuccessfulBroadcastAt={lastSuccessfulBroadcastAt}
        />
      </div>

      {/* Control rail — voice / keep-screen-on / pause / emergency-stop, one
          column so nothing overlaps the header or each other. */}
      <div style={controlRailStyles.rail}>
        <button
          onClick={handleToggleVoice}
          style={controlRailStyles.button}
          aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </button>

        {wakeLockSupported ? (
          <button
            onClick={() => setKeepScreenOn(!keepScreenOn)}
            style={{
              ...controlRailStyles.button,
              backgroundColor: keepScreenOn ? 'rgba(251, 192, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            }}
            aria-label={keepScreenOn ? 'Disable keep screen on' : 'Enable keep screen on'}
            aria-pressed={keepScreenOn}
          >
            {keepScreenOn ? '☀️' : '🌙'}
          </button>
        ) : (
          <div style={controlRailStyles.warningPill}>⚠️ Keep screen on manually</div>
        )}

        <button
          onClick={handleTogglePause}
          style={{
            ...controlRailStyles.button,
            backgroundColor: isPaused ? 'rgba(67, 160, 71, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          }}
          aria-label={isPaused ? 'Resume run for viewers' : 'Pause run for viewers'}
          aria-pressed={isPaused}
        >
          {isPaused ? '▶️' : '⏸️'}
        </button>

        <button
          onClick={handleEmergencyStop}
          style={{ ...controlRailStyles.button, backgroundColor: 'rgba(211, 47, 47, 0.95)' }}
          aria-label="Emergency stop — Santa called away"
        >
          🚨
        </button>
      </div>

      {/* Paused indicator for the operator, so it's obvious viewers see a hold. */}
      {isPaused && (
        <div role="status" aria-live="polite" style={bannerStackStyles.pausedPill}>
          ⏸️ Paused — viewers see “back shortly”
        </div>
      )}

      {/* Floating Bottom Panel */}
      <NavigationPanel
        nextWaypoint={navigationState.nextWaypoint}
        distanceToWaypoint={navigationState.distanceToNextWaypoint}
        eta={navigationState.etaToNextWaypoint}
        scheduleVarianceMinutes={navigationState.scheduleVarianceMinutes}
        routeProgress={navigationState.routeProgress}
        canCompleteWaypoint={canCompleteWaypoint || false}
        onCompleteWaypoint={handleCompleteWaypoint}
        onSkipToNext={handleSkipToNext}
        onStopNavigation={handleStopNavigation}
        completedWaypoints={navigationState.completedWaypointIds.length}
        totalWaypoints={updatedRoute.waypoints.length}
        waypoints={updatedRoute.waypoints}
        viewerCount={viewerCount}
        waitingCount={viewerPins?.total ?? null}
        rerouteCount={navigationState.rerouteCount}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — festive but clean, using the app's design tokens rather than raw
// hex, so this page follows the same look as the rest of the app.
// ---------------------------------------------------------------------------

const screenStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '2rem 1.5rem',
    textAlign: 'center',
    background: 'linear-gradient(180deg, var(--paper) 0%, var(--sand-light, var(--paper)) 100%)',
    gap: '0.25rem',
  },
  icon: { fontSize: '48px', marginBottom: '0.5rem' },
  heading: {
    color: 'var(--ink)',
    fontFamily: 'var(--font-heading)',
    marginBottom: '0.5rem',
  },
  loadingTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--ink)',
    fontFamily: 'var(--font-heading)',
    marginBottom: '0.25rem',
  },
  body: {
    color: 'var(--slate-500)',
    marginBottom: '1rem',
    maxWidth: '400px',
  },
  primaryButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '1rem',
    fontWeight: 700,
    border: 'none',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, var(--christmas-green) 0%, var(--christmas-green-dark) 100%)',
    color: 'var(--snow)',
    boxShadow: 'var(--ui-shadow)',
    minHeight: TOUCH_TARGET.recommended,
  },
  sessionWarning: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    maxWidth: '400px',
    marginBottom: '1.25rem',
    padding: '0.875rem 1rem',
    borderRadius: 'var(--border-radius-md)',
    background: 'var(--summer-gold)',
    color: 'var(--summer-gold-ink)',
    fontWeight: 600,
    fontSize: '0.9375rem',
  },
  sessionButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.9375rem',
    fontWeight: 700,
    border: 'none',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    background: 'var(--summer-gold-ink)',
    color: 'var(--summer-gold)',
    minHeight: TOUCH_TARGET.recommended,
  },
  dangerButton: {
    padding: '0.875rem 1.75rem',
    fontSize: '1rem',
    fontWeight: 700,
    border: 'none',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, var(--santa-red) 0%, var(--santa-red-dark) 100%)',
    color: 'var(--snow)',
    boxShadow: 'var(--ui-shadow)',
    minHeight: TOUCH_TARGET.recommended,
  },
};

// Below the header (which sits at top: 1rem with an ~80px content area plus
// padding — roughly 8rem of clearance) so banners never sit under it.
const BANNER_STACK_TOP = '8rem';

const bannerStackStyles: Record<string, React.CSSProperties> = {
  stack: {
    position: 'absolute',
    top: BANNER_STACK_TOP,
    left: '1rem',
    right: '1rem',
    zIndex: Z_INDEX.errorMessage,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  weakGpsStrip: {
    backgroundColor: 'var(--surface-warning)',
    color: 'var(--text-warning-strong)',
    padding: '0.5rem 0.875rem',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    boxShadow: 'var(--ui-shadow-soft)',
  },
  pausedPill: {
    position: 'absolute',
    top: BANNER_STACK_TOP,
    left: '1rem',
    backgroundColor: 'rgba(255, 167, 38, 0.97)',
    color: '#3E2723',
    padding: '0.4rem 0.9rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    zIndex: Z_INDEX.floatingButton,
    boxShadow: 'var(--ui-shadow)',
  },
};

// A single right-side column, starting below the header, so the voice /
// screen / pause / stop controls never overlap the header or each other
// (they previously sat at separate hard-coded top offsets that collided at
// small screen heights).
const controlRailStyles: Record<string, React.CSSProperties> = {
  rail: {
    position: 'absolute',
    top: BANNER_STACK_TOP,
    right: '1rem',
    zIndex: Z_INDEX.floatingButton,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  button: {
    width: TOUCH_TARGET.recommended,
    height: TOUCH_TARGET.recommended,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'var(--ui-shadow)',
    cursor: 'pointer',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningPill: {
    maxWidth: '108px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    color: 'white',
    padding: '0.5rem 0.6rem',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: '0.7rem',
    textAlign: 'center',
    boxShadow: 'var(--ui-shadow)',
  },
};
