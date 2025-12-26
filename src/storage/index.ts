import type { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './localStorage';
import { HttpStorageAdapter } from './http';

/**
 * Storage adapter factory that returns the appropriate implementation
 * based on environment configuration.
 * 
 * Decision logic:
 * 1. Dev mode (VITE_DEV_MODE=true):
 *    → Uses localStorage (local-only development, no API needed)
 * 
 * 2. Production mode (VITE_DEV_MODE=false):
 *    → Uses HTTP API adapter (calls Azure Functions backend)
 *    → Backend handles Azure Table Storage operations
 * 
 * IMPORTANT: Azure Table Storage SDK is Node.js-only and should NEVER be used 
 * directly in the browser. All storage operations in production go through the API.
 */
function createStorageAdapter(): IStorageAdapter {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  // Dev mode: Use localStorage for rapid development
  if (isDevMode) {
    console.info('[Storage] Dev mode enabled. Using localStorage adapter.');
    return new LocalStorageAdapter();
  }
  
  // Production mode: Use HTTP API adapter to call Azure Functions
  console.info('[Storage] Production mode. Using HTTP API adapter (calls /api endpoints).');
  return new HttpStorageAdapter('/api');
}

// Export singleton instance
export const storageAdapter = createStorageAdapter();

// Export types for consumers
export type { IStorageAdapter, Brigade } from './types';
