/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';

/**
 * Azure Table Storage implementation of the storage adapter.
 * Used in production mode (VITE_DEV_MODE=false).
 * This is a placeholder that will be implemented when Azure services are configured.
 */
export class AzureTableStorageAdapter implements IStorageAdapter {
  async saveRoute(_brigadeId: string, _route: Route): Promise<void> {
    // TODO: Implement Azure Table Storage integration
    // Will use @azure/data-tables SDK
    // PartitionKey: brigadeId, RowKey: routeId
    throw new Error('Azure Table Storage not yet configured. Set VITE_DEV_MODE=true for development.');
  }

  async getRoutes(_brigadeId: string): Promise<Route[]> {
    // TODO: Implement Azure Table Storage integration
    throw new Error('Azure Table Storage not yet configured. Set VITE_DEV_MODE=true for development.');
  }

  async getRoute(_brigadeId: string, _routeId: string): Promise<Route | null> {
    // TODO: Implement Azure Table Storage integration
    throw new Error('Azure Table Storage not yet configured. Set VITE_DEV_MODE=true for development.');
  }

  async deleteRoute(_brigadeId: string, _routeId: string): Promise<void> {
    // TODO: Implement Azure Table Storage integration
    throw new Error('Azure Table Storage not yet configured. Set VITE_DEV_MODE=true for development.');
  }

  async getBrigade(_brigadeId: string): Promise<Brigade | null> {
    // TODO: Implement Azure Table Storage integration
    throw new Error('Azure Table Storage not yet configured. Set VITE_DEV_MODE=true for development.');
  }

  async saveBrigade(_brigade: Brigade): Promise<void> {
    // TODO: Implement Azure Table Storage integration
    throw new Error('Azure Table Storage not yet configured. Set VITE_DEV_MODE=true for development.');
  }
}
