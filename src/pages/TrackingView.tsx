/**
 * TrackingView page
 * Public real-time Santa tracking interface
 * No authentication required - accessible via shareable link
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWebPubSub, useReverseGeocode } from '../hooks';
import { ShareModal, SEO, CountdownTimer, ThankYouOverlay } from '../components';
import { MAPBOX_CONFIG } from '../config/mapbox';
import mapboxgl from 'mapbox-gl';
import { storageAdapter } from '../storage';
import type { Route, LocationBroadcast } from '../types';
import { formatDistance, getDirections } from '../utils/mapbox';
import { calculateDistance, alongPathDistance } from '../utils/navigation';
import { isPushSupported, getServerPublicKey, subscribeToRunStart, hasSubscribedToRoute } from '../utils/push';
import { DEMO_ROUTE, startDemoSimulator } from '../utils/demoRoute';
import 'mapbox-gl/dist/mapbox-gl.css';

/** Fallback parade pace when the truck isn't reporting speed: ~12 km/h. */
const DEFAULT_PARADE_SPEED_MS = 3.4;

export interface TrackingViewProps {
  routeId: string;
  /** Simulated demo run: baked-in route + scripted Santa, no backend. */
  demo?: boolean;
}

/**
 * Format "2026-12-24" + "19:30" as "Thu 24 Dec • 7:30 pm". Falls back to the
 * raw values if either part doesn't parse.
 */
