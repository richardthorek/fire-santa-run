/**
 * Mapbox API utilities for Geocoding and Directions
 */

import type { NavigationStep, GeoJSON } from '../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GEOCODING_API = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const DIRECTIONS_API = 'https://api.mapbox.com/directions/v5/mapbox/driving';

export interface GeocodingResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
  }>;
}

export interface DirectionsResponse {
  routes: Array<{
    geometry: GeoJSON.LineString;
    distance: number; // meters
    duration: number; // seconds
    legs: Array<{
      steps: Array<{
        maneuver: {
          type: string;
          instruction: string;
          modifier?: string;
          location: [number, number];
        };
        distance: number;
        duration: number;
        geometry: GeoJSON.LineString;
      }>;
    }>;
  }>;
}

/**
 * Search for addresses using Mapbox Geocoding API
 */
export async function searchAddress(query: string, proximity?: [number, number]): Promise<GeocodingResult[]> {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox token not configured');
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    limit: '5',
    country: 'AU', // Limit to Australia
  });

  if (proximity) {
    params.append('proximity', proximity.join(','));
  }

  const response = await fetch(`${GEOCODING_API}/${encodeURIComponent(query)}.json?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to search address');
  }

  const data = await response.json();
  return data.features;
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(coordinates: [number, number]): Promise<string> {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox token not configured');
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
  });

  const response = await fetch(
    `${GEOCODING_API}/${coordinates[0]},${coordinates[1]}.json?${params}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to reverse geocode');
  }

  const data = await response.json();
  return data.features[0]?.place_name || `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
}

/**
 * Get optimized route with turn-by-turn navigation from Mapbox Directions API
 */
export async function getDirections(
  coordinates: [number, number][]
): Promise<{
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
  steps: NavigationStep[];
}> {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox token not configured');
  }

  if (coordinates.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  // Format coordinates for Directions API
  const coords = coordinates.map(c => c.join(',')).join(';');

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    steps: 'true',
    overview: 'full',
    language: 'en',
  });

  const response = await fetch(`${DIRECTIONS_API}/${coords}?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get directions');
  }

  const data: DirectionsResponse = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
  
  // Convert Mapbox steps to our NavigationStep format
  const steps: NavigationStep[] = [];
  route.legs.forEach(leg => {
    leg.steps.forEach(step => {
      steps.push({
        instruction: step.maneuver.instruction,
        distance: step.distance,
        duration: step.duration,
        geometry: step.geometry,
        maneuver: {
          type: step.maneuver.type,
          modifier: step.maneuver.modifier,
          location: step.maneuver.location,
        },
      });
    });
  });

  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    steps,
  };
}

/**
 * Format distance in human-readable format
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
