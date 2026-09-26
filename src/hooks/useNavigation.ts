/**
 * Custom hook for managing turn-by-turn navigation state
 * Handles location tracking, instruction updates, rerouting, and waypoint completion
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGeolocation } from './useGeolocation';
import type { Route, Waypoint } from '../types';
import {
  findNextWaypoint,
  calculateRouteProgress,
  calculateETA,
  formatETA,
  isNearWaypoint,
  calculateDistance,
  computeCumulativeDistances,
  computeStepAlongDistances,
  projectOntoRoute,
  findCurrentStep,
  updateSmoothedSpeed,
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

/** Off-route debounce/reroute thresholds. GPS jitter near a route line (tree
 *  cover, urban canyons) routinely reads 20–60m off for a fix or two; without
 *  debouncing that flickered the banner and could trigger spurious reroutes. */
const OFF_ROUTE_ENTER_METERS = 60;
const OFF_ROUTE_CLEAR_METERS = 40;
const OFF_ROUTE_CONSECUTIVE_FIXES = 3;
const OFF_ROUTE_DEBOUNCE_MS = 8_000;
const AUTO_REROUTE_AFTER_MS = 15_000;
const MIN_MS_BETWEEN_REROUTES = 30_000;

/** Realistic fallback speed for a Santa run when GPS speed is unavailable or
 *  the truck is stationary — well below the generic "urban" default, which
 *  produced wildly optimistic ETAs for a walking-pace parade route. */
