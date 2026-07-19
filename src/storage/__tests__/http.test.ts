/**
 * HTTP Storage Adapter Tests
 * 
 * Tests for the HTTP API storage adapter to verify it correctly calls
 * the API endpoints for user and membership operations.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpStorageAdapter } from '../http';
import type { User } from '../../types/user';

describe('HttpStorageAdapter - User Operations', () => {
  let adapter: HttpStorageAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock the global fetch function
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    adapter = new HttpStorageAdapter('/api');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserByEmail', () => {
    it('should fetch user by email successfully', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockUser),
        json: async () => mockUser,
      });

      const result = await adapter.getUserByEmail('test@example.com');

      expect(fetchMock).toHaveBeenCalledWith('/api/users/by-email/test%40example.com', { headers: {} });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await adapter.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should throw error on server error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.getUserByEmail('test@example.com')).rejects.toThrow(
        'Failed to fetch user by email: Internal Server Error'
      );
    });

    it('should properly encode email with special characters', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await adapter.getUserByEmail('test+tag@example.com');

      expect(fetchMock).toHaveBeenCalledWith('/api/users/by-email/test%2Btag%40example.com', { headers: {} });
    });
  });

  describe('saveUser', () => {
    it('should save user successfully', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await adapter.saveUser(mockUser);

      expect(fetchMock).toHaveBeenCalledWith('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockUser),
      });
    });

    it('should throw error on failure', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.saveUser(mockUser)).rejects.toThrow(
        'Failed to save user: Internal Server Error'
      );
    });
  });

  describe('getUser', () => {
    it('should fetch user by id successfully', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        entraUserId: 'entra-123',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockUser),
        json: async () => mockUser,
      });

      const result = await adapter.getUser('user-123');

      expect(fetchMock).toHaveBeenCalledWith('/api/users/user-123', { headers: {} });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await adapter.getUser('nonexistent');

      expect(result).toBeNull();
    });
  });
});
