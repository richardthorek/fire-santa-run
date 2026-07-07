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

export interface ReverseGeocodeResult {
  street: string | null;
  suburb: string | null;
  fullAddress: string;
}

/**
 * Reverse geocode coordinates to get structured address details (street + suburb).
 * Uses the `address` type filter to get the most precise street-level result.
 */
export async function reverseGeocodeDetailed(
  coordinates: [number, number],
): Promise<ReverseGeocodeResult> {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox token not configured');
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    types: 'address',
    limit: '1',
  });

  const response = await fetch(
    `${GEOCODING_API}/${coordinates[0]},${coordinates[1]}.json?${params}`,
  );

  if (!response.ok) {
    throw new Error('Failed to reverse geocode');
  }

  const data = await response.json();
  const feature = data.features?.[0];

  if (!feature) {
    return { street: null, suburb: null, fullAddress: '' };
  }

  const street = (feature.text as string) || null;

  // Extract suburb from context: prefer locality, fall back to place (city/town)
  let suburb: string | null = null;
  if (Array.isArray(feature.context)) {
    const localityItem = (feature.context as Array<{ id: string; text: string }>).find(
      (c) => c.id.startsWith('locality.') || c.id.startsWith('place.'),
    );
    suburb = localityItem?.text ?? null;
  }

  return {
    street,
    suburb,
    fullAddress: (feature.place_name as string) || '',
  };
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
 * Calculate the haversine distance in metres between two [lng, lat] coordinates.
 */
function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * 2-opt local search improvement for TSP solutions.
 *
 * Iteratively tries to improve the route by removing crossing edges and reversing
 * segments. Keeps first (0) and last (n-1) waypoints fixed.
 *
 * Returns improved path indices.
 */
export function twoOptImprove(path: number[], coordinates: [number, number][]): number[] {
  let improved = true;
  let currentPath = [...path];

  while (improved) {
    improved = false;

    // Only optimize middle waypoints; keep first and last fixed
    for (let i = 1; i < currentPath.length - 2; i++) {
      for (let j = i + 2; j < currentPath.length - 1; j++) {
        // Calculate distance before swap
        const a = currentPath[i - 1];
        const b = currentPath[i];
        const c = currentPath[j];
        const d = currentPath[j + 1];

        const distBefore =
          haversineDistance(coordinates[a], coordinates[b]) +
          haversineDistance(coordinates[c], coordinates[d]);

        const distAfter =
          haversineDistance(coordinates[a], coordinates[c]) +
          haversineDistance(coordinates[b], coordinates[d]);

        // If swapping improves the distance, do it
        if (distAfter < distBefore) {
          // Reverse the segment between i and j
          const newPath = [
            ...currentPath.slice(0, i),
            ...currentPath.slice(i, j + 1).reverse(),
            ...currentPath.slice(j + 1),
          ];
          currentPath = newPath;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return currentPath;
}

/**
 * Nearest-neighbour TSP heuristic with 2-opt improvement.
 *
 * Returns the indices of the input `coordinates` array in the optimised visit
 * order.  The **first and last coordinates are always kept in place** (start
 * and end preserved); only the intermediate stops are reordered.
 *
 * Uses nearest-neighbor as initial solution, then improves it with 2-opt
 * local search to find better paths (remove crossing edges and backtracking).
 *
 * Example: [A, B, C, D] with optimal middle order C→B returns [0, 2, 1, 3].
 */
export function nearestNeighborTsp(coordinates: [number, number][]): number[] {
  const n = coordinates.length;
  if (n <= 2) return coordinates.map((_, i) => i);

  // Middle indices only — first (0) and last (n-1) are fixed
  const unvisited = new Set(Array.from({ length: n - 2 }, (_, i) => i + 1));
  const path: number[] = [0];
  let current = 0;

  while (unvisited.size > 0) {
    let nearestDist = Infinity;
    let nearest = -1;

    for (const idx of unvisited) {
      const d = haversineDistance(coordinates[current], coordinates[idx]);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = idx;
      }
    }

    if (nearest === -1) {
      // Should not happen while unvisited is non-empty, but guard defensively
      throw new Error('nearestNeighborTsp: failed to find a nearest neighbour');
    }

    path.push(nearest);
    unvisited.delete(nearest);
    current = nearest;
  }

  path.push(n - 1); // always finish at the last waypoint

  // Apply 2-opt local search improvement to remove crossing paths and backtracking
  return twoOptImprove(path, coordinates);
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
