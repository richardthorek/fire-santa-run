import { useState, useCallback } from 'react';
import type { Route, Waypoint } from '../types';
import type { GeoJSON } from '../types';
import type { NavigationStep } from '../types';
import { getDirections, nearestNeighborTsp } from '../utils/mapbox';
import {
  generateWaypointId,
  reorderWaypoints,
  sortWaypoints,
  validateRoute,
  calculateEstimatedArrivals,
  DEFAULT_NAVIGATION_SETTINGS,
} from '../utils/routeHelpers';

export interface OptimizationComparison {
  /** Distance/duration of the route in its current waypoint order (undefined if not yet planned). */
  originalDistance?: number;
  originalDuration?: number;
  /** Distance/duration of the TSP-optimised route. */
  optimizedDistance: number;
  optimizedDuration: number;
  /** Waypoints reordered for the optimised route. */
  optimizedWaypoints: Waypoint[];
  /** Route geometry for the optimised ordering. */
  optimizedGeometry: GeoJSON.LineString;
  /** Turn-by-turn steps for the optimised ordering. */
  optimizedSteps: NavigationStep[];
}

/**
 * Custom hook for managing route editing operations
 */
export function useRouteEditor(initialRoute: Route) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [optimizationComparison, setOptimizationComparison] = useState<OptimizationComparison | null>(null);

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
    
    setOptimizationComparison(null);
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
    setOptimizationComparison(null);
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
    setOptimizationComparison(null);
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
    setOptimizationComparison(null);
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

      // Calculate start date/time for ETA calculation
      const startDateTime = new Date(`${route.date}T${route.startTime}`);

      // Create temporary route with navigation data to calculate ETAs
      const tempRoute: Route = {
        ...route,
        geometry: result.geometry,
        navigationSteps: result.steps,
        distance: result.distance,
        estimatedDuration: result.duration,
        navigationSettings: route.navigationSettings || DEFAULT_NAVIGATION_SETTINGS,
      };

      // Calculate ETAs for waypoints
      const waypointsWithETAs = calculateEstimatedArrivals(tempRoute, startDateTime);

      setRoute(prev => ({
        ...prev,
        geometry: result.geometry,
        navigationSteps: result.steps,
        distance: result.distance,
        estimatedDuration: result.duration,
        waypoints: waypointsWithETAs,
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
  }, [route]);

  /**
   * Validate the current route
   */
  const validate = useCallback(() => {
    return validateRoute(route);
  }, [route]);

  /**
   * Optimize the waypoint visit order using a nearest-neighbour TSP heuristic.
   *
   * The first and last waypoints are always kept in place; only intermediate
   * stops are reordered.  The result is stored in `optimizationComparison` for
   * the user to inspect — nothing is applied until `acceptOptimization` is
   * called.
   *
   * Returns `true` on success, `false` on error.
   */
  const tspOptimizeRoute = useCallback(async () => {
    if (route.waypoints.length < 3) {
      setOptimizationError('At least 3 waypoints are required to optimise route order');
      return false;
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      const sorted = sortWaypoints(route.waypoints);
      const coordinates = sorted.map(wp => wp.coordinates);

      // Get the optimised visit order (first + last always kept in place)
      const optimizedIndices = nearestNeighborTsp(coordinates);

      // Build reordered waypoints
      const optimizedWaypoints = optimizedIndices.map((originalIdx, position) => ({
        ...sorted[originalIdx],
        order: position,
      }));

      // Calculate directions for the optimised order
      const optimizedCoordinates = optimizedIndices.map(i => coordinates[i]);
      const result = await getDirections(optimizedCoordinates);

      // Calculate ETAs for optimized waypoints
      const startDateTime = new Date(`${route.date}T${route.startTime}`);
      const tempRoute: Route = {
        ...route,
        waypoints: optimizedWaypoints,
        geometry: result.geometry,
        navigationSteps: result.steps,
        distance: result.distance,
        estimatedDuration: result.duration,
        navigationSettings: route.navigationSettings || DEFAULT_NAVIGATION_SETTINGS,
      };
      const optimizedWaypointsWithETAs = calculateEstimatedArrivals(tempRoute, startDateTime);

      setOptimizationComparison({
        originalDistance: route.distance,
        originalDuration: route.estimatedDuration,
        optimizedDistance: result.distance,
        optimizedDuration: result.duration,
        optimizedWaypoints: optimizedWaypointsWithETAs,
        optimizedGeometry: result.geometry,
        optimizedSteps: result.steps,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to optimise route';
      setOptimizationError(message);
      console.error('TSP optimisation error:', error);
      return false;
    } finally {
      setIsOptimizing(false);
    }
  }, [route]);

  /**
   * Apply the pending TSP optimisation: reorder waypoints and update route geometry.
   */
  const acceptOptimization = useCallback(() => {
    if (!optimizationComparison) return;
    setRoute(prev => ({
      ...prev,
      waypoints: optimizationComparison.optimizedWaypoints,
      geometry: optimizationComparison.optimizedGeometry,
      navigationSteps: optimizationComparison.optimizedSteps,
      distance: optimizationComparison.optimizedDistance,
      estimatedDuration: optimizationComparison.optimizedDuration,
    }));
    setOptimizationComparison(null);
  }, [optimizationComparison]);

  /**
   * Dismiss the pending TSP optimisation without applying it.
   */
  const rejectOptimization = useCallback(() => {
    setOptimizationComparison(null);
  }, []);

  /**
   * Clear all waypoints
   */
  const clearWaypoints = useCallback(() => {
    setOptimizationComparison(null);
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
    setOptimizationComparison(null);
  }, [initialRoute]);

  return {
    route,
    updateMetadata,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    moveWaypoint,
    optimizeRoute,
    tspOptimizeRoute,
    acceptOptimization,
    rejectOptimization,
    clearWaypoints,
    resetRoute,
    validate,
    isOptimizing,
    optimizationError,
    optimizationComparison,
  };
}
