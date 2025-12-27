import type { Brigade } from '../storage';
import { DEFAULT_CENTER } from '../config/mapbox';

/**
 * Get user's current location using Geolocation API
 * Returns null if permission is denied or not available
 */
export async function getUserLocation(): Promise<[number, number] | null> {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.longitude, position.coords.latitude]);
      },
      (error) => {
        console.warn('Geolocation denied or failed:', error.message);
        resolve(null);
      },
      {
        timeout: 5000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  });
}

/**
 * Determine the default map center based on available data
 * Priority:
 * 1. Brigade station coordinates (if brigade and coordinates exist)
 * 2. User's current location (if permission granted)
 * 3. Australia center (fallback)
 */
export async function getDefaultMapCenter(
  brigade: Brigade | null | undefined
): Promise<[number, number]> {
  // Priority 1: Brigade station coordinates
  if (brigade?.stationCoordinates) {
    return brigade.stationCoordinates;
  }

  // Priority 2: User's current location
  try {
    const userLocation = await getUserLocation();
    if (userLocation) {
      return userLocation;
    }
  } catch (error) {
    console.warn('Failed to get user location:', error);
  }

  // Priority 3: Default to Australia center
  return DEFAULT_CENTER;
}

/**
 * Australia-wide center point for fallback
 * Approximately central NSW (between major cities)
 */
export const AUSTRALIA_CENTER: [number, number] = [133.7751, -25.2744];
