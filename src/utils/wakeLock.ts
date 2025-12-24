/**
 * Wake Lock API utilities for preventing screen sleep during navigation
 */

class WakeLockService {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'wakeLock' in navigator;
  }

  /**
   * Check if Wake Lock API is supported
   */
  supported(): boolean {
    return this.isSupported;
  }

  /**
   * Request a wake lock to keep screen awake
   */
  async request(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Wake Lock API is not supported');
      return false;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      
      // Re-request wake lock when page becomes visible again
      this.wakeLock.addEventListener('release', () => {
        console.log('Wake lock released');
      });

      console.log('Wake lock acquired');
      return true;
    } catch (error) {
      console.error('Failed to acquire wake lock:', error);
      return false;
    }
  }

  /**
   * Release the wake lock
   */
  async release(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('Wake lock released manually');
      } catch (error) {
        console.error('Failed to release wake lock:', error);
      }
    }
  }

  /**
   * Check if wake lock is currently active
   */
  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }
}

// Singleton instance
const wakeLockService = new WakeLockService();

export { wakeLockService };

/**
 * React hook for managing wake lock
 */
import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const requestedRef = useRef(false);

  useEffect(() => {
    if (enabled && !requestedRef.current) {
      wakeLockService.request();
      requestedRef.current = true;

      // Re-request when page becomes visible (e.g., after screen lock)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && enabled) {
          wakeLockService.request();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        wakeLockService.release();
        requestedRef.current = false;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else if (!enabled && requestedRef.current) {
      wakeLockService.release();
      requestedRef.current = false;
    }
  }, [enabled]);

  return {
    isSupported: wakeLockService.supported(),
    isActive: wakeLockService.isActive(),
  };
}
