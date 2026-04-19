/**
 * Custom hook for managing geolocation tracking
 * Provides current position with error handling and permission management
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeolocationCoordinates {
  coordinates: [number, number]; // [lng, lat]
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean; // If true, continuously track position
  /** When true, switches to battery-efficient 30 s interval polling while the
   *  page is hidden (minimised) and resumes continuous watchPosition when the
   *  page is visible again. Has no effect unless watch is also true. */
  backgroundTracking?: boolean;
}

/** Interval (ms) used for battery-efficient background polling. */
export const BACKGROUND_TRACKING_INTERVAL_MS = 30_000;

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watch = false,
    backgroundTracking = false,
  } = options;

  const [position, setPosition] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const backgroundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check geolocation permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermission(result.state);
        result.addEventListener('change', () => {
          setPermission(result.state);
        });
      }).catch(() => {
        // Permission API not supported, assume prompt state
        setPermission('prompt');
      });
    }
  }, []);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setPosition({
      coordinates: [pos.coords.longitude, pos.coords.latitude],
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError({
      code: err.code,
      message: err.message,
    });
    setIsLoading(false);
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError({
        code: -1,
        message: 'Geolocation is not supported by this browser',
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError({
        code: -1,
        message: 'Geolocation is not supported by this browser',
      });
      setIsLoading(false);
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already watching
    }

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    watchIdRef.current = watchId;
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (backgroundIntervalRef.current !== null) {
      clearInterval(backgroundIntervalRef.current);
      backgroundIntervalRef.current = null;
    }
  }, []);

  // Start/stop watching based on watch option
  useEffect(() => {
    if (watch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startWatching();
    } else {
      stopWatching();
    }

    return () => {
      stopWatching();
    };
  }, [watch, startWatching, stopWatching]);

  // Background tracking: switch to interval-based polling when page is hidden
  useEffect(() => {
    if (!watch || !backgroundTracking) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page minimised — stop continuous watch and switch to 30 s intervals
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (backgroundIntervalRef.current === null) {
          backgroundIntervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
              handleSuccess,
              handleError,
              { enableHighAccuracy: false, timeout, maximumAge: 0 }
            );
          }, BACKGROUND_TRACKING_INTERVAL_MS);
        }
      } else {
        // Page visible again — stop interval and resume continuous watch
        if (backgroundIntervalRef.current !== null) {
          clearInterval(backgroundIntervalRef.current);
          backgroundIntervalRef.current = null;
        }
        startWatching();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (backgroundIntervalRef.current !== null) {
        clearInterval(backgroundIntervalRef.current);
        backgroundIntervalRef.current = null;
      }
    };
  }, [watch, backgroundTracking, timeout, handleSuccess, handleError, startWatching]);

  // Get initial position if not watching
  useEffect(() => {
    if (!watch && position === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      getCurrentPosition();
    }
  }, [watch, position, getCurrentPosition]);

  return {
    position,
    error,
    isLoading,
    permission,
    getCurrentPosition,
    startWatching,
    stopWatching,
  };
}
