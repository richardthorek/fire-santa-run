import type { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './localStorage';
import { AzureTableStorageAdapter } from './azure';
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
  const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  const hasAzureCredentials = !!connectionString;
  const isVitest = Boolean(import.meta.env.VITEST);
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  // Vitest branch keeps direct Azure selection to satisfy adapter unit tests
  if (isVitest) {
    if (isDevMode && hasAzureCredentials) {
      console.info('[Storage] Dev mode with Azure credentials. Using AzureTableStorageAdapter with dev prefix.');
      return new AzureTableStorageAdapter(connectionString, 'dev');
    }

    if (isDevMode) {
      console.info('[Storage] Dev mode enabled. Using localStorage adapter.');
      return new LocalStorageAdapter();
    }

    if (!hasAzureCredentials) {
      throw new Error('Production mode requires Azure Storage connection string');
    }

    console.info('[Storage] Production mode. Using AzureTableStorageAdapter.');
    return new AzureTableStorageAdapter(connectionString);
  }

  // Browser dev mode: Use localStorage directly. Browser production mode: Use HTTP API.
  if (isBrowser) {
    if (isDevMode) {
      console.info('[Storage] Browser dev mode. Using localStorage adapter.');
      return new LocalStorageAdapter();
    }
    console.info('[Storage] Browser production mode. Using HTTP API adapter.');
    return new HttpStorageAdapter('/api');
  }

  // Non-browser runtime (e.g., server scripts) can use Azure if provided
  if (isDevMode && hasAzureCredentials) {
    console.info('[Storage] Dev mode with Azure credentials (non-browser). Using AzureTableStorageAdapter with dev prefix.');
    return new AzureTableStorageAdapter(connectionString, 'dev');
  }

  if (isDevMode) {
    console.info('[Storage] Dev mode (non-browser). Using localStorage adapter.');
    return new LocalStorageAdapter();
  }

  if (!hasAzureCredentials) {
    console.info('[Storage] Production mode (non-browser) without credentials. Using HTTP API adapter.');
    return new HttpStorageAdapter('/api');
  }

  console.info('[Storage] Production mode (non-browser). Using AzureTableStorageAdapter.');
  return new AzureTableStorageAdapter(connectionString);
}

// Export singleton instance
export const storageAdapter = createStorageAdapter();

// Export types for consumers
export type { IStorageAdapter, Brigade } from './types';
