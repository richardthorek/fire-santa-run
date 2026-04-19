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
   * Request a wake lock to keep screen awake.
   * Returns true if the lock was successfully acquired.
   */
  async request(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      
      this.wakeLock.addEventListener('release', () => {
        if (import.meta.env.DEV) {
          console.log('Wake lock released');
        }
      });

      if (import.meta.env.DEV) {
        console.log('Wake lock acquired');
      }
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
        if (import.meta.env.DEV) {
          console.log('Wake lock released manually');
        }
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
 * React hook for managing wake lock.
 *
 * When `enabled` is true the wake lock is acquired (if supported) and
 * automatically re-acquired whenever the page becomes visible again (e.g.
 * after the screen was briefly locked by the OS).
 *
 * Returns reactive `isActive` and `isSupported` flags that can be used to
 * drive UI indicators and "Keep Screen On" toggles.
 */
import { useState, useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const [isActive, setIsActive] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (enabled && !requestedRef.current) {
      wakeLockService.request().then((success) => {
        setIsActive(success);
      });
      requestedRef.current = true;

      // Re-acquire when page becomes visible (OS released the lock while hidden)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && enabled) {
          wakeLockService.request().then((success) => {
            setIsActive(success);
          });
        } else {
          // Wake lock is automatically released by the browser when the page
          // is hidden; reflect that in the reactive state.
          setIsActive(false);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        wakeLockService.release().then(() => setIsActive(false));
        requestedRef.current = false;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else if (!enabled && requestedRef.current) {
      wakeLockService.release().then(() => setIsActive(false));
      requestedRef.current = false;
    }
  }, [enabled]);

  return {
    isSupported: wakeLockService.supported(),
    isActive,
  };
}
