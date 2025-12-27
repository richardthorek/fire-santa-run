import { useState, useEffect, useCallback } from 'react';
import { storageAdapter } from '../storage';
import type { Route } from '../types';
import { useAuth } from '../context';
import { useUserProfile } from './useUserProfile';

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
      setRoutes(loadedRoutes);
    } catch (err) {
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

  const saveRoute = useCallback(async (route: Route) => {
    const brigadeIdToUse = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;
    if (!brigadeIdToUse) {
      throw new Error('User must be authenticated with a brigade to save routes');
    }

    try {
      // Ensure route has brigadeId set
      if (!route.brigadeId) {
        route.brigadeId = brigadeIdToUse;
      }
      await storageAdapter.saveRoute(brigadeIdToUse, route);
      await loadRoutes();
    } catch (err) {
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

  return {
    routes,
    isLoading,
    error,
    saveRoute,
    deleteRoute,
    getRoute,
    refreshRoutes: loadRoutes,
  };
}
