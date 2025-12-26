import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_CONFIG } from '../config/mapbox';
import type { Waypoint } from '../types';

// Import Mapbox token from config
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export interface MapViewProps {
  waypoints?: Waypoint[];
  routeGeometry?: GeoJSON.LineString;
  onMapClick?: (coordinates: [number, number]) => void;
  center?: [number, number];
  zoom?: number;
  showControls?: boolean;
  interactive?: boolean;
  height?: string;
  className?: string;
}

/**
 * MapView component for displaying Mapbox map with waypoints and route
 */
export function MapView({
  waypoints = [],
  routeGeometry,
  onMapClick,
  center = [146.0391, -34.2908], // Default: Griffith, NSW
  zoom = 13,
  showControls = true,
  interactive = true,
  height = '600px',
  className = '',
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not configured');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        interactive,
        ...MAPBOX_CONFIG,
      });

      if (showControls) {
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      }

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      // Handle map clicks
      if (onMapClick && interactive) {
        map.current.on('click', (e) => {
          onMapClick([e.lngLat.lng, e.lngLat.lat]);
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update waypoint markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    waypoints.forEach((waypoint, index) => {
      const el = document.createElement('div');
      el.className = 'waypoint-marker';
      el.innerHTML = `
        <div style="
          width: 36px;
          height: 36px;
          background: ${waypoint.isCompleted ? '#43A047' : 'white'};
          border: 3px solid ${waypoint.isCompleted ? '#43A047' : '#D32F2F'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: ${waypoint.isCompleted ? 'white' : '#D32F2F'};
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          cursor: pointer;
        ">
          ${index + 1}
        </div>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat(waypoint.coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <strong>${waypoint.name || `Waypoint ${index + 1}`}</strong>
              ${waypoint.address ? `<br/><small>${waypoint.address}</small>` : ''}
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds to show all waypoints
    if (waypoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      waypoints.forEach(wp => bounds.extend(wp.coordinates));
      map.current!.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [waypoints, mapLoaded]);

  // Update route polyline with candy cane styling
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'route';
    const glowLayerId = 'route-glow';
    const baseLayerId = 'route-base';
    const stripesLayerId = 'route-stripes';

    // Remove existing layers
    if (map.current.getLayer(stripesLayerId)) map.current.removeLayer(stripesLayerId);
    if (map.current.getLayer(baseLayerId)) map.current.removeLayer(baseLayerId);
    if (map.current.getLayer(glowLayerId)) map.current.removeLayer(glowLayerId);
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);

    if (routeGeometry) {
      // Add route source
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeometry,
        },
      });

      // 1. Add Glow Layer (bottom layer for magic effect)
      map.current.addLayer({
        id: glowLayerId,
        type: 'line',
        source: sourceId,
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
      map.current.addLayer({
        id: baseLayerId,
        type: 'line',
        source: sourceId,
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
      map.current.addLayer({
        id: stripesLayerId,
        type: 'line',
        source: sourceId,
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

      // Fit bounds to show the route
      const coordinates = routeGeometry.coordinates as [number, number][];
      if (coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord) => bounds.extend(coord));
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    }
  }, [routeGeometry, mapLoaded]);

  if (!MAPBOX_TOKEN) {
    return (
      <div 
        className={className}
        style={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#d32f2f', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            ⚠️ Mapbox Token Not Configured
          </p>
          <p style={{ fontSize: '14px', color: '#616161' }}>
            Please set VITE_MAPBOX_TOKEN in your .env.local file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainer} 
      className={className}
      style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden' }}
    />
  );
}
