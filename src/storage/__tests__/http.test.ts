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
import type { BrigadeMembership } from '../../types/membership';

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

      expect(fetchMock).toHaveBeenCalledWith('/api/users/by-email/test%40example.com');
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

      expect(fetchMock).toHaveBeenCalledWith('/api/users/by-email/test%2Btag%40example.com');
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

      expect(fetchMock).toHaveBeenCalledWith('/api/users/user-123');
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

describe('HttpStorageAdapter - Membership Operations', () => {
  let adapter: HttpStorageAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    adapter = new HttpStorageAdapter('/api');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMembershipsByUser', () => {
    it('should fetch user memberships successfully', async () => {
      const mockMemberships: BrigadeMembership[] = [
        {
          id: 'member-1',
          brigadeId: 'brigade-1',
          userId: 'user-123',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockMemberships),
        json: async () => mockMemberships,
      });

      const result = await adapter.getMembershipsByUser('user-123');

      expect(fetchMock).toHaveBeenCalledWith('/api/users/user-123/memberships');
      expect(result).toEqual(mockMemberships);
    });

    it('should throw error on failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.getMembershipsByUser('user-123')).rejects.toThrow(
        'Failed to fetch user memberships: Internal Server Error'
      );
    });
  });

  describe('getMembershipsByBrigade', () => {
    it('should fetch brigade memberships successfully', async () => {
      const mockMemberships: BrigadeMembership[] = [
        {
          id: 'member-1',
          brigadeId: 'brigade-1',
          userId: 'user-123',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMemberships,
      });

      const result = await adapter.getMembershipsByBrigade('brigade-1');

      expect(fetchMock).toHaveBeenCalledWith('/api/brigades/brigade-1/members');
      expect(result).toEqual(mockMemberships);
    });
  });

  describe('getPendingMembershipsByBrigade', () => {
    it('should fetch pending memberships successfully', async () => {
      const mockMemberships: BrigadeMembership[] = [
        {
          id: 'member-2',
          brigadeId: 'brigade-1',
          userId: 'user-456',
          role: 'operator',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMemberships,
      });

      const result = await adapter.getPendingMembershipsByBrigade('brigade-1');

      expect(fetchMock).toHaveBeenCalledWith('/api/brigades/brigade-1/members/pending');
      expect(result).toEqual(mockMemberships);
    });
  });
});
