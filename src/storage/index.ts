import type { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './localStorage';
import { AzureTableStorageAdapter } from './azure';

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

  // Dev mode WITH Azure credentials: use Azure with dev prefix to isolate data
  if (isDevMode && hasAzureCredentials && connectionString) {
    console.info('[Storage] Dev mode with Azure credentials. Using AzureTableStorageAdapter with dev prefix.');
    return new AzureTableStorageAdapter(connectionString, 'dev');
  }

  // Dev mode WITHOUT Azure credentials: fall back to localStorage
  if (isDevMode) {
    console.info('[Storage] Dev mode enabled. Using localStorage adapter.');
    return new LocalStorageAdapter();
  }

  // Production mode requires Azure credentials
  if (!connectionString) {
    throw new Error('Production mode requires Azure Storage connection string');
  }

  console.info('[Storage] Production mode. Using AzureTableStorageAdapter.');
  return new AzureTableStorageAdapter(connectionString);
}

// Export singleton instance
export const storageAdapter = createStorageAdapter();

// Export types for consumers
export type { IStorageAdapter, Brigade } from './types';
