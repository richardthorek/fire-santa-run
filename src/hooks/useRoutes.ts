import { useState, useEffect, useCallback } from 'react';
import { storageAdapter } from '../storage';
import { cacheRoutes, getCachedRoutes } from '../storage/offlineCache';
import { enqueueAction } from '../storage/syncQueue';
import type { Route } from '../types';
import { useAuth } from '../context';
import { useUserProfile } from './useUserProfile';
import { archiveRoute, restoreRoute, isEligibleForAutoArchive, DEFAULT_ARCHIVE_THRESHOLD_DAYS } from '../utils/routeHelpers';

/**
 * Custom hook for managing routes with the current brigade.
 * Automatically uses the authenticated user's brigadeId.
 */
export function useRoutes() {
  const { user } = useAuth();
  const { memberships } = useUserProfile();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Determine active brigadeId: prefer auth user's brigadeId, fallback to first active membership
  const activeBrigadeId = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;

  const loadRoutes = useCallback(async () => {
    if (!activeBrigadeId) {
      setRoutes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedRoutes = await storageAdapter.getRoutes(activeBrigadeId);

      // Auto-archive: fetch brigade settings to get threshold, then archive eligible routes
      let thresholdDays = DEFAULT_ARCHIVE_THRESHOLD_DAYS;
      try {
        const brigade = await storageAdapter.getBrigade(activeBrigadeId);
        if (brigade?.archiveThresholdDays != null && brigade.archiveThresholdDays > 0) {
          thresholdDays = brigade.archiveThresholdDays;
        }
      } catch {
        // ignore; use default threshold
      }

      const routesToAutoArchive = loadedRoutes.filter(r => isEligibleForAutoArchive(r, thresholdDays));
      if (routesToAutoArchive.length > 0) {
        await Promise.all(
          routesToAutoArchive.map(r => storageAdapter.saveRoute(activeBrigadeId, archiveRoute(r)))
        );
        // Reload after auto-archiving
        const updatedRoutes = await storageAdapter.getRoutes(activeBrigadeId);
        await cacheRoutes(activeBrigadeId, updatedRoutes);
        setRoutes(updatedRoutes);
      } else {
        await cacheRoutes(activeBrigadeId, loadedRoutes);
        setRoutes(loadedRoutes);
      }
      setIsFromCache(false);
    } catch (err) {
      // On any fetch failure (network error, server error), try to serve
      // cached data so routes remain viewable offline.
      const cachedRoutes = await getCachedRoutes(activeBrigadeId);
      if (cachedRoutes) {
        setRoutes(cachedRoutes);
        setIsFromCache(true);
        return;
      }
      const error = err instanceof Error ? err : new Error('Failed to load routes');
      setError(error);
      console.error('Error loading routes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeBrigadeId]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // Re-sync routes when the device comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (activeBrigadeId) {
        loadRoutes();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [activeBrigadeId, loadRoutes]);

  const saveRoute = useCallback(async (route: Route) => {
    const brigadeIdToUse = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;
    if (!brigadeIdToUse) {
      throw new Error('User must be authenticated with a brigade to save routes');
    }

    // Ensure route has brigadeId set
    if (!route.brigadeId) {
      route.brigadeId = brigadeIdToUse;
    }

    try {
      await storageAdapter.saveRoute(brigadeIdToUse, route);
      await loadRoutes();
    } catch (err) {
      // If offline, queue the action and optimistically update local state.
      if (!navigator.onLine) {
        await enqueueAction({ type: 'save-route', brigadeId: brigadeIdToUse, payload: route });
        setRoutes(prev => {
          const idx = prev.findIndex(r => r.id === route.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = route;
            return updated;
          }
          return [route, ...prev];
        });
        return;
      }
      const error = err instanceof Error ? err : new Error('Failed to save route');
      setError(error);
      throw error;
    }
  }, [user, memberships, loadRoutes]);

  const deleteRoute = useCallback(async (routeId: string) => {
    const brigadeIdToUse = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;
    if (!brigadeIdToUse) {
      throw new Error('User must be authenticated with a brigade to delete routes');
    }

    try {
      await storageAdapter.deleteRoute(brigadeIdToUse, routeId);
      await loadRoutes();
    } catch (err) {
      // If offline, queue the deletion and optimistically remove from local state.
      if (!navigator.onLine) {
        await enqueueAction({ type: 'delete-route', brigadeId: brigadeIdToUse, payload: { routeId } });
        setRoutes(prev => prev.filter(r => r.id !== routeId));
        return;
      }
      const error = err instanceof Error ? err : new Error('Failed to delete route');
      setError(error);
      throw error;
    }
  }, [user, memberships, loadRoutes]);

  const getRoute = useCallback(async (routeId: string): Promise<Route | null> => {
    const brigadeIdToUse = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;
    if (!brigadeIdToUse) {
      return null;
    }

    try {
      return await storageAdapter.getRoute(brigadeIdToUse, routeId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get route');
      setError(error);
      throw error;
    }
  }, [user, memberships]);

  const archiveRouteById = useCallback(async (routeId: string) => {
    const brigadeIdToUse = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;
    if (!brigadeIdToUse) {
      throw new Error('User must be authenticated with a brigade to archive routes');
    }

    try {
      const route = await storageAdapter.getRoute(brigadeIdToUse, routeId);
      if (!route) throw new Error('Route not found');
      await storageAdapter.saveRoute(brigadeIdToUse, archiveRoute(route));
      await loadRoutes();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to archive route');
      setError(error);
      throw error;
    }
  }, [user, memberships, loadRoutes]);

  const restoreRouteById = useCallback(async (routeId: string) => {
    const brigadeIdToUse = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;
    if (!brigadeIdToUse) {
      throw new Error('User must be authenticated with a brigade to restore routes');
    }

    try {
      const route = await storageAdapter.getRoute(brigadeIdToUse, routeId);
      if (!route) throw new Error('Route not found');
      await storageAdapter.saveRoute(brigadeIdToUse, restoreRoute(route));
      await loadRoutes();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to restore route');
      setError(error);
      throw error;
    }
  }, [user, memberships, loadRoutes]);

  return {
    routes,
    isLoading,
    error,
    isFromCache,
    saveRoute,
    deleteRoute,
    getRoute,
    archiveRoute: archiveRouteById,
    restoreRoute: restoreRouteById,
    refreshRoutes: loadRoutes,
  };
}
