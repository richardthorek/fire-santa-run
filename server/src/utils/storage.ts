import { TableClient, TableServiceClient } from '@azure/data-tables';

export const STORAGE_CONNECTION_STRING: string = (
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  process.env.VITE_AZURE_STORAGE_CONNECTION_STRING ||
  ''
);

export const isDevMode = process.env.DEV_MODE === 'true';

// Cache created tables so we only attempt creation once per table per process.
const createdTables = new Set<string>();
const serviceClient = STORAGE_CONNECTION_STRING
  ? TableServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING)
  : null;

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
