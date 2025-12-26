/**
 * Unit tests for navigation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  findNextWaypoint,
  isNearWaypoint,
  calculateDistance,
} from '../navigation';
import type { Waypoint } from '../../types';

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
});
