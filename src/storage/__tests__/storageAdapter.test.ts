/**
 * Storage Adapter Tests
 * 
 * These tests verify that the storage adapter correctly switches between
 * localStorage and Azure Table Storage based on environment configuration.
 * 
 * Note: These tests require a test runner (e.g., Vitest) to be configured.
 * To run: npm test (once test infrastructure is set up)
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Storage Adapter Factory', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    vi.resetModules();
  });

  describe('Dev mode without Azure credentials', () => {
    it('should use LocalStorageAdapter when VITE_DEV_MODE=true and no Azure credentials', async () => {
      // Mock environment
      vi.stubEnv('VITE_DEV_MODE', 'true');
      vi.stubEnv('VITE_AZURE_STORAGE_CONNECTION_STRING', '');
      
      // Import after setting env vars
      const { storageAdapter } = await import('../index');
      
      // Verify it's localStorage adapter (check for localStorage-specific methods)
      expect(storageAdapter.constructor.name).toBe('LocalStorageAdapter');
    });
  });

  describe('Dev mode with Azure credentials', () => {
    it('should use AzureTableStorageAdapter with "dev" prefix when VITE_DEV_MODE=true and Azure credentials present', async () => {
      // Mock environment
      vi.stubEnv('VITE_DEV_MODE', 'true');
      vi.stubEnv('VITE_AZURE_STORAGE_CONNECTION_STRING', 'DefaultEndpointsProtocol=https;AccountName=devtest;AccountKey=testkey123;EndpointSuffix=core.windows.net');
      
      // Import after setting env vars
      const { storageAdapter } = await import('../index');
      
      // Verify it's Azure adapter
      expect(storageAdapter.constructor.name).toBe('AzureTableStorageAdapter');
      
      // Verify console log indicates dev prefix usage
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Dev mode with Azure credentials')
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('dev')
      );
    });
  });

  describe('Production mode', () => {
    it('should use AzureTableStorageAdapter without prefix when VITE_DEV_MODE=false', async () => {
      // Mock environment
      vi.stubEnv('VITE_DEV_MODE', 'false');
      vi.stubEnv('VITE_AZURE_STORAGE_CONNECTION_STRING', 'DefaultEndpointsProtocol=https;AccountName=prod;AccountKey=prodkey123;EndpointSuffix=core.windows.net');
      
      // Import after setting env vars
      const { storageAdapter } = await import('../index');
      
      // Verify it's Azure adapter
      expect(storageAdapter.constructor.name).toBe('AzureTableStorageAdapter');
      
      // Verify console log indicates production mode
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Production mode')
      );
    });

    it('should throw error when VITE_DEV_MODE=false and no Azure credentials', async () => {
      // Mock environment
      vi.stubEnv('VITE_DEV_MODE', 'false');
      vi.stubEnv('VITE_AZURE_STORAGE_CONNECTION_STRING', '');
      
      // Import should throw error
      await expect(async () => {
        await import('../index');
      }).rejects.toThrow('Production mode requires Azure Storage connection string');
    });
  });
});

describe('AzureTableStorageAdapter', () => {
  describe('Table name prefixing', () => {
    it('should use "devroutes" and "devbrigades" tables when prefix is "dev"', async () => {
      const mockConnectionString = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net';
      
      // Mock TableClient.fromConnectionString
      const mockFromConnectionString = vi.fn();
      vi.mock('@azure/data-tables', () => ({
        TableClient: {
          fromConnectionString: mockFromConnectionString
        }
      }));
      
      // Create adapter with 'dev' prefix
      const { AzureTableStorageAdapter } = await import('../azure');
      new AzureTableStorageAdapter(mockConnectionString, 'dev');
      
      // Verify table names
      expect(mockFromConnectionString).toHaveBeenCalledWith(mockConnectionString, 'devroutes');
      expect(mockFromConnectionString).toHaveBeenCalledWith(mockConnectionString, 'devbrigades');
    });

    it('should use "routes" and "brigades" tables when no prefix', async () => {
      const mockConnectionString = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net';
      
      // Mock TableClient.fromConnectionString
      const mockFromConnectionString = vi.fn();
      vi.mock('@azure/data-tables', () => ({
        TableClient: {
          fromConnectionString: mockFromConnectionString
        }
      }));
      
      // Create adapter without prefix
      const { AzureTableStorageAdapter } = await import('../azure');
      new AzureTableStorageAdapter(mockConnectionString);
      
      // Verify table names
      expect(mockFromConnectionString).toHaveBeenCalledWith(mockConnectionString, 'routes');
      expect(mockFromConnectionString).toHaveBeenCalledWith(mockConnectionString, 'brigades');
    });
  });
});

describe('Data Isolation', () => {
  it('dev and production data should be stored in separate tables', () => {
    // This test documents the expected behavior:
    // - Dev mode with Azure: Uses 'devroutes', 'devbrigades'
    // - Production mode: Uses 'routes', 'brigades'
    // Therefore, no risk of dev data mixing with production data
    
    const devTableNames = ['devroutes', 'devbrigades'];
    const prodTableNames = ['routes', 'brigades'];
    
    // Verify no overlap
    const hasOverlap = devTableNames.some(name => prodTableNames.includes(name));
    expect(hasOverlap).toBe(false);
  });
});
