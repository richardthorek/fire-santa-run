import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
}

/**
 * Tracks the browser's online/offline status using the `navigator.onLine`
 * property and the `online` / `offline` window events.
 *
 * Usage:
 *   const { isOnline } = useNetworkStatus();
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
