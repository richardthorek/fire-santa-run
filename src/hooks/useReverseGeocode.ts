/**
 * Custom hook for reverse-geocoding Santa's current GPS position.
 *
 * - Fetches the street name and suburb every 30 seconds (rate-limit friendly).
 * - Caches recent lookups in a module-level Map so fast-moving positions near
 *   the same area don't waste API quota.
 * - Gracefully handles errors by keeping the last known result.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { reverseGeocodeDetailed, type ReverseGeocodeResult } from '../utils/mapbox';

/** Round to 3 decimal places (~111 m precision) for cache keys. */
const CACHE_PRECISION = 3;

/** Refresh interval in milliseconds. */
const UPDATE_INTERVAL_MS = 30_000;

/** Module-level cache persists across remounts for the lifetime of the page. */
const geocodeCache = new Map<string, ReverseGeocodeResult>();

function makeCacheKey([lng, lat]: [number, number]): string {
  return `${lng.toFixed(CACHE_PRECISION)},${lat.toFixed(CACHE_PRECISION)}`;
}

export interface UseReverseGeocodeReturn {
  street: string | null;
  suburb: string | null;
  fullAddress: string;
  isLoading: boolean;
}

/**
 * Reverse-geocodes the given coordinates, refreshing every 30 seconds.
 * Pass `null` when no location is available yet (hook becomes a no-op).
 */
export function useReverseGeocode(
  coordinates: [number, number] | null,
): UseReverseGeocodeReturn {
  const [geocodeResult, setGeocodeResult] = useState<ReverseGeocodeResult>({
    street: null,
    suburb: null,
    fullAddress: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Keep a ref so the interval callback always sees the latest coordinates
  // without needing to restart the interval on every GPS update.
  const latestCoordinatesRef = useRef<[number, number] | null>(coordinates);
  latestCoordinatesRef.current = coordinates;

  const fetchGeocode = useCallback(async (coords: [number, number]) => {
    const key = makeCacheKey(coords);

    if (geocodeCache.has(key)) {
      setGeocodeResult(geocodeCache.get(key)!);
      return;
    }

    setIsLoading(true);
    try {
      const result = await reverseGeocodeDetailed(coords);
      geocodeCache.set(key, result);
      setGeocodeResult(result);
    } catch (err) {
      console.warn('[useReverseGeocode] Reverse geocode failed:', err);
      // Keep the previous result on error — graceful degradation.
    } finally {
      setIsLoading(false);
    }
  }, []);

  // When coordinates first become available, fetch immediately then start the
  // 30-second refresh interval.  The interval uses the ref so it always acts
  // on the latest position without the effect re-running on every GPS update.
  const hasCoordinates = coordinates !== null;
  useEffect(() => {
    if (!hasCoordinates) return;

    if (latestCoordinatesRef.current) {
      fetchGeocode(latestCoordinatesRef.current);
    }

    const intervalId = setInterval(() => {
      if (latestCoordinatesRef.current) {
        fetchGeocode(latestCoordinatesRef.current);
      }
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [hasCoordinates, fetchGeocode]);

  return {
    street: geocodeResult.street,
    suburb: geocodeResult.suburb,
    fullAddress: geocodeResult.fullAddress,
    isLoading,
  };
}
