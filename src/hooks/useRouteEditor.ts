import { useState, useCallback } from 'react';
import type { Route, Waypoint } from '../types';
import { getDirections } from '../utils/mapbox';
import {
  generateWaypointId,
  reorderWaypoints,
  sortWaypoints,
  validateRoute,
} from '../utils/routeHelpers';

/**
 * Custom hook for managing route editing operations
 */
export function useRouteEditor(initialRoute: Route) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  /**
   * Update route metadata (name, date, description, etc.)
   */
  const updateMetadata = useCallback((updates: Partial<Route>) => {
    setRoute(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Add a new waypoint
   */
  const addWaypoint = useCallback((coordinates: [number, number], address?: string, name?: string) => {
    const newWaypoint: Waypoint = {
      id: generateWaypointId(),
      coordinates,
      address,
      name,
      order: route.waypoints.length,
      isCompleted: false,
    };
    
    setRoute(prev => ({
      ...prev,
      waypoints: [...prev.waypoints, newWaypoint],
      // Clear navigation data when waypoints change
      geometry: undefined,
      navigationSteps: undefined,
      distance: undefined,
      estimatedDuration: undefined,
    }));
  }, [route.waypoints.length]);

  /**
   * Update an existing waypoint
   */
  const updateWaypoint = useCallback((waypointId: string, updates: Partial<Waypoint>) => {
    setRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp =>
        wp.id === waypointId ? { ...wp, ...updates } : wp
      ),
      // Clear navigation data when waypoints change
      geometry: undefined,
      navigationSteps: undefined,
      distance: undefined,
      estimatedDuration: undefined,
    }));
  }, []);

  /**
   * Delete a waypoint
   */
  const deleteWaypoint = useCallback((waypointId: string) => {
    setRoute(prev => {
      const filteredWaypoints = prev.waypoints.filter(wp => wp.id !== waypointId);
      // Reorder remaining waypoints
      const reorderedWaypoints = filteredWaypoints.map((wp, index) => ({
        ...wp,
        order: index,
      }));
      
      return {
        ...prev,
        waypoints: reorderedWaypoints,
        // Clear navigation data when waypoints change
        geometry: undefined,
        navigationSteps: undefined,
        distance: undefined,
        estimatedDuration: undefined,
      };
    });
  }, []);

  /**
   * Reorder waypoints (after drag and drop)
   */
  const moveWaypoint = useCallback((fromIndex: number, toIndex: number) => {
    setRoute(prev => ({
      ...prev,
      waypoints: reorderWaypoints(prev.waypoints, fromIndex, toIndex),
      // Clear navigation data when waypoints change
      geometry: undefined,
      navigationSteps: undefined,
      distance: undefined,
      estimatedDuration: undefined,
    }));
  }, []);

  /**
   * Optimize route using Mapbox Directions API
   */
  const optimizeRoute = useCallback(async () => {
    if (route.waypoints.length < 2) {
      setOptimizationError('At least 2 waypoints required');
      return false;
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      const coordinates = sortWaypoints(route.waypoints).map(wp => wp.coordinates);
      const result = await getDirections(coordinates);

      setRoute(prev => ({
        ...prev,
        geometry: result.geometry,
        navigationSteps: result.steps,
        distance: result.distance,
        estimatedDuration: result.duration,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to optimize route';
      setOptimizationError(message);
      console.error('Route optimization error:', error);
      return false;
    } finally {
      setIsOptimizing(false);
    }
  }, [route.waypoints]);

  /**
   * Validate the current route
   */
  const validate = useCallback(() => {
    return validateRoute(route);
  }, [route]);

  /**
   * Clear all waypoints
   */
  const clearWaypoints = useCallback(() => {
    setRoute(prev => ({
      ...prev,
      waypoints: [],
      geometry: undefined,
      navigationSteps: undefined,
      distance: undefined,
      estimatedDuration: undefined,
    }));
  }, []);

  /**
   * Reset route to initial state
   */
  const resetRoute = useCallback(() => {
    setRoute(initialRoute);
    setOptimizationError(null);
  }, [initialRoute]);

  return {
    route,
    updateMetadata,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    moveWaypoint,
    optimizeRoute,
    clearWaypoints,
    resetRoute,
    validate,
    isOptimizing,
    optimizationError,
  };
}
