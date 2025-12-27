import { TableClient, TableServiceClient } from '@azure/data-tables';

// Resolve the connection string from either VITE_ env (Static Web Apps) or AzureWebJobsStorage (Functions local).
export const STORAGE_CONNECTION_STRING: string = (
  process.env.VITE_AZURE_STORAGE_CONNECTION_STRING ||
  process.env.AzureWebJobsStorage ||
  ''
);

export const isDevMode = process.env.VITE_DEV_MODE === 'true';

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
    } catch (error: any) {
      // Ignore if table already exists; surface other errors.
      if (error?.statusCode !== 409 && error?.code !== 'TableAlreadyExists') {
        throw error;
      }
    }
    createdTables.add(tableName);
  }

  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, tableName);
}
