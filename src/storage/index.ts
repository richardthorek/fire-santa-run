import type { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './localStorage';
import { AzureTableStorageAdapter } from './azure';

/**
 * Storage adapter factory that returns the appropriate implementation
 * based on the VITE_DEV_MODE environment variable.
 * 
 * - Dev mode (VITE_DEV_MODE=true): Uses localStorage
 * - Production mode (VITE_DEV_MODE=false): Uses Azure Table Storage
 */
function createStorageAdapter(): IStorageAdapter {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (isDevMode) {
    return new LocalStorageAdapter();
  }
  
  return new AzureTableStorageAdapter();
}

// Export singleton instance
export const storageAdapter = createStorageAdapter();

// Export types for consumers
export type { IStorageAdapter, Brigade } from './types';
