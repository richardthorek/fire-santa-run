/**
 * TrackingView page
 * Public real-time Santa tracking interface
 * No authentication required - accessible via shareable link
 */

import { useEffect, useState, useRef } from 'react';
import { useWebPubSub, useRoutes } from '../hooks';
import { ShareModal, SEO } from '../components';
import mapboxgl from 'mapbox-gl';
import type { Route, LocationBroadcast } from '../types';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface TrackingViewProps {
  routeId: string;
}

export function TrackingView({ routeId }: TrackingViewProps) {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LocationBroadcast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const santaMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const { getRoute } = useRoutes();

  // Fetch route data
  useEffect(() => {
    getRoute(routeId)
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
  }, [routeId, getRoute]);

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
    });

    map.on('load', () => {
      // Add route polyline
      if (route.geometry) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          },
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#D32F2F',
            'line-width': 4,
          },
        });
      }

      // Add waypoint markers
      route.waypoints.forEach((waypoint, index) => {
        const el = document.createElement('div');
        el.className = 'waypoint-marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = waypoint.isCompleted ? '#43A047' : '#FFA726';
        el.style.color = 'white';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '14px';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.textContent = (index + 1).toString();

        new mapboxgl.Marker(el)
          .setLngLat(waypoint.coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div style="padding: 0.5rem;">
                <strong>${waypoint.name || `Stop ${index + 1}`}</strong>
                ${waypoint.address ? `<br/><small>${waypoint.address}</small>` : ''}
                ${waypoint.isCompleted ? '<br/><span style="color: #43A047;">✓ Completed</span>' : ''}
              </div>`
            )
          )
          .addTo(map);
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      if (santaMarkerRef.current) {
        santaMarkerRef.current.remove();
        santaMarkerRef.current = null;
      }
    };
  }, [route]);

  // Handle location updates
  const handleLocationUpdate = (location: LocationBroadcast) => {
    setCurrentLocation(location);

    if (!mapRef.current) return;

    // Update or create Santa marker
    if (santaMarkerRef.current) {
      santaMarkerRef.current.setLngLat(location.location);
    } else {
      const el = document.createElement('div');
      el.style.fontSize = '48px';
      el.textContent = '🎅';

      const marker = new mapboxgl.Marker(el)
        .setLngLat(location.location)
        .addTo(mapRef.current);

      santaMarkerRef.current = marker;
    }

    // Center map on Santa's location
    mapRef.current.easeTo({
      center: location.location,
      zoom: 14,
      duration: 1000,
    });
  };

  // Connect to Web PubSub for real-time updates
  const { isConnected, isConnecting, error: connectionError } = useWebPubSub({
    routeId,
    role: 'viewer',
    onLocationUpdate: handleLocationUpdate,
  });

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
          height: '100vh',
          padding: '2rem',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>❌</div>
        <h1 style={{ color: '#D32F2F', marginBottom: '1rem' }}>Route Not Found</h1>
        <p style={{ color: '#616161', textAlign: 'center', maxWidth: '400px' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!route) {
    return null;
  }

  // Calculate progress
  const completedWaypoints = route.waypoints.filter((w) => w.isCompleted).length;
  const totalWaypoints = route.waypoints.length;
  const progressPercent = (completedWaypoints / totalWaypoints) * 100;

  // SEO meta tags for social sharing
  const seoTitle = `Track Santa - ${route.name}`;
  const seoDescription = `🎅 Track Santa in real-time for ${route.name}! See Santa's location live as the ${route.brigadeId} Rural Fire Service brings Christmas joy on ${route.date}.`;
  const seoUrl = route.shareableLink || `${window.location.origin}/track/${route.id}`;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        url={seoUrl}
        type="website"
        twitterCard="summary_large_image"
      />
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Header Panel */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          right: '1rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '1rem 1.5rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '32px' }}>🎅</div>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#D32F2F',
              }}
            >
              {route.name}
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#616161' }}>
              {route.date} • {route.startTime}
            </p>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#29B6F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0288D1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#29B6F6'}
          >
            🔗 Share
          </button>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#43A047' : isConnecting ? '#FFA726' : '#D32F2F',
              animation: isConnecting ? 'pulse 2s infinite' : 'none',
            }}
            title={
              isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'
            }
          />
        </div>
      </div>

      {/* Progress Panel */}
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          right: '1rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '1rem 1.5rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
        }}
      >
        <div style={{ marginBottom: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontWeight: 'bold', color: '#212121' }}>Progress</span>
            <span style={{ color: '#616161' }}>
              {completedWaypoints} / {totalWaypoints} stops
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#E0E0E0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #43A047 0%, #66BB6A 100%)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {currentLocation ? (
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#616161' }}>
              🎅 Santa is on the way!
            </p>
            {currentLocation.nextWaypointEta && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#616161' }}>
                ETA to next stop: {currentLocation.nextWaypointEta}
              </p>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#616161' }}>
            {route.status === 'active'
              ? 'Waiting for Santa to start broadcasting...'
              : route.status === 'completed'
              ? '🎉 Santa has completed this route!'
              : 'Santa has not started this route yet.'}
          </p>
        )}

        {connectionError && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#D32F2F' }}>
            ⚠️ {connectionError}
          </p>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && route && (
        <ShareModal
          route={route}
          isOpen={true}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
    </>
  );
}
