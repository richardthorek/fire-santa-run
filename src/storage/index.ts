import type { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './localStorage';
import { AzureTableStorageAdapter } from './azure';

/**
 * Checks if Azure Storage credentials are configured in the environment.
 * @returns true if Azure connection string is present and non-empty
 */
function hasAzureStorageCredentials(): boolean {
  const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  return typeof connectionString === 'string' && connectionString.length > 0;
}

/**
 * Storage adapter factory that returns the appropriate implementation
 * based on environment configuration.
 * 
 * Decision logic:
 * 1. Dev mode WITHOUT Azure credentials (VITE_DEV_MODE=true, no connection string):
 *    → Uses localStorage (local-only development)
 * 
 * 2. Dev mode WITH Azure credentials (VITE_DEV_MODE=true, connection string present):
 *    → Uses Azure Table Storage with 'dev' prefix (shared dev environment)
 * 
 * 3. Production mode (VITE_DEV_MODE=false):
 *    → Uses Azure Table Storage without prefix (production data)
 */
function createStorageAdapter(): IStorageAdapter {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const hasAzureCredentials = hasAzureStorageCredentials();
  
  // Dev mode with Azure credentials: Use Azure with 'dev' prefix
  if (isDevMode && hasAzureCredentials) {
    const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING as string;
    console.info('[Storage] Dev mode with Azure credentials detected. Using Azure Table Storage with "dev" prefix.');
    return new AzureTableStorageAdapter(connectionString, 'dev');
  }
  
  // Dev mode without Azure credentials: Use localStorage
  if (isDevMode) {
    console.info('[Storage] Dev mode without Azure credentials. Using localStorage.');
    return new LocalStorageAdapter();
  }
  
  // Production mode: Use Azure without prefix
  const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING as string;
  
  if (!connectionString) {
    throw new Error(
      'Production mode requires Azure Storage connection string. ' +
      'Set VITE_AZURE_STORAGE_CONNECTION_STRING in your environment.'
    );
  }
  
  console.info('[Storage] Production mode. Using Azure Table Storage.');
  return new AzureTableStorageAdapter(connectionString);
}

// Export singleton instance
export const storageAdapter = createStorageAdapter();

// Export types for consumers
export type { IStorageAdapter, Brigade } from './types';
