import { TableClient } from '@azure/data-tables';
import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';

/**
 * Azure Table Storage implementation of the storage adapter.
 * Used in production mode (VITE_DEV_MODE=false) or dev mode with Azure credentials.
 * 
 * Table naming:
 * - Production: 'routes', 'brigades'
 * - Dev mode: 'devroutes', 'devbrigades'
 */
export class AzureTableStorageAdapter implements IStorageAdapter {
  private routesClient: TableClient;
  private brigadesClient: TableClient;
  
  /**
   * Creates an Azure Table Storage adapter.
   * @param connectionString - Azure Storage connection string
   * @param tablePrefix - Prefix for table names (e.g., 'dev' for dev mode)
   */
  constructor(connectionString: string, tablePrefix: string = '') {
    if (!connectionString) {
      throw new Error('Azure Storage connection string is required');
    }

    const routesTableName = tablePrefix ? `${tablePrefix}routes` : 'routes';
    const brigadesTableName = tablePrefix ? `${tablePrefix}brigades` : 'brigades';
    
    this.routesClient = TableClient.fromConnectionString(connectionString, routesTableName);
    this.brigadesClient = TableClient.fromConnectionString(connectionString, brigadesTableName);
    
    // Ensure tables exist (creates if not exists)
    this.initializeTables().catch(err => {
      console.error('Failed to initialize Azure tables:', err);
    });
  }

  private async initializeTables(): Promise<void> {
    try {
      await this.routesClient.createTable();
    } catch (err: unknown) {
      const error = err as { statusCode?: number };
      // Ignore if table already exists (409)
      if (error.statusCode !== 409) {
        throw err;
      }
    }
    
    try {
      await this.brigadesClient.createTable();
    } catch (err: unknown) {
      const error = err as { statusCode?: number };
      // Ignore if table already exists (409)
      if (error.statusCode !== 409) {
        throw err;
      }
    }
  }

  async saveRoute(brigadeId: string, route: Route): Promise<void> {
    const entity = {
      partitionKey: brigadeId,
      rowKey: route.id,
      ...route,
    };
    
    try {
      await this.routesClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save route to Azure Table Storage:', error);
      throw new Error('Failed to save route');
    }
  }

  async getRoutes(brigadeId: string): Promise<Route[]> {
    try {
      const routes: Route[] = [];
      const entities = this.routesClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${brigadeId}'` }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...routeData } = entity;
        routes.push(routeData as unknown as Route);
      }
      
      return routes;
    } catch (error) {
      console.error('Failed to get routes from Azure Table Storage:', error);
      return [];
    }
  }

  async getRoute(brigadeId: string, routeId: string): Promise<Route | null> {
    try {
      const entity = await this.routesClient.getEntity(brigadeId, routeId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, ...routeData } = entity;
      return routeData as unknown as Route;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get route from Azure Table Storage:', error);
      throw new Error('Failed to get route');
    }
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    try {
      await this.routesClient.deleteEntity(brigadeId, routeId);
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        // Entity doesn't exist, consider it a success
        return;
      }
      console.error('Failed to delete route from Azure Table Storage:', error);
      throw new Error('Failed to delete route');
    }
  }

  async getBrigade(brigadeId: string): Promise<Brigade | null> {
    try {
      const entity = await this.brigadesClient.getEntity('brigades', brigadeId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, ...brigadeData } = entity;
      return brigadeData as unknown as Brigade;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get brigade from Azure Table Storage:', error);
      throw new Error('Failed to get brigade');
    }
  }

  async saveBrigade(brigade: Brigade): Promise<void> {
    const entity = {
      partitionKey: 'brigades',
      rowKey: brigade.id,
      ...brigade,
    };
    
    try {
      await this.brigadesClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save brigade to Azure Table Storage:', error);
      throw new Error('Failed to save brigade');
    }
  }
}
