/**
 * NavigationMap component
 * Displays the map with route, waypoints, and current location during navigation
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_CONFIG, DEFAULT_MAP_STYLE } from '../config/mapbox';
import type { Route } from '../types';
import type { GeolocationCoordinates } from '../hooks/useGeolocation';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN;

export interface NavigationMapProps {
  route: Route;
  userPosition: GeolocationCoordinates | null;
  completedWaypointIds: string[];
  /**
   * Coarsened, aggregated "families waiting here" cells from opt-in viewers.
   * Rendered as soft circles sized by how many viewers snapped to each ~110m
   * grid square — never individual viewer positions.
   */
  viewerCells?: { lng: number; lat: number; count: number }[];
}

export function NavigationMap({
  route,
  userPosition,
  completedWaypointIds,
  viewerCells = [],
}: NavigationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize the map ONCE. The `route` object identity changes on every ETA
  // recalculation (~30s) and every reroute — keying the map on it tore the map
  // down and rebuilt it repeatedly, orphaning the Santa/waypoint markers
  // (their refs pointed at a removed map, so they were never re-added). All
  // route/waypoint/position updates are handled by the effects below instead.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: DEFAULT_MAP_STYLE,
      center: route.waypoints[0]?.coordinates || [151.2093, -33.8688], // Default to Sydney
      zoom: 14,
      pitch: 45, // 3D perspective for navigation
      bearing: 0,
      ...MAPBOX_CONFIG,
    });

    // Enable pedestrian roads visibility for the standard style
    if (DEFAULT_MAP_STYLE.includes('standard')) {
      map.on('styledata', () => {
        if (map.getLayer('pedestrian')) {
          map.setLayoutProperty('pedestrian', 'visibility', 'visible');
        }
      });
    }

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setMapLoaded(true));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      waypointMarkersRef.current = [];
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw / update route geometry (also handles reroute geometry changes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !route.geometry) return;

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: route.geometry,
    };

    const existing = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(feature);
      return;
    }

    map.addSource('route', { type: 'geojson', data: feature });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#D32F2F', 'line-width': 6, 'line-opacity': 0.8 },
    });

    // Faint wider outline for better visibility against the map
    map.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#B71C1C', 'line-width': 8, 'line-opacity': 0.4 },
    });

    // Fit to the whole route on first draw — before we start following Santa.
    if (!userMarkerRef.current) {
      const coordinates = route.geometry.coordinates as [number, number][];
      const bounds = coordinates.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [mapLoaded, route.geometry]);

  // Add/update waypoint markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

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
  }, [mapLoaded, route.waypoints, completedWaypointIds]);

  // "Families waiting here" heat cells — soft circles under everything else.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: viewerCells.map(cell => ({
        type: 'Feature',
        properties: { count: cell.count },
        geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] },
      })),
    };

    const existing = map.getSource('viewer-pins') as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }

    map.addSource('viewer-pins', { type: 'geojson', data });
    map.addLayer({
      id: 'viewer-pins',
      type: 'circle',
      source: 'viewer-pins',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 7, 10, 22],
        'circle-color': '#FFA726',
        'circle-opacity': 0.3,
        'circle-stroke-color': '#F57C00',
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.6,
      },
    });
  }, [mapLoaded, viewerCells]);

  // "You are here" heading arrow — like a phone nav app. The map turns so the
  // direction of travel is up; the arrow stays pointing up the screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !userPosition) return;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))';
      el.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="20" cy="20" r="12" fill="#ffffff" />
          <path d="M20 7 L28 27 L20 22.5 L12 27 Z" fill="#D32F2F" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
        </svg>`;

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(userPosition.coordinates)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(userPosition.coordinates);
    }

    // Center map on user location with smooth animation
    map.easeTo({
      center: userPosition.coordinates,
      duration: 1000,
    });

    // Turn the map so travel direction is "up" when heading is available.
    if (userPosition.heading !== null && userPosition.heading >= 0) {
      map.easeTo({
        bearing: userPosition.heading,
        duration: 1000,
      });
    }
  }, [mapLoaded, userPosition]);

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
