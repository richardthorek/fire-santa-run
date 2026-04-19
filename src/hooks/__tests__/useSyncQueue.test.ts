/**
 * Tests for useSyncQueue hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock the syncQueue storage module
// ---------------------------------------------------------------------------

const mockGetPendingActions = vi.fn();
const mockGetPendingCount = vi.fn();
const mockDequeueAction = vi.fn();
const mockIncrementRetryCount = vi.fn();
const mockDeduplicateActions = vi.fn();
const mockEnqueueAction = vi.fn();

vi.mock('../../storage/syncQueue', () => ({
  getPendingActions: mockGetPendingActions,
  getPendingCount: mockGetPendingCount,
  dequeueAction: mockDequeueAction,
  incrementRetryCount: mockIncrementRetryCount,
  deduplicateActions: mockDeduplicateActions,
  enqueueAction: mockEnqueueAction,
}));

// ---------------------------------------------------------------------------
// Mock the storage adapter
// ---------------------------------------------------------------------------

const mockSaveRoute = vi.fn();
const mockDeleteRoute = vi.fn();

vi.mock('../../storage', () => ({
  storageAdapter: {
    saveRoute: mockSaveRoute,
    deleteRoute: mockDeleteRoute,
  },
}));

// ---------------------------------------------------------------------------
// Helper to control navigator.onLine
// ---------------------------------------------------------------------------

let mockIsOnline = true;

vi.mock('../useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSyncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
    mockGetPendingCount.mockResolvedValue(0);
    mockGetPendingActions.mockResolvedValue([]);
    mockDeduplicateActions.mockImplementation((actions) => actions);
    mockDequeueAction.mockResolvedValue(undefined);
    mockIncrementRetryCount.mockResolvedValue(undefined);
    mockSaveRoute.mockResolvedValue(undefined);
    mockDeleteRoute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with pendingCount loaded from the queue', async () => {
    mockGetPendingCount.mockResolvedValue(3);

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(3);
    });
  });

  it('initializes isSyncing as false', async () => {
    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    expect(result.current.isSyncing).toBe(false);
  });

  it('processQueue does nothing when queue is empty', async () => {
    mockGetPendingActions.mockResolvedValue([]);

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.processQueue();
    });

    expect(mockSaveRoute).not.toHaveBeenCalled();
    expect(mockDeleteRoute).not.toHaveBeenCalled();
  });

  it('processQueue applies save-route actions', async () => {
    const route = {
      id: 'route-1',
      brigadeId: 'brigade-a',
      name: 'Test Route',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [],
      createdAt: new Date().toISOString(),
    };

    const action = {
      id: 'action-1',
      type: 'save-route',
      brigadeId: 'brigade-a',
      payload: route,
      timestamp: Date.now(),
      retryCount: 0,
    };

    mockGetPendingActions.mockResolvedValue([action]);
    mockDeduplicateActions.mockReturnValue([action]);
    mockGetPendingCount.mockResolvedValue(0);

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.processQueue();
    });

    expect(mockSaveRoute).toHaveBeenCalledWith('brigade-a', route);
    expect(mockDequeueAction).toHaveBeenCalledWith('action-1');
  });

  it('processQueue applies delete-route actions', async () => {
    const action = {
      id: 'action-2',
      type: 'delete-route',
      brigadeId: 'brigade-a',
      payload: { routeId: 'route-1' },
      timestamp: Date.now(),
      retryCount: 0,
    };

    mockGetPendingActions.mockResolvedValue([action]);
    mockDeduplicateActions.mockReturnValue([action]);
    mockGetPendingCount.mockResolvedValue(0);

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.processQueue();
    });

    expect(mockDeleteRoute).toHaveBeenCalledWith('brigade-a', 'route-1');
    expect(mockDequeueAction).toHaveBeenCalledWith('action-2');
  });

  it('sets lastSyncError when an action fails', async () => {
    const action = {
      id: 'action-3',
      type: 'save-route',
      brigadeId: 'brigade-a',
      payload: { id: 'route-1', brigadeId: 'brigade-a', name: 'R', date: '2024-12-24', startTime: '18:00', status: 'draft', waypoints: [], createdAt: '' },
      timestamp: Date.now(),
      retryCount: 0,
    };

    mockGetPendingActions.mockResolvedValue([action]);
    mockDeduplicateActions.mockReturnValue([action]);
    mockSaveRoute.mockRejectedValue(new Error('Network error'));

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.processQueue();
    });

    expect(result.current.lastSyncError).toBe('Network error');
    expect(mockIncrementRetryCount).toHaveBeenCalledWith('action-3');
  });

  it('clears lastSyncError when clearError is called', async () => {
    const action = {
      id: 'action-4',
      type: 'save-route',
      brigadeId: 'brigade-a',
      payload: { id: 'route-1', brigadeId: 'brigade-a', name: 'R', date: '2024-12-24', startTime: '18:00', status: 'draft', waypoints: [], createdAt: '' },
      timestamp: Date.now(),
      retryCount: 0,
    };

    mockGetPendingActions.mockResolvedValue([action]);
    mockDeduplicateActions.mockReturnValue([action]);
    mockSaveRoute.mockRejectedValue(new Error('fail'));

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.processQueue();
    });

    expect(result.current.lastSyncError).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.lastSyncError).toBeNull();
  });

  it('removes superseded actions that were deduplicated away', async () => {
    const route = {
      id: 'route-1',
      brigadeId: 'brigade-a',
      name: 'Latest',
      date: '2024-12-24',
      startTime: '18:00',
      status: 'draft',
      waypoints: [],
      createdAt: '',
    };

    const olderAction = { id: 'old-action', type: 'save-route', brigadeId: 'brigade-a', payload: { ...route, name: 'Old' }, timestamp: 1000, retryCount: 0 };
    const newerAction = { id: 'new-action', type: 'save-route', brigadeId: 'brigade-a', payload: route, timestamp: 2000, retryCount: 0 };

    mockGetPendingActions.mockResolvedValue([olderAction, newerAction]);
    // Deduplicate returns only the newer action
    mockDeduplicateActions.mockReturnValue([newerAction]);
    mockGetPendingCount.mockResolvedValue(0);

    const { useSyncQueue } = await import('../useSyncQueue');
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.processQueue();
    });

    // The older (superseded) action should be dequeued
    expect(mockDequeueAction).toHaveBeenCalledWith('old-action');
    // The newer action should be applied and then dequeued
    expect(mockSaveRoute).toHaveBeenCalledTimes(1);
    expect(mockDequeueAction).toHaveBeenCalledWith('new-action');
  });
});
