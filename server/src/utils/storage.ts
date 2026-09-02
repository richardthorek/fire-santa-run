import { TableClient, TableServiceClient } from '@azure/data-tables';

export const isDevMode = process.env.DEV_MODE === 'true';

// Azurite's fixed, publicly-documented local-emulator account — not a secret,
// every Azurite installation accepts this same well-known key. DEV_MODE with
// no explicit connection string defaults here, mirroring the frontend's
// "DEV_MODE implies localStorage" convention: `npm run dev` (which also
// starts Azurite — see package.json) works with no Azure account at all.
const AZURITE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';

export const STORAGE_CONNECTION_STRING: string = (
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  process.env.VITE_AZURE_STORAGE_CONNECTION_STRING ||
  (isDevMode ? AZURITE_CONNECTION_STRING : '')
);

// Cache created tables so we only attempt creation once per table per process.
const createdTables = new Set<string>();
const serviceClient = STORAGE_CONNECTION_STRING
  ? TableServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING)
  : null;

/**
 * Lightweight reachability probe for readiness checks. Lists at most one table
 * to confirm the account is reachable. Never throws.
 */
export async function pingStorage(): Promise<StorageHealth> {
  if (!serviceClient) {
    return { configured: false, ok: false, error: 'connection string not configured' };
  }
  try {
    const page = serviceClient.listTables().byPage({ maxPageSize: 1 });
    await page.next();
    return { configured: true, ok: true };
  } catch (error) {
    return { configured: true, ok: false, error: (error as Error).message };
  }
}

export interface StorageHealth {
  /** Whether a connection string is present. */
  configured: boolean;
  /** Whether the storage account responded to a lightweight request. */
  ok: boolean;
  /** Error detail when `ok` is false. */
  error?: string;
}

/**
 * Get a TableClient and auto-create the table if it does not exist.
 */
export async function getTableClient(tableName: string): Promise<TableClient> {
  if (!STORAGE_CONNECTION_STRING) {
    throw new Error('Azure Storage connection string not configured');
  }

  if (!createdTables.has(tableName) && serviceClient) {
    try {
      await serviceClient.createTable(tableName);
    } catch (error: unknown) {
      // Ignore if table already exists; surface other errors.
      const err = error as { statusCode?: number; code?: string };
      if (err?.statusCode !== 409 && err?.code !== 'TableAlreadyExists') {
        throw error;
      }
    }
    createdTables.add(tableName);
  }

  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, tableName);
}
