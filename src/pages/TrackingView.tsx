/**
 * TrackingView page
 * Public real-time Santa tracking interface
 * No authentication required - accessible via shareable link
 */

import { useEffect, useState, useRef } from 'react';
import { useWebPubSub, useRoutes } from '../hooks';
import { ShareModal, SEO } from '../components';
import { MAPBOX_CONFIG } from '../config/mapbox';
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
      ...MAPBOX_CONFIG,
    });

    map.on('load', () => {
      // Add route polyline with candy cane styling (white base + red dashes + glow)
      if (route.geometry) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          },
        });

        // 1. Add Glow Layer (bottom layer for magic effect)
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#F77F00', // Gold accent
            'line-width': 20,
            'line-blur': 15,
            'line-opacity': 0.5,
          },
        });

        // 2. Add White Base Layer (candy cane base)
        map.addLayer({
          id: 'route-base',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 12,
            'line-opacity': 1,
          },
        });

        // 3. Add Red Stripes Layer (candy cane effect)
        map.addLayer({
          id: 'route-stripes',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#D62828', // Santa red
            'line-width': 12,
            'line-dasharray': [2, 2], // Creates the candy cane dashes
            'line-opacity': 1,
          },
        });
      }

      // Add waypoint markers with improved styling
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

        new mapboxgl.Marker(el)
          .setLngLat(waypoint.coordinates)
          .setPopup(
            new mapboxgl.Popup({ 
              offset: 25,
              className: 'festive-popup',
            }).setHTML(
              `<div style="padding: 0.75rem; font-family: var(--font-body);">
                <strong style="color: var(--fire-red); font-size: 1rem;">${waypoint.name || `Stop ${index + 1}`}</strong>
                ${waypoint.address ? `<br/><small style="color: var(--neutral-700);">${waypoint.address}</small>` : ''}
                ${waypoint.isCompleted ? '<br/><span style="color: var(--christmas-green); font-weight: 600;">✓ Completed</span>' : ''}
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

    // Center map on Santa's location with smooth animation
    mapRef.current.easeTo({
      center: location.location,
      zoom: 15,
      duration: 1500,
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
          padding: '1.25rem 1.5rem',
          borderRadius: '0 0 25px 25px',
          boxShadow: 'var(--ui-shadow)',
          borderBottom: '4px solid var(--rfs-yellow)', // RFS accent
          zIndex: 1000,
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <div style={{ fontSize: '48px', lineHeight: 1 }}>🎅</div>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                fontWeight: 'normal',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            >
              {route.name}
            </h1>
            <p style={{ 
              margin: '0.25rem 0 0', 
              fontSize: 'clamp(0.875rem, 2vw, 1rem)', 
              opacity: 0.95,
              fontFamily: 'var(--font-body)',
            }}>
              📅 {route.date} • ⏰ {route.startTime}
            </p>
          </div>
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
          <div className="live-pulse" title={
            isConnected ? 'Connected - Live Tracking Active' : 
            isConnecting ? 'Connecting...' : 
            'Disconnected'
          } />
        </div>
      </div>

      {/* Progress Panel - Frosted Glass with Festive Style */}
      <div
        className="status-card"
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '1rem',
          right: '1rem',
          maxWidth: '600px',
          margin: '0 auto',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'var(--border-radius)',
          border: '2px solid var(--rfs-yellow)',
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontFamily: 'var(--font-body)',
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
              alignItems: 'center',
            }}
          >
            <h2 style={{ 
              fontFamily: 'var(--font-heading)',
              fontWeight: 'bold', 
              color: 'var(--santa-red)',
              margin: 0,
              fontSize: '1.125rem',
            }}>
              🎁 Progress
            </h2>
            <span style={{ 
              color: 'var(--neutral-700)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}>
              {completedWaypoints} / {totalWaypoints} stops
            </span>
          </div>
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
              🎅 Santa is on the way!
            </p>
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
        ) : (
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--neutral-100)',
            borderRadius: 'var(--border-radius-xs)',
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--neutral-700)' }}>
              {route.status === 'active'
                ? '⏳ Waiting for Santa to start broadcasting...'
                : route.status === 'completed'
                ? '🎉 Santa has completed this route!'
                : '📅 Santa has not started this route yet.'}
            </p>
          </div>
        )}

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
      </div>

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
