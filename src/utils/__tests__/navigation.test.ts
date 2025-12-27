/**
 * Unit tests for navigation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  findNextWaypoint,
  isNearWaypoint,
  calculateDistance,
  calculateBearing,
  findClosestPointOnRoute,
  findCurrentStep,
  calculateRouteProgress,
  isOffRoute,
  calculateETA,
  formatETA,
  getRemainingDistance,
} from '../navigation';
import type { Waypoint, NavigationStep, GeoJSON } from '../../types';

describe('navigation', () => {
  describe('findNextWaypoint', () => {
    it('should find the first uncompleted waypoint', () => {
      const waypoints: Waypoint[] = [
        { id: '1', coordinates: [0, 0], order: 1, isCompleted: true },
        { id: '2', coordinates: [0, 0], order: 2, isCompleted: false },
        { id: '3', coordinates: [0, 0], order: 3, isCompleted: false },
      ];

      const next = findNextWaypoint(waypoints);
      expect(next).toBeDefined();
      expect(next?.id).toBe('2');
      expect(next?.order).toBe(2);
    });

    it('should return null when all waypoints are completed', () => {
      const waypoints: Waypoint[] = [
        { id: '1', coordinates: [0, 0], order: 1, isCompleted: true },
        { id: '2', coordinates: [0, 0], order: 2, isCompleted: true },
      ];

      const next = findNextWaypoint(waypoints);
      expect(next).toBeNull();
    });

    it('should return first waypoint when none are completed', () => {
      const waypoints: Waypoint[] = [
        { id: '1', coordinates: [0, 0], order: 1, isCompleted: false },
        { id: '2', coordinates: [0, 0], order: 2, isCompleted: false },
      ];

      const next = findNextWaypoint(waypoints);
      expect(next).toBeDefined();
      expect(next?.id).toBe('1');
      expect(next?.order).toBe(1);
    });

    it('should handle empty waypoint array', () => {
      const next = findNextWaypoint([]);
      expect(next).toBeNull();
    });
  });

  describe('isNearWaypoint', () => {
    it('should return true when within threshold', () => {
      const userLocation: [number, number] = [151.2093, -33.8688]; // Sydney coords
      const waypoint: Waypoint = {
        id: '1',
        coordinates: [151.2093, -33.8688], // Same location
        order: 1,
        isCompleted: false,
      };

      const isNear = isNearWaypoint(userLocation, waypoint, 100);
      expect(isNear).toBe(true);
    });

    it('should return false when beyond threshold', () => {
      const userLocation: [number, number] = [151.2093, -33.8688]; // Sydney
      const waypoint: Waypoint = {
        id: '1',
        coordinates: [151.2073, -33.8708], // ~2km away
        order: 1,
        isCompleted: false,
      };

      const isNear = isNearWaypoint(userLocation, waypoint, 100);
      expect(isNear).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const coord1: [number, number] = [151.2093, -33.8688];
      const coord2: [number, number] = [151.2093, -33.8688];

      const distance = calculateDistance(coord1, coord2);
      expect(distance).toBeCloseTo(0, 1);
    });

    it('should calculate distance between different coordinates', () => {
      const coord1: [number, number] = [151.2093, -33.8688]; // Sydney Opera House
      const coord2: [number, number] = [151.2095, -33.8690]; // Very close

      const distance = calculateDistance(coord1, coord2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // Less than 100m
    });

    it('should handle coordinates across larger distances', () => {
      const sydney: [number, number] = [151.2093, -33.8688];
      const melbourne: [number, number] = [144.9631, -37.8136];

      const distance = calculateDistance(sydney, melbourne);
      expect(distance).toBeGreaterThan(700000); // ~700km+
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing between two points', () => {
      const sydney: [number, number] = [151.2093, -33.8688];
      const melbourne: [number, number] = [144.9631, -37.8136];

      const bearing = calculateBearing(sydney, melbourne);
      
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });

    it('should return 0 for north direction', () => {
      const start: [number, number] = [0, 0];
      const north: [number, number] = [0, 1];

      const bearing = calculateBearing(start, north);
      
      expect(bearing).toBeCloseTo(0, 0);
    });

    it('should return 90 for east direction', () => {
      const start: [number, number] = [0, 0];
      const east: [number, number] = [1, 0];

      const bearing = calculateBearing(start, east);
      
      expect(bearing).toBeCloseTo(90, 0);
    });
  });

  describe('findClosestPointOnRoute', () => {
    it('should find closest point on a simple route', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2090, -33.8685],
          [151.2095, -33.8690],
          [151.2100, -33.8695],
        ],
      };

      const result = findClosestPointOnRoute(userLocation, routeGeometry);

      expect(result.point).toBeDefined();
      expect(result.distance).toBeGreaterThanOrEqual(0);
      expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
    });

    it('should return first point when user is at start', () => {
      const userLocation: [number, number] = [151.2090, -33.8685];
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2090, -33.8685],
          [151.2095, -33.8690],
        ],
      };

      const result = findClosestPointOnRoute(userLocation, routeGeometry);

      expect(result.distance).toBeCloseTo(0, 0);
      expect(result.segmentIndex).toBe(0);
    });
  });

  describe('findCurrentStep', () => {
    it('should handle empty steps array', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const steps: NavigationStep[] = [];

      const result = findCurrentStep(userLocation, steps);

      expect(result.stepIndex).toBe(0);
      expect(result.distanceToManeuver).toBe(0);
    });

    it('should find current step based on location', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const steps: NavigationStep[] = [
        {
          distance: 100,
          duration: 60,
          instruction: 'Go straight',
          maneuver: {
            type: 'depart',
            location: [151.2090, -33.8685],
            instruction: 'Head north',
          },
        },
        {
          distance: 200,
          duration: 120,
          instruction: 'Turn left',
          maneuver: {
            type: 'turn',
            location: [151.2095, -33.8690],
            instruction: 'Turn left',
          },
        },
      ];

      const result = findCurrentStep(userLocation, steps);

      expect(result.stepIndex).toBeGreaterThanOrEqual(0);
      expect(result.stepIndex).toBeLessThan(steps.length);
      expect(result.distanceToManeuver).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateRouteProgress', () => {
    it('should return 0 for no waypoints', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [[151.2090, -33.8685], [151.2095, -33.8690]],
      };
      const waypoints: Waypoint[] = [];

      const progress = calculateRouteProgress(userLocation, routeGeometry, waypoints);

      expect(progress).toBe(0);
    });

    it('should calculate progress based on completed waypoints', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2090, -33.8685],
          [151.2095, -33.8690],
          [151.2100, -33.8695],
        ],
      };
      const waypoints: Waypoint[] = [
        { id: '1', coordinates: [151.2090, -33.8685], order: 0, isCompleted: true },
        { id: '2', coordinates: [151.2095, -33.8690], order: 1, isCompleted: false },
        { id: '3', coordinates: [151.2100, -33.8695], order: 2, isCompleted: false },
      ];

      const progress = calculateRouteProgress(userLocation, routeGeometry, waypoints);

      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('should return progress towards 100 when all completed', () => {
      const userLocation: [number, number] = [151.2100, -33.8695];
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2090, -33.8685],
          [151.2100, -33.8695],
        ],
      };
      const waypoints: Waypoint[] = [
        { id: '1', coordinates: [151.2090, -33.8685], order: 0, isCompleted: true },
        { id: '2', coordinates: [151.2100, -33.8695], order: 1, isCompleted: true },
      ];

      const progress = calculateRouteProgress(userLocation, routeGeometry, waypoints);

      expect(progress).toBeGreaterThan(70); // Should be high
    });
  });

  describe('isOffRoute', () => {
    it('should return false when on route', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2090, -33.8685],
          [151.2095, -33.8690],
        ],
      };

      const result = isOffRoute(userLocation, routeGeometry, 1000);

      expect(result).toBe(false);
    });

    it('should return true when far from route', () => {
      const userLocation: [number, number] = [151.2200, -33.8800]; // Far away
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2090, -33.8685],
          [151.2095, -33.8690],
        ],
      };

      const result = isOffRoute(userLocation, routeGeometry, 100);

      expect(result).toBe(true);
    });
  });

  describe('calculateETA', () => {
    it('should calculate ETA based on distance and speed', () => {
      const distance = 1000; // 1km
      const speed = 10; // 10 m/s
      
      const eta = calculateETA(distance, speed);
      const now = Date.now();

      expect(eta.getTime()).toBeGreaterThan(now);
      expect(eta.getTime()).toBeLessThan(now + 200000); // Within ~3 minutes
    });

    it('should use fallback speed when speed is null', () => {
      const distance = 1000;
      
      const eta = calculateETA(distance, null, 40);
      const now = Date.now();

      expect(eta.getTime()).toBeGreaterThan(now);
    });
  });

  describe('formatETA', () => {
    it('should format time in 12-hour format', () => {
      const date = new Date('2024-12-24T14:30:00Z');
      const formatted = formatETA(date);

      expect(formatted).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('should pad minutes with zero', () => {
      const date = new Date('2024-12-24T14:05:00Z');
      const formatted = formatETA(date);

      expect(formatted).toContain(':05');
    });

    it('should handle midnight correctly', () => {
      const date = new Date('2024-12-24T00:00:00Z');
      const formatted = formatETA(date);

      expect(formatted).toMatch(/12:00 AM/);
    });
  });

  describe('getRemainingDistance', () => {
    it('should calculate remaining distance from steps', () => {
      const userLocation: [number, number] = [151.2093, -33.8688];
      const steps: NavigationStep[] = [
        {
          distance: 100,
          duration: 60,
          instruction: 'Go straight',
          maneuver: {
            type: 'depart',
            location: [151.2090, -33.8685],
            instruction: 'Head north',
          },
        },
        {
          distance: 200,
          duration: 120,
          instruction: 'Turn left',
          maneuver: {
            type: 'turn',
            location: [151.2095, -33.8690],
            instruction: 'Turn left',
          },
        },
      ];

      const remaining = getRemainingDistance(userLocation, steps, 0);

      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when at end', () => {
      const userLocation: [number, number] = [151.2095, -33.8690];
      const steps: NavigationStep[] = [
        {
          distance: 100,
          duration: 60,
          instruction: 'Arrive',
          maneuver: {
            type: 'arrive',
            location: [151.2095, -33.8690],
            instruction: 'You have arrived',
          },
        },
      ];

      const remaining = getRemainingDistance(userLocation, steps, steps.length);

      expect(remaining).toBe(0);
    });
  });
});
