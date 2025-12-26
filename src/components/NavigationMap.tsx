/**
 * NavigationMap component
 * Displays the map with route, waypoints, and current location during navigation
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_CONFIG } from '../config/mapbox';
import type { Route } from '../types';
import type { GeolocationCoordinates } from '../hooks/useGeolocation';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN;

export interface NavigationMapProps {
  route: Route;
  userPosition: GeolocationCoordinates | null;
  completedWaypointIds: string[];
}

export function NavigationMap({ route, userPosition, completedWaypointIds }: NavigationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: route.waypoints[0]?.coordinates || [151.2093, -33.8688], // Default to Sydney
      zoom: 14,
      pitch: 45, // 3D perspective for navigation
      bearing: 0,
      ...MAPBOX_CONFIG,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [route]);

  // Draw route geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route.geometry) return;

    map.on('load', () => {
      // Add route line
      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry!,
          },
        });

        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#D32F2F',
            'line-width': 6,
            'line-opacity': 0.8,
          },
        });

        // Add route outline for better visibility
        map.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#B71C1C',
            'line-width': 8,
            'line-opacity': 0.4,
          },
        });
      }

      // Fit map to route
      const coordinates = route.geometry!.coordinates;
      const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord as [number, number]),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );
      map.fitBounds(bounds, { padding: 50 });
    });
  }, [route.geometry]);

  // Update route geometry if it changes (rerouting)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route.geometry) return;

    const source = map.getSource('route') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: route.geometry,
      });
    }
  }, [route.geometry]);

  // Add/update waypoint markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    waypointMarkersRef.current.forEach(marker => marker.remove());
    waypointMarkersRef.current = [];

    // Add waypoint markers
    route.waypoints.forEach((waypoint, index) => {
      const isCompleted = completedWaypointIds.includes(waypoint.id);
      
      const el = document.createElement('div');
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isCompleted ? '#43A047' : '#FFA726';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '14px';
      el.style.fontWeight = 'bold';
      el.style.color = 'white';
      el.textContent = isCompleted ? '✓' : `${index + 1}`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(waypoint.coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<strong>${waypoint.name || waypoint.address || 'Waypoint'}</strong>${
              waypoint.notes ? `<br/>${waypoint.notes}` : ''
            }`
          )
        )
        .addTo(map);

      waypointMarkersRef.current.push(marker);
    });
  }, [route.waypoints, completedWaypointIds]);

  // Update user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) return;

    if (!userMarkerRef.current) {
      // Create Santa marker for user location
      const el = document.createElement('div');
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.fontSize = '32px';
      el.textContent = '🎅';
      el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(userPosition.coordinates)
        .addTo(map);
    } else {
      // Update position
      userMarkerRef.current.setLngLat(userPosition.coordinates);
    }

    // Center map on user location with smooth animation
    map.easeTo({
      center: userPosition.coordinates,
      duration: 1000,
    });

    // Update bearing if heading is available
    if (userPosition.heading !== null && userPosition.heading >= 0) {
      map.easeTo({
        bearing: userPosition.heading,
        duration: 1000,
      });
    }
  }, [userPosition]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