function formatRunDateTime(date: string, startTime: string): string {
  const parsed = new Date(`${date}T${startTime || '00:00'}`);
  if (Number.isNaN(parsed.getTime())) return `${date} • ⏰ ${startTime}`;
  const day = parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} • ⏰ ${time}`;
}

/** Escape user-provided text before interpolating into popup HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function TrackingView({ routeId, demo = false }: TrackingViewProps) {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LocationBroadcast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  // Highest waypoint index Santa has passed, from live broadcasts — lets the
  // progress bar and markers update in real time without refetching the route.
  const [liveWaypointIndex, setLiveWaypointIndex] = useState(0);
  // Whether the camera follows Santa. Panning/zooming the map pauses following;
  // a floating button lets the viewer re-engage.
  const [isFollowing, setIsFollowing] = useState(true);
  const isFollowingRef = useRef(true);
  // Track which routeId the countdown has completed for, so the "It's time!"
  // message naturally resets when navigating to a different route — no effect needed.
  const [completedForRouteId, setCompletedForRouteId] = useState<string | null>(null);
  const countdownComplete = completedForRouteId === routeId;
  // Bottom info sheet: expanded by default, collapsible so the map stays king.
  const [panelOpen, setPanelOpen] = useState(true);
  // Fallback path fetched client-side when a route was published without a
  // planned path (straight lines as a last resort), so viewers always see the
  // path Santa will take between stops — not just the stops.
  const [fetchedGeometry, setFetchedGeometry] = useState<GeoJSON.LineString | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // The path drawn on the map: stored geometry wins, fallback otherwise.
  const displayGeometry = route?.geometry ?? fetchedGeometry;

  // "My spot": the viewer's own location pin for a personal Santa ETA.
  const [viewerPin, setViewerPin] = useState<[number, number] | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  // "Notify me": web push before the run starts. Key stays null when the
  // deployment has no VAPID keys or the browser lacks push — UI hides itself.
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [notifyState, setNotifyState] = useState<'idle' | 'busy' | 'done'>(
    () => (hasSubscribedToRoute(routeId) ? 'done' : 'idle'),
  );
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const santaMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkerElsRef = useRef<HTMLDivElement[]>([]);
  const lastLocationRef = useRef<[number, number] | null>(null);

  // Fetch route data via the public, unauthenticated lookup — viewers of
  // /track/:id are anonymous members of the community, not brigade members.
  // NOTE: this component is mounted with key={routeId} (see App.tsx), so all
  // per-route view state resets naturally when navigating between runs.
  useEffect(() => {
    if (demo) {
      // Demo mode: baked-in sample route, no backend round-trip.
      setRoute(DEMO_ROUTE);
      setError(null);
      setLoading(false);
      return;
    }
    storageAdapter
      .getPublicRoute(routeId)
      .then((r) => {
        if (r) {
          setRoute(r);
          setError(null);
        } else {
          setError('Route not found');
        }
      })
      .catch((err) => {
        console.error('Failed to fetch route:', err);
        setError('Failed to load route');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [routeId, demo]);

  // Resolve a fallback path when the stored route has none: Mapbox Directions
  // → straight lines between stops. Routes are often published without an
  // explicit "Plan Route" step, and watching Santa travel between stops is the
  // whole point of sharing — so never show a bare scatter of waypoints.
  useEffect(() => {
    if (!route || route.geometry || route.waypoints.length < 2) return;

    let cancelled = false;
    const coords = route.waypoints.map((w) => w.coordinates);
    getDirections(coords)
      .then((directions) => {
        if (!cancelled) setFetchedGeometry(directions.geometry);
      })
      .catch(() => {
        // Directions unavailable (offline, quota, token) — draw straight
        // segments so viewers still see the run's shape.
        if (!cancelled) setFetchedGeometry({ type: 'LineString', coordinates: coords });
      });
    return () => {
      cancelled = true;
    };
  }, [route]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !route || mapRef.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Calculate bounds from route waypoints
    const bounds = new mapboxgl.LngLatBounds();
    route.waypoints.forEach((waypoint) => {
      bounds.extend(waypoint.coordinates);
    });

    // Create map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      bounds: bounds,
      fitBoundsOptions: {
        padding: 50,
      },
      ...MAPBOX_CONFIG,
    });

    map.on('load', () => {
      setMapLoaded(true);

      // Add waypoint markers with improved styling
      waypointMarkerElsRef.current = [];
      route.waypoints.forEach((waypoint, index) => {
        const el = document.createElement('div');
        el.className = 'waypoint-marker';
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = waypoint.isCompleted ? 'var(--christmas-green)' : 'var(--summer-gold)';
        el.style.color = 'white';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '16px';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        el.textContent = (index + 1).toString();
        waypointMarkerElsRef.current[index] = el;

        const stopName = escapeHtml(waypoint.name || `Stop ${index + 1}`);
        const stopAddress = waypoint.address ? escapeHtml(waypoint.address) : '';
        new mapboxgl.Marker(el)
          .setLngLat(waypoint.coordinates)
          .setPopup(
            new mapboxgl.Popup({
              offset: 25,
              className: 'festive-popup',
            }).setHTML(
              `<div style="padding: 0.75rem; font-family: var(--font-body);">
                <strong style="color: var(--fire-red); font-size: 1rem;">${stopName}</strong>
                ${stopAddress ? `<br/><small style="color: var(--neutral-700);">${stopAddress}</small>` : ''}
                ${waypoint.isCompleted ? '<br/><span style="color: var(--christmas-green); font-weight: 600;">✓ Completed</span>' : ''}
              </div>`
            )
          )
          .addTo(map);
      });
    });

    // Panning/zooming by the viewer pauses auto-follow so they can explore the
    // route freely without the camera snapping back on the next update.
    const pauseFollowing = () => {
      isFollowingRef.current = false;
      setIsFollowing(false);
    };
    map.on('dragstart', pauseFollowing);
    map.on('wheel', pauseFollowing);
    map.on('pitchstart', pauseFollowing);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      santaMarkerRef.current = null;
      waypointMarkerElsRef.current = [];
      setMapLoaded(false);
    };
  }, [route]);

  // Draw (or update) the route path with candy cane styling — glow, white
  // base, red dashes. Runs whenever the resolved geometry lands, which may be
  // after the map loads when the path is fetched client-side.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !displayGeometry) return;

    const existing = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: displayGeometry,
    };

    if (existing) {
      existing.setData(feature);
      return;
    }

    map.addSource('route', { type: 'geojson', data: feature });

    // 1. Glow layer (bottom) for the magic effect
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#F77F00', // Gold accent
        'line-width': 20,
        'line-blur': 15,
        'line-opacity': 0.5,
      },
    });

    // 2. White base layer (candy cane base)
    map.addLayer({
      id: 'route-base',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 12,
        'line-opacity': 1,
      },
    });

    // 3. Red stripes layer (candy cane effect)
    map.addLayer({
      id: 'route-stripes',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#D62828', // Santa red
        'line-width': 12,
        'line-dasharray': [2, 2],
        'line-opacity': 1,
      },
    });

    // Fit the view to the full path so the run's shape reads immediately —
    // unless Santa is already broadcasting and the camera is on him.
    if (!lastLocationRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      displayGeometry.coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [mapLoaded, displayGeometry]);

  // Live waypoint progress from broadcasts: colour completed stops green.
  useEffect(() => {
    if (!route) return;
    waypointMarkerElsRef.current.forEach((el, index) => {
      if (!el) return;
      const done = route.waypoints[index]?.isCompleted || index < liveWaypointIndex;
      el.style.backgroundColor = done ? 'var(--christmas-green)' : 'var(--summer-gold)';
    });
  }, [route, liveWaypointIndex]);

  // Handle location updates
  const handleLocationUpdate = (location: LocationBroadcast) => {
    // Final message of a run: flip to the thank-you state live. Waypoints are
    // marked done so the summary reflects a finished run.
    if (location.status === 'completed') {
      setRoute(prev => (prev && prev.status !== 'completed'
        ? {
            ...prev,
            status: 'completed',
            completedAt: new Date().toISOString(),
            waypoints: prev.waypoints.map(w => ({ ...w, isCompleted: true })),
          }
        : prev));
      return;
    }

    setCurrentLocation(location);
    if (typeof location.currentWaypointIndex === 'number') {
      // Never go backwards — guards against out-of-order messages.
      setLiveWaypointIndex(prev => Math.max(prev, location.currentWaypointIndex!));
    }

    if (!mapRef.current) return;

    // In archive mode (completed route) do not auto-pan the map
    if (route?.status === 'completed') return;

    lastLocationRef.current = location.location;

    // Update or create Santa marker with bouncing animation
    if (santaMarkerRef.current) {
      santaMarkerRef.current.setLngLat(location.location);
    } else {
      const el = document.createElement('div');
      el.className = 'santa-marker-icon'; // Uses CSS animation for bouncing
      el.style.fontSize = '56px';
      el.style.cursor = 'pointer';
      el.textContent = '🎅';

      const marker = new mapboxgl.Marker(el)
        .setLngLat(location.location)
        .addTo(mapRef.current);

      santaMarkerRef.current = marker;
    }

    // Follow Santa with a smooth animation — unless the viewer took control.
    if (isFollowingRef.current) {
      mapRef.current.easeTo({
        center: location.location,
        zoom: Math.max(mapRef.current.getZoom(), 14),
        duration: 1500,
      });
    }
  };

  // Discover whether this deployment supports push (once per page).
  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;
    getServerPublicKey().then((key) => {
      if (!cancelled) setPushPublicKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotifyMe = useCallback(async () => {
    if (!pushPublicKey) return;
    setNotifyState('busy');
    setNotifyError(null);
    try {
      await subscribeToRunStart(routeId, pushPublicKey);
      setNotifyState('done');
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : 'Could not set up notifications.');
      setNotifyState('idle');
    }
  }, [pushPublicKey, routeId]);

  // Drop / clear the viewer's home pin (🏠) for a personal ETA.
  const setMySpot = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPinError('Location is not available on this device.');
      return;
    }
    setPinBusy(true);
    setPinError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setViewerPin([pos.coords.longitude, pos.coords.latitude]);
        setPinBusy(false);
      },
      () => {
        setPinError("We couldn't get your location — check location permissions and try again.");
        setPinBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const clearMySpot = useCallback(() => {
    setViewerPin(null);
    setPinError(null);
    pinMarkerRef.current?.remove();
    pinMarkerRef.current = null;
  }, []);

  // Keep the 🏠 marker in sync with the pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewerPin) return;
    if (pinMarkerRef.current) {
      pinMarkerRef.current.setLngLat(viewerPin);
      return;
    }
    const el = document.createElement('div');
    el.textContent = '🏠';
    el.style.fontSize = '32px';
    el.style.lineHeight = '1';
    el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))';
    el.setAttribute('aria-hidden', 'true');
    pinMarkerRef.current = new mapboxgl.Marker(el).setLngLat(viewerPin).addTo(map);
  }, [viewerPin]);

  // Personal ETA: distance from Santa to the pin measured along the route path
  // (straight-line lies on looping parade routes), at live speed when the truck
  // reports one, else a typical parade pace.
  const mySpotEta = useMemo(() => {
    if (!viewerPin || !currentLocation || !displayGeometry) return null;
    const along = alongPathDistance(displayGeometry, currentLocation.location, viewerPin);
    const speed = currentLocation.speed && currentLocation.speed > 1 ? currentLocation.speed : DEFAULT_PARADE_SPEED_MS;
    const minutes = Math.max(1, Math.round(along.meters / speed / 60));
    return { ...along, minutes };
  }, [viewerPin, currentLocation, displayGeometry]);

  const resumeFollowing = useCallback(() => {
    isFollowingRef.current = true;
    setIsFollowing(true);
    if (mapRef.current && lastLocationRef.current) {
      mapRef.current.easeTo({
        center: lastLocationRef.current,
        zoom: Math.max(mapRef.current.getZoom(), 14),
        duration: 800,
      });
    }
  }, []);

  // Connect to Web PubSub for real-time updates (skipped in demo mode — the
  // simulator below produces the same messages locally).
  const { isConnected, isConnecting, error: connectionError, viewerCount } = useWebPubSub({
    routeId,
    role: 'viewer',
    onLocationUpdate: handleLocationUpdate,
    enabled: !demo,
  });

  // Demo simulator: march Santa along the displayed path once it resolves.
  // Routed through a ref so the interval always calls the latest closure.
  const handleLocationUpdateRef = useRef(handleLocationUpdate);
  handleLocationUpdateRef.current = handleLocationUpdate;
  useEffect(() => {
    if (!demo || !displayGeometry || !mapLoaded) return;
    const stop = startDemoSimulator({
      coordinates: displayGeometry.coordinates as [number, number][],
      waypoints: DEMO_ROUTE.waypoints,
      onUpdate: (b) => handleLocationUpdateRef.current(b),
    });
    return stop;
  }, [demo, displayGeometry, mapLoaded]);

  // Presentation state for demo mode: the "connection" is the local simulator.
  const effectiveConnected = demo ? true : isConnected;
  const effectiveViewerCount = demo ? 12 : viewerCount;

  // Reverse-geocode Santa's current position to get street name / suburb
  const { street, suburb } = useReverseGeocode(currentLocation?.location ?? null);

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
          <p style={{ fontSize: '1.25rem', color: '#616161' }}>Loading Santa's route...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#FAFAFA',
          textAlign: 'center',
        }}
      >
        <SEO title="Santa run not found" />
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
        <h1 style={{ color: 'var(--fire-red)', marginBottom: '0.75rem' }}>
          We couldn&apos;t find that Santa run
        </h1>
        <p style={{ color: 'var(--neutral-700)', maxWidth: '420px', lineHeight: 1.6 }}>
          The link may be out of date, or the run hasn&apos;t been published yet.
          Check with your local brigade, or find them below to see their latest runs.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            to="/brigades"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, var(--fire-red) 0%, var(--fire-red-dark) 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 'var(--border-radius-sm)',
              fontWeight: 600,
            }}
          >
            🚒 Find your brigade
          </Link>
          <Link
            to="/"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: 'var(--fire-red)',
              textDecoration: 'none',
              borderRadius: 'var(--border-radius-sm)',
              fontWeight: 600,
              border: '2px solid var(--fire-red)',
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!route) {
    return null;
  }

  // Calculate progress — blend stored completion flags with live broadcasts so
  // the bar moves in real time as Santa passes each stop.
  const completedWaypoints = route.waypoints.filter(
    (w, index) => w.isCompleted || index < liveWaypointIndex
  ).length;
  const totalWaypoints = route.waypoints.length;
  const progressPercent = totalWaypoints > 0 ? (completedWaypoints / totalWaypoints) * 100 : 0;

  // SEO meta tags for social sharing
  const seoTitle = `Track Santa - ${route.name}`;
  const seoDescription = `🎅 Track Santa in real-time for ${route.name}! See Santa's location live as your local crew brings Christmas joy on ${route.date}.`;
  const seoUrl = route.shareableLink || `${window.location.origin}/track/${route.id}`;
  // Dynamic OG image generated server-side with route map, brigade name, and festive branding.
  // window.location.origin automatically resolves to the correct host (localhost, staging, or
  // production) so the og:image URL is always environment-agnostic without extra configuration.
  const ogImageUrl = `${window.location.origin}/api/og-image?routeId=${encodeURIComponent(route.id)}&brigadeId=${encodeURIComponent(route.brigadeId)}`;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={ogImageUrl}
        url={seoUrl}
        type="website"
        twitterCard="summary_large_image"
      />
      <div className="full-viewport" style={{ position: 'relative', width: '100%' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Post-event Thank You Overlay (archive mode) */}
      {route.status === 'completed' && (
        <ThankYouOverlay route={route} />
      )}

      {/* Santa Tracker Header and Progress Panel — hidden in archive mode */}
      {route.status !== 'completed' && (
        <>
          {/* Santa Tracker Header - Festive Badge Style */}
          <div
            className="santa-header"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(135deg, var(--santa-red), #B21E1E)',
              color: 'var(--candy-white)',
              fontFamily: 'var(--font-fun)',
              padding: 'calc(clamp(0.75rem, 2.5vw, 1.25rem) + env(safe-area-inset-top, 0px)) clamp(1rem, 3vw, 1.5rem) clamp(0.75rem, 2.5vw, 1.25rem)',
              borderRadius: '0 0 25px 25px',
              boxShadow: 'var(--ui-shadow)',
              borderBottom: '4px solid var(--rfs-yellow)', // RFS accent
              zIndex: 1000,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem 1rem',
              maxWidth: '1200px',
              margin: '0 auto',
            }}>
              <div style={{ fontSize: 'clamp(32px, 6vw, 48px)', lineHeight: 1 }}>🎅</div>
              <div style={{ flex: 1, minWidth: '55%' }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 'clamp(1.15rem, 4vw, 1.75rem)',
                    fontWeight: 'normal',
                    color: 'var(--candy-white)',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    lineHeight: 1.15,
                  }}
                >
                  {route.name}
                </h1>
                <p style={{
                  margin: '0.25rem 0 0',
                  fontSize: 'clamp(0.8125rem, 2vw, 1rem)',
                  opacity: 0.95,
                  fontFamily: 'var(--font-body)',
                }}>
                  📅 {formatRunDateTime(route.date, route.startTime)}
                </p>
              </div>
              {demo && (
                <span
                  style={{
                    padding: '0.25rem 0.6rem',
                    backgroundColor: 'var(--rfs-yellow)',
                    color: 'var(--neutral-900)',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.05em',
                  }}
                >
                  DEMO
                </span>
              )}
              {/* Live Viewer Count Badge */}
              {effectiveViewerCount !== null && effectiveViewerCount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 'var(--border-radius-sm)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  title={`${effectiveViewerCount} ${effectiveViewerCount === 1 ? 'person is' : 'people are'} watching`}
                >
                  <span className="live-pulse-dot" style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--rfs-yellow)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }} />
                  <span>LIVE</span>
                  <span style={{ opacity: 0.8 }}>•</span>
                  <span>{effectiveViewerCount} watching</span>
                </div>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: 'white',
                  color: 'var(--santa-red)',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                }}
              >
                🔗 Share
              </button>
              <div
                className="live-pulse"
                style={{
                  backgroundColor: effectiveConnected ? 'var(--rfs-yellow)' :
                                   isConnecting ? 'var(--summer-gold)' :
                                   'var(--fire-red)',
                }}
                title={
                  effectiveConnected ? 'Connected - Live Tracking Active' :
                  isConnecting ? 'Connecting...' :
                  'Disconnected'
                }
              />
            </div>
          </div>

          {/* Bottom Sheet — iOS-style collapsible info panel. Capped to ~a
              third of the viewport so the map (the star of the show) stays
              visible; the header row is always tappable to collapse/expand. */}
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
              left: '0.75rem',
              right: '0.75rem',
              maxWidth: '600px',
              margin: '0 auto',
              zIndex: 1000,
            }}
          >
            {/* Re-centre on Santa — floats just above the sheet, wherever its top is */}
            {!isFollowing && currentLocation && (
              <button
                onClick={resumeFollowing}
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 0.75rem)',
                  right: 0,
                  padding: '0.625rem 1rem',
                  background: 'white',
                  color: 'var(--santa-red)',
                  border: '2px solid var(--santa-red)',
                  borderRadius: '999px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                🎅 Follow Santa
              </button>
            )}

            <section
              className="status-card"
              aria-label="Santa run status"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                borderTop: '3px solid var(--rfs-yellow)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                fontFamily: 'var(--font-body)',
                overflow: 'hidden',
              }}
            >
              {/* Always-visible header row: grabber, title, progress, chevron */}
              <button
                type="button"
                className="btn-plain"
                onClick={() => setPanelOpen((open) => !open)}
                aria-expanded={panelOpen}
                aria-controls="tracking-sheet-content"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  cursor: 'pointer',
                }}
              >
                <h2 style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 'bold',
                  color: 'var(--santa-red)',
                  margin: 0,
                  fontSize: '1.05rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  🎁 Progress
                </h2>
                <span style={{
                  color: 'var(--neutral-700)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  marginLeft: 'auto',
                }}>
                  {completedWaypoints} / {totalWaypoints} stops
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    transform: panelOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 0.3s ease',
                    color: 'var(--neutral-600)',
                  }}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Collapsible content — animates via the grid 0fr/1fr trick */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: panelOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div id="tracking-sheet-content" style={{ overflow: 'hidden', minHeight: 0 }}>
                  <div
                    style={{
                      padding: '0 1.25rem 1.25rem',
                      maxHeight: 'calc(33vh - 48px)',
                      overflowY: 'auto',
                    }}
                  >
            <div style={{ marginBottom: '0.9rem' }}>
              <div
                style={{
                  width: '100%',
                  height: '10px',
                  backgroundColor: 'var(--neutral-200)',
                  borderRadius: 'var(--border-radius-xs)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--christmas-green) 0%, var(--eucalyptus-green) 100%)',
                    transition: 'width 0.5s ease',
                    borderRadius: 'var(--border-radius-xs)',
                    boxShadow: '0 0 10px rgba(67, 160, 71, 0.4)',
                  }}
                />
              </div>
            </div>

            {currentLocation ? (
              (() => {
                // Build the location label: prefer street name, fall back to distance from next stop.
                const nextIncomplete = route.waypoints.find((w) => !w.isCompleted);
                const distanceToNext = nextIncomplete
                  ? calculateDistance(currentLocation.location, nextIncomplete.coordinates)
                  : null;

                let locationLabel: string;
                if (street) {
                  locationLabel = `🎅 Santa is currently on ${street}`;
                } else if (distanceToNext !== null) {
                  locationLabel = `🎅 Santa is ${formatDistance(distanceToNext)} from next stop`;
                } else {
                  locationLabel = '🎅 Santa is on the way!';
                }

                return (
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(255, 230, 0, 0.1)',
                    borderRadius: 'var(--border-radius-xs)',
                    borderLeft: '4px solid var(--rfs-yellow)',
                  }}>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '1rem', 
                      color: 'var(--neutral-900)',
                      fontWeight: 600,
                    }}>
                      {locationLabel}
                    </p>
                    {suburb && (
                      <p style={{
                        margin: '0.25rem 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--neutral-700)',
                      }}>
                        📍 {suburb}
                      </p>
                    )}
                    {currentLocation.nextWaypointEta && (
                      <p style={{ 
                        margin: '0.5rem 0 0', 
                        fontSize: '0.875rem', 
                        color: 'var(--neutral-700)',
                      }}>
                        ⏱️ ETA to next stop: <strong>{currentLocation.nextWaypointEta}</strong>
                      </p>
                    )}
                  </div>
                );
              })()
            ) : route.status === 'active' ? (
              <div style={{
                padding: '1rem',
                backgroundColor: 'var(--neutral-100)',
                borderRadius: 'var(--border-radius-xs)',
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--neutral-700)' }}>
                  ⏳ Waiting for Santa to start broadcasting...
                </p>
              </div>
            ) : countdownComplete ? (
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(67, 160, 71, 0.1)',
                borderRadius: 'var(--border-radius-xs)',
                borderLeft: '4px solid var(--christmas-green)',
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--neutral-700)', fontWeight: 600 }}>
                  🎅 It's time! Santa's run is about to begin — stay tuned!
                </p>
              </div>
            ) : (
              <CountdownTimer
                startDate={route.date}
                startTime={route.startTime}
                onComplete={() => setCompletedForRouteId(routeId)}
                onShare={() => setShowShareModal(true)}
              />
            )}

            {/* Demo mode: label the simulation and convert interested crews */}
            {demo && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255, 230, 0, 0.15)',
                  borderRadius: 'var(--border-radius-xs)',
                  borderLeft: '4px solid var(--rfs-yellow)',
                  fontSize: '0.875rem',
                  color: 'var(--neutral-900)',
                }}
              >
                <strong>This is a simulated demo run.</strong> Everything works exactly
                like this on the night — your community follows the real truck live.{' '}
                <Link to="/" style={{ color: 'var(--fire-red)', fontWeight: 700 }}>
                  Set it up for your town →
                </Link>
              </div>
            )}

            {/* Notify me — web push before the run starts (hidden when the
                deployment has no VAPID keys or the browser lacks push) */}
            {!demo && !currentLocation && pushPublicKey && (
              <div style={{ marginTop: '0.75rem' }}>
                {notifyState === 'done' ? (
                  <p
                    style={{
                      margin: 0,
                      padding: '0.7rem 1rem',
                      backgroundColor: 'rgba(255, 167, 38, 0.12)',
                      borderRadius: 'var(--border-radius-xs)',
                      borderLeft: '4px solid var(--summer-gold)',
                      fontSize: '0.875rem',
                      color: 'var(--neutral-900)',
                      fontWeight: 600,
                    }}
                  >
                    🔔 You&apos;re on the list — we&apos;ll notify you the moment Santa starts.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleNotifyMe}
                    disabled={notifyState === 'busy'}
                    style={{
                      width: '100%',
                      padding: '0.7rem 1rem',
                      border: 'none',
                      borderRadius: 'var(--border-radius-xs)',
                      background: 'linear-gradient(135deg, var(--summer-gold), var(--summer-gold-dark, #F57C00))',
                      color: 'var(--neutral-900)',
                      cursor: notifyState === 'busy' ? 'wait' : 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-body)',
                      boxShadow: '0 2px 8px rgba(255, 167, 38, 0.4)',
                    }}
                  >
                    {notifyState === 'busy' ? '🔔 Setting up…' : '🔔 Notify me when Santa starts'}
                  </button>
                )}
                {notifyError && (
                  <p role="alert" style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--fire-red)', fontWeight: 600 }}>
                    {notifyError}
                  </p>
                )}
              </div>
            )}

            {/* Personal ETA — pin your place, see how far away Santa is */}
            <div style={{ marginTop: '0.75rem' }}>
              {viewerPin ? (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(67, 160, 71, 0.08)',
                    borderRadius: 'var(--border-radius-xs)',
                    borderLeft: '4px solid var(--christmas-green)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: 'space-between',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--neutral-900)', fontWeight: 600 }}>
                    {mySpotEta
                      ? mySpotEta.passed
                        ? '🏠 Santa has already passed your spot — catch him further along the route!'
                        : `🏠 Santa is ${formatDistance(mySpotEta.meters)} from your spot — about ${mySpotEta.minutes} min away`
                      : '🏠 Your spot is pinned — your personal ETA will appear when Santa starts.'}
                  </p>
                  <button
                    type="button"
                    onClick={clearMySpot}
                    aria-label="Remove my spot pin"
                    style={{
                      flexShrink: 0,
                      width: '28px',
                      height: '28px',
                      border: 'none',
                      borderRadius: '50%',
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-700)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={setMySpot}
                  disabled={pinBusy}
                  style={{
                    width: '100%',
                    padding: '0.7rem 1rem',
                    border: '2px solid var(--christmas-green)',
                    borderRadius: 'var(--border-radius-xs)',
                    background: 'white',
                    color: 'var(--christmas-green)',
                    cursor: pinBusy ? 'wait' : 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {pinBusy ? '📍 Finding you…' : '🏠 How far is Santa from my place?'}
                </button>
              )}
              {pinError && (
                <p role="alert" style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--fire-red)', fontWeight: 600 }}>
                  {pinError}
                </p>
              )}
            </div>

            {connectionError && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                borderRadius: 'var(--border-radius-xs)',
                borderLeft: '4px solid var(--fire-red)',
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fire-red)', fontWeight: 600 }}>
                  ⚠️ {connectionError}
                </p>
              </div>
            )}

            {/* Legal links live inside the sheet so they never overlap the map */}
            <nav
              aria-label="Legal"
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem',
                marginTop: '0.75rem',
                fontSize: '0.7rem',
              }}
            >
              <Link to="/privacy" style={{ color: 'var(--neutral-600)', textDecoration: 'none', fontWeight: 500 }}>Privacy</Link>
              <Link to="/terms" style={{ color: 'var(--neutral-600)', textDecoration: 'none', fontWeight: 500 }}>Terms</Link>
            </nav>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* Legal links — floating overlay only in archive mode; during a live
          run they live inside the bottom sheet instead. */}
      {route.status === 'completed' && (
        <nav
          aria-label="Legal"
          style={{
            position: 'absolute',
            bottom: '0.4rem',
            right: '0.6rem',
            zIndex: 1000,
            display: 'flex',
            gap: '0.75rem',
            fontSize: '0.7rem',
            background: 'rgba(255, 255, 255, 0.75)',
            padding: '0.2rem 0.5rem',
            borderRadius: '6px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Link to="/privacy" style={{ color: 'var(--neutral-700)', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/terms" style={{ color: 'var(--neutral-700)', textDecoration: 'none' }}>Terms</Link>
        </nav>
      )}

      {/* Share Modal */}
      {showShareModal && route && (
        <ShareModal
          route={route}
          isOpen={true}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
    </>
  );
}
