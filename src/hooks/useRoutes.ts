import { useState, useEffect, useCallback } from 'react';
import { storageAdapter } from '../storage';
import type { Route } from '../types';
import { useAuth } from '../context';

/**
 * Custom hook for managing routes with the current brigade.
 * Automatically uses the authenticated user's brigadeId.
 */
export function useRoutes() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRoutes = useCallback(async () => {
    if (!user?.brigadeId) {
      setRoutes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const loadedRoutes = await storageAdapter.getRoutes(user.brigadeId);
      setRoutes(loadedRoutes);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load routes');
      setError(error);
      console.error('Error loading routes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const saveRoute = useCallback(async (route: Route) => {
    if (!user?.brigadeId) {
      throw new Error('User must be authenticated with a brigade to save routes');
    }

    try {
      await storageAdapter.saveRoute(user.brigadeId, route);
      await loadRoutes();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save route');
      setError(error);
      throw error;
    }
  }, [user, loadRoutes]);

  const deleteRoute = useCallback(async (routeId: string) => {
    if (!user?.brigadeId) {
      throw new Error('User must be authenticated with a brigade to delete routes');
    }

    try {
      await storageAdapter.deleteRoute(user.brigadeId, routeId);
      await loadRoutes();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete route');
      setError(error);
      throw error;
    }
  }, [user, loadRoutes]);

  const getRoute = useCallback(async (routeId: string): Promise<Route | null> => {
    if (!user?.brigadeId) {
      return null;
    }

    try {
      return await storageAdapter.getRoute(user.brigadeId, routeId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get route');
      setError(error);
      throw error;
    }
  }, [user]);

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