const FALLBACK_SPEED_KMH = 15;

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
  /** Fired once when the run completes; `finalRoute` includes the very last
   *  waypoint's completion (unlike reading the hook's own `updatedRoute`
   *  from the same render, which can be one render behind the state update
   *  that triggered this callback). */
  onRouteComplete?: (rerouteCount: number, finalRoute: Route) => void;
  /** Fired for every waypoint completion (auto-arrival or manual skip), with
   *  the full up-to-date waypoints array so callers can persist without
   *  reconstructing it from a possibly-stale route reference. */
  onWaypointComplete?: (waypoint: Waypoint, waypoints: Waypoint[]) => void;
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

  const [isNavigating, setIsNavigating] = useState(
    () => route.status === 'active',
  );
  const [isRerouting, setIsRerouting] = useState(false);
  // Seeded from any waypoints already marked completed (e.g. resuming after a
  // page reload mid-run) rather than always starting empty.
  const [completedWaypointIds, setCompletedWaypointIds] = useState<string[]>(
    () => route.waypoints.filter(wp => wp.isCompleted).map(wp => wp.id),
  );
  const [updatedRoute, setUpdatedRoute] = useState<Route>(route);
  const [rerouteCount, setRerouteCount] = useState(0);
  const [isOffRouteDebounced, setIsOffRouteDebounced] = useState(false);
  const [offRouteBannerDismissed, setOffRouteBannerDismissed] = useState(false);

  // Per-step voice de-duplication: a step gets at most one "approach"
  // announcement (spoken once when first within range) and one "now"
  // announcement (within ~40m). Sets rather than a single "last step" marker so
  // GPS jitter that flips findCurrentStep between adjacent steps can't re-trigger
  // an announcement. Cleared on start and after a reroute (steps change).
  const announcedApproachStepsRef = useRef<Set<number>>(new Set());
  const announcedImminentStepsRef = useRef<Set<number>>(new Set());
  const lastAnnouncedWaypointRef = useRef<string | null>(null);
  const waypointCompletionQueueRef = useRef<Set<string>>(new Set());
  // Frozen plan-time estimated arrival per waypoint id, captured at navigation
  // start. The live ETA recalc overwrites waypoint.estimatedArrival, so the
  // schedule-variance indicator must compare against this immutable baseline.
  // Held in state (not a ref) so it can be read safely during render.
  const [plannedArrivals, setPlannedArrivals] = useState<Map<string, string>>(new Map());

  // Monotonic along-route progress, carried between GPS ticks so a looping
  // route that revisits an intersection resolves to the current pass rather
  // than snapping back to an earlier one. Committed in an effect (not during
  // render) so reading it while computing this tick's match stays pure.
  const lastAlongRouteDistanceRef = useRef<number | null>(null);

  // Smoothed (EMA) GPS speed in m/s, used for ETAs instead of the raw,
  // jittery instantaneous reading. Committed in an effect, read during render.
  const smoothedSpeedRef = useRef<number | null>(null);

  // Off-route debounce bookkeeping.
  const offRouteConsecutiveRef = useRef(0);
  const offRouteSinceRef = useRef<number | null>(null); // when the current off-route run started
  const offRouteConfirmedAtRef = useRef<number | null>(null); // when isOffRouteDebounced last became true
  const lastRerouteAtRef = useRef<number>(0);

  // Latest route/position, for the ETA interval effect below — read from a
  // ref rather than a dependency so the interval isn't torn down and rebuilt
  // on every GPS tick.
  const updatedRouteRef = useRef(updatedRoute);
  useEffect(() => {
    updatedRouteRef.current = updatedRoute;
  }, [updatedRoute]);

  // Configure voice settings
  useEffect(() => {
    voiceService.updateSettings({
      enabled: voiceEnabled,
      language: 'en-AU'
    });
  }, [voiceEnabled]);

  // Precomputed ONCE per route geometry/steps (route load, reroute) — not per
  // GPS tick. This is the whole point of the along-route approach: the
  // expensive walk over every vertex/maneuver happens only when the route
  // actually changes shape.
  const cumulativeDistances = useMemo(
    () => (updatedRoute.geometry ? computeCumulativeDistances(updatedRoute.geometry.coordinates) : []),
    [updatedRoute.geometry],
  );
  const stepAlongDistances = useMemo(
    () =>
      updatedRoute.geometry && updatedRoute.navigationSteps
        ? computeStepAlongDistances(updatedRoute.geometry, updatedRoute.navigationSteps, cumulativeDistances)
        : [],
    [updatedRoute.geometry, updatedRoute.navigationSteps, cumulativeDistances],
  );

  // The single per-tick projection: one call to projectOntoRoute, reused for
  // the current step/instruction, distance-to-maneuver, route progress AND
  // off-route distance — rather than each of those re-walking the route.
  const match = useMemo(() => {
    if (!position || !updatedRoute.geometry || cumulativeDistances.length < 2) {
      return null;
    }
    // Read the along-route distance committed from the PREVIOUS tick (see the
    // commit effect below) to anchor this tick's search window; never mutated here.
    const projection = projectOntoRoute(
      position.coordinates,
      updatedRoute.geometry,
      cumulativeDistances,
      lastAlongRouteDistanceRef.current,
    );
    const { stepIndex, distanceToManeuver } =
      stepAlongDistances.length > 0
        ? findCurrentStep(projection.alongRouteDistance, stepAlongDistances)
        : { stepIndex: 0, distanceToManeuver: 0 };
    const totalRouteLength = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
    const routeProgress = calculateRouteProgress(projection.alongRouteDistance, totalRouteLength);

    return { projection, stepIndex, distanceToManeuver, routeProgress };
  }, [position, updatedRoute.geometry, cumulativeDistances, stepAlongDistances]);

  // Commit the monotonic along-route progress ref after render, so the next
  // tick's projection window is anchored on it. Doing this in an effect (not
  // during the useMemo above) keeps that computation pure.
  useEffect(() => {
    if (match) {
      lastAlongRouteDistanceRef.current = match.projection.alongRouteDistance;
    }
  }, [match]);

  // Smooth GPS speed via EMA, ignoring null/near-zero readings (stopped at a
  // stop, waiting at lights) so a brief pause doesn't collapse the estimate.
  useEffect(() => {
    if (!position) return;
    smoothedSpeedRef.current = updateSmoothedSpeed(smoothedSpeedRef.current, position.speed);
  }, [position]);

  // Calculate navigation state from position (derived state, no setState in effect)
  const navigationState = useMemo<NavigationState>(() => {
    if (!isNavigating || !position || !updatedRoute.geometry || !updatedRoute.navigationSteps || !match) {
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
    const { stepIndex, distanceToManeuver, routeProgress } = match;
    const currentStep = steps[stepIndex];

    // Find next waypoint
    const nextWaypoint = findNextWaypoint(updatedRoute.waypoints);
    const distanceToNextWaypoint = nextWaypoint
      ? calculateDistance(userLocation, nextWaypoint.coordinates)
      : 0;

    // ETA uses the smoothed speed (falls back to a realistic Santa-run crawl
    // speed, not a generic urban default) rather than the raw, jittery GPS
    // speed reading.
    // Read-only: the smoothed speed is committed from an effect (see above), never mutated here.
    const eta = nextWaypoint
      ? calculateETA(distanceToNextWaypoint, smoothedSpeedRef.current, FALLBACK_SPEED_KMH)
      : null;

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
      routeProgress,
      isOffRoute: isOffRouteDebounced,
      isRerouting,
      completedWaypointIds,
      showOffRouteBanner: isOffRouteDebounced && !offRouteBannerDismissed && !isRerouting,
      rerouteCount,
    };
  }, [isNavigating, position, updatedRoute, isRerouting, completedWaypointIds, rerouteCount, plannedArrivals, match, isOffRouteDebounced, offRouteBannerDismissed]);

  // Start navigation
  const startNavigation = useCallback(() => {
    setIsNavigating(true);
    announcedApproachStepsRef.current.clear();
    announcedImminentStepsRef.current.clear();
    lastAnnouncedWaypointRef.current = null;

    // Freeze the planned schedule so we can measure ahead/behind against it.
    const planned = new Map<string, string>();
    for (const wp of updatedRoute.waypoints) {
      if (wp.estimatedArrival) planned.set(wp.id, wp.estimatedArrival);
    }
    setPlannedArrivals(planned);

    // Announce the first instruction (not just a generic "Navigation
    // started") so the driver has something actionable straight away.
    if (voiceEnabled) {
      const firstInstruction = updatedRoute.navigationSteps?.[0]?.instruction;
      const text = firstInstruction ? `Navigation started. ${firstInstruction}` : 'Navigation started';
      voiceService.speak(text, 'high').catch(() => {
        // Ignore voice errors
      });
    }
  }, [voiceEnabled, updatedRoute]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    voiceService.cancel();
  }, []);

  // Dismiss the off-route banner without rerouting. Auto-resets once the
  // driver is back on route (see the debounce effect below).
  const dismissOffRouteBanner = useCallback(() => {
    setOffRouteBannerDismissed(true);
  }, []);

  // Mark waypoint as completed
  const completeWaypoint = useCallback((waypointId: string) => {
    const waypoint = updatedRoute.waypoints.find(wp => wp.id === waypointId);
    if (!waypoint || waypoint.isCompleted) return;

    const actualArrival = new Date().toISOString();
    const completedWaypoint = { ...waypoint, isCompleted: true, actualArrival };
    // Computed directly (not read back from state) so it's available
    // synchronously for the completion callbacks below — reading the state
    // setter's own updater result isn't possible, and re-deriving from
    // `updatedRoute` after the setState call would still be the pre-update
    // snapshot until the next render.
    const newWaypoints = updatedRoute.waypoints.map(wp =>
      wp.id === waypointId ? completedWaypoint : wp,
    );

    setUpdatedRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp => (wp.id === waypointId ? { ...wp, isCompleted: true, actualArrival } : wp)),
    }));
    setCompletedWaypointIds(prev => (prev.includes(waypointId) ? prev : [...prev, waypointId]));

    onWaypointComplete?.(completedWaypoint, newWaypoints);

    // Announce completion
    if (voiceEnabled && lastAnnouncedWaypointRef.current !== waypointId) {
      voiceService.speak(announceWaypointArrival(waypoint.name), 'high').catch(() => {
        // Ignore voice errors
      });
      lastAnnouncedWaypointRef.current = waypointId;
    }

    // Check if this completion was the last outstanding waypoint
    const allCompleted = newWaypoints.every(wp => wp.isCompleted);
    if (allCompleted) {
      setIsNavigating(false);
      if (voiceEnabled) {
        voiceService.speak(announceRouteComplete(), 'high').catch(() => {
          // Ignore voice errors
        });
      }
      // Pass the final route WITH this last waypoint's completion — reading
      // `updatedRoute` from this closure would miss it, since the setState
      // above hasn't been applied yet.
      onRouteComplete?.(rerouteCount, { ...updatedRoute, waypoints: newWaypoints });
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
      }

      // Get remaining waypoints (not completed)
      const remainingWaypoints = updatedRoute.waypoints.filter(wp => !wp.isCompleted);
      const coordinates = [
        position.coordinates,
        ...remainingWaypoints.map(wp => wp.coordinates),
      ];

      // Get new route from current position to remaining waypoints
      const newDirections = await getDirections(coordinates);

      // Recalculate ETAs for remaining waypoints based on current time. The
      // index must be into the FULL waypoints array (what calculateRealTimeETAs
      // indexes into), not into `remainingWaypoints` — indexing the filtered
      // list into the full one always pointed at the wrong waypoint.
      const firstRemaining = remainingWaypoints[0];
      const currentWaypointIndex = firstRemaining
        ? updatedRoute.waypoints.findIndex(wp => wp.id === firstRemaining.id)
        : updatedRoute.waypoints.length;
      const updatedWaypointsWithETAs = calculateRealTimeETAs(
        {
          ...updatedRoute,
          geometry: newDirections.geometry,
          navigationSteps: newDirections.steps,
        },
        currentWaypointIndex,
        new Date(),
        smoothedSpeedRef.current ?? undefined
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

      // New geometry means new steps/along-route distances — reset the
      // monotonic progress ref and per-step voice de-dup so the rerouted
      // instructions match and are announced.
      lastAlongRouteDistanceRef.current = null;
      announcedApproachStepsRef.current.clear();
      announcedImminentStepsRef.current.clear();

      // Increment reroute count and log event
      setRerouteCount(prev => prev + 1);

      setIsRerouting(false);
    } catch (error) {
      console.error('Rerouting failed:', error);
      setIsRerouting(false);
    }
  }, [position, navigationState.nextWaypoint, updatedRoute, voiceEnabled, isRerouting]);

  // Off-route debounce + rate-limited auto-reroute. Runs once per GPS tick
  // (whenever the per-tick projection changes). A route is only considered
  // off-route after ~8s continuously off, or 3 consecutive fixes >60m off —
  // GPS jitter near the route line otherwise flickers the banner. It clears
  // as soon as a fix comes back within 40m (hysteresis band between 40–60m is
  // left alone in either direction to avoid flapping at the boundary).
  useEffect(() => {
    if (!isNavigating || !match) return;

    const rawOffRoute = match.projection.offRouteDistance;
    const now = Date.now();

    if (rawOffRoute <= OFF_ROUTE_CLEAR_METERS) {
      offRouteConsecutiveRef.current = 0;
      offRouteSinceRef.current = null;
      offRouteConfirmedAtRef.current = null;
      if (isOffRouteDebounced) {
        // Syncing debounced off-route state to GPS ticks, which aren't React state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOffRouteDebounced(false);
        setOffRouteBannerDismissed(false); // auto-reset dismissal once back on route
      }
      return;
    }

    if (rawOffRoute > OFF_ROUTE_ENTER_METERS) {
      if (offRouteConsecutiveRef.current === 0) {
        offRouteSinceRef.current = now;
      }
      offRouteConsecutiveRef.current += 1;
    }
    // Between the clear and enter thresholds: leave counters as-is (hysteresis).

    const elapsedSinceEntered = offRouteSinceRef.current !== null ? now - offRouteSinceRef.current : 0;
    const shouldBeOffRoute =
      offRouteConsecutiveRef.current >= OFF_ROUTE_CONSECUTIVE_FIXES || elapsedSinceEntered >= OFF_ROUTE_DEBOUNCE_MS;

    if (shouldBeOffRoute && !isOffRouteDebounced) {
      setIsOffRouteDebounced(true);
      offRouteConfirmedAtRef.current = now;
    }

    // Auto-reroute after being confirmed off-route for ~15s, unless the
    // driver dismissed the banner, rate-limited to one reroute per 30s.
    if (
      shouldBeOffRoute &&
      !offRouteBannerDismissed &&
      !isRerouting &&
      offRouteConfirmedAtRef.current !== null &&
      now - offRouteConfirmedAtRef.current >= AUTO_REROUTE_AFTER_MS &&
      now - lastRerouteAtRef.current >= MIN_MS_BETWEEN_REROUTES
    ) {
      lastRerouteAtRef.current = now;
      reroute();
    }
  }, [match, isNavigating, isOffRouteDebounced, offRouteBannerDismissed, isRerouting, reroute]);

  // Voice announcements + waypoint auto-completion.
  useEffect(() => {
    if (!isNavigating || !position || !updatedRoute.navigationSteps) {
      return;
    }

    const { currentStepIndex, distanceToNextManeuver, currentInstruction, nextWaypoint } = navigationState;
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
  }, [isNavigating, position, updatedRoute, voiceEnabled, navigationState, completedWaypointIds, completeWaypoint]);

  // Periodically update ETAs during navigation (every 30 seconds). Reads the
  // latest route/speed from refs rather than depending on them directly, so
  // the interval itself is created once per navigation session instead of
  // being torn down and recreated on every GPS tick (which meant it never
  // actually got 30s to fire before).
  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    const updateETAs = () => {
      const currentRoute = updatedRouteRef.current;
      if (!currentRoute.navigationSteps || currentRoute.navigationSteps.length === 0) return;

      const nextWaypoint = findNextWaypoint(currentRoute.waypoints);
      if (!nextWaypoint) return;

      const currentWaypointIndex = currentRoute.waypoints.findIndex(wp => wp.id === nextWaypoint.id);

      const updatedWaypointsWithETAs = calculateRealTimeETAs(
        currentRoute,
        currentWaypointIndex,
        new Date(),
        smoothedSpeedRef.current ?? undefined
      );

      setUpdatedRoute(prev => ({
        ...prev,
        waypoints: updatedWaypointsWithETAs,
      }));
    };

    const intervalId = setInterval(updateETAs, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isNavigating]);

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
