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
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watch = false,
  } = options;

  const [position, setPosition] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const watchIdRef = useRef<number | null>(null);

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
