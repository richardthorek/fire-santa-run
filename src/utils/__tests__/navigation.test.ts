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
  alongPathDistance,
  computeCumulativeDistances,
  computeStepAlongDistances,
  projectOntoRoute,
  updateSmoothedSpeed,
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

  describe('computeCumulativeDistances', () => {
    it('starts at 0 and accumulates segment lengths', () => {
      const coords: [number, number][] = [
        [151.2000, -33.8688],
        [151.2030, -33.8688],
        [151.2060, -33.8688],
      ];
      const cumulative = computeCumulativeDistances(coords);

      expect(cumulative).toHaveLength(3);
      expect(cumulative[0]).toBe(0);
      expect(cumulative[1]).toBeCloseTo(calculateDistance(coords[0], coords[1]), 0);
      expect(cumulative[2]).toBeCloseTo(
        calculateDistance(coords[0], coords[1]) + calculateDistance(coords[1], coords[2]),
        0,
      );
    });
  });

  describe('projectOntoRoute (along-route matching)', () => {
    // A straight east-west path, ~1.1km, vertex every ~275m.
    const straightPath: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [151.2000, -33.8688],
        [151.2030, -33.8688],
        [151.2060, -33.8688],
        [151.2090, -33.8688],
        [151.2120, -33.8688],
      ],
    };
    const straightCumulative = computeCumulativeDistances(straightPath.coordinates);

    it('projects onto the nearest point and reports along-route distance', () => {
      const user: [number, number] = [151.2030, -33.8688]; // exactly on vertex 1
      const result = projectOntoRoute(user, straightPath, straightCumulative, null);

      expect(result.offRouteDistance).toBeLessThan(1);
      expect(result.alongRouteDistance).toBeCloseTo(straightCumulative[1], 0);
    });

    it('progress stays monotonic on a looping route that revisits an intersection', () => {
      // A square loop that returns to its starting corner — a common
      // Santa-run shape (a full lap of the block, back to the same corner).
      const loopingPath: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2000, -33.8688], // 0: the intersection — start of the loop
          [151.2060, -33.8688], // 1: east
          [151.2060, -33.8733], // 2: south
          [151.2000, -33.8733], // 3: west
          [151.2000, -33.8688], // 4: north — back to the SAME coordinate as vertex 0
        ],
      };
      const cumulative = computeCumulativeDistances(loopingPath.coordinates);
      const totalLength = cumulative[cumulative.length - 1];

      // Early in the loop, near the start — matches the first (0-1) segment.
      const early = projectOntoRoute([151.2005, -33.8688], loopingPath, cumulative, null);
      expect(early.segmentIndex).toBe(0);

      // Most of the way around, on the final leg heading back towards the
      // shared intersection.
      const approaching = projectOntoRoute(
        [151.2000, -33.8690],
        loopingPath,
        cumulative,
        cumulative[3] + 5,
      );
      expect(approaching.segmentIndex).toBe(3);
      expect(approaching.alongRouteDistance).toBeGreaterThan(cumulative[3] - 1);

      // GPS now reads the EXACT intersection coordinate again. A plain
      // nearest-point search would find it equally well as "vertex 0"
      // (along-route ~0, the already-passed first visit) or "vertex 4"
      // (along-route = totalLength, the current one) — with the windowed
      // hint from the previous tick, it resolves forward to the current
      // pass, not back to the start.
      const revisiting = projectOntoRoute(
        [151.2000, -33.8688],
        loopingPath,
        cumulative,
        approaching.alongRouteDistance,
      );
      expect(revisiting.segmentIndex).toBe(3); // NOT segment 0 (the earlier, already-passed visit)
      expect(revisiting.alongRouteDistance).toBeGreaterThan(approaching.alongRouteDistance - 1);

      // First fix of a run that starts and finishes at the same station: with
      // no previous progress it must match the START, not the finish.
      const firstFix = projectOntoRoute([151.2000, -33.8688], loopingPath, cumulative, null);
      expect(firstFix.alongRouteDistance).toBeLessThan(1);
      expect(revisiting.alongRouteDistance).toBeGreaterThan(totalLength - 1);
    });

    it('falls back to a full search when there is no usable previous match (e.g. after a reroute)', () => {
      const user: [number, number] = [151.2090, -33.8688]; // near vertex 3
      const result = projectOntoRoute(user, straightPath, straightCumulative, null);

      expect(result.offRouteDistance).toBeLessThan(1);
      expect(result.alongRouteDistance).toBeCloseTo(straightCumulative[3], 0);
    });
  });

  describe('findCurrentStep (along-route)', () => {
    // Steps' maneuver along-route distances, precomputed as computeStepAlongDistances would.
    const stepAlongDistances = [0, 300, 700, 1000];

    it('should handle no steps', () => {
      const result = findCurrentStep(150, []);

      expect(result.stepIndex).toBe(0);
      expect(result.distanceToManeuver).toBe(0);
    });

    it('returns the first maneuver still ahead of the user', () => {
      const result = findCurrentStep(150, stepAlongDistances);

      expect(result.stepIndex).toBe(1);
      expect(result.distanceToManeuver).toBeCloseTo(150, 0);
    });

    it('never reports a maneuver already passed', () => {
      // User is just past maneuver 1 (300m) but hasn't reached maneuver 2 (700m) yet.
      const result = findCurrentStep(310, stepAlongDistances);

      expect(result.stepIndex).toBe(2);
      expect(result.stepIndex).not.toBe(1);
    });

    it('holds on the final step once every maneuver has been passed', () => {
      const result = findCurrentStep(1200, stepAlongDistances);

      expect(result.stepIndex).toBe(stepAlongDistances.length - 1);
    });

    it('does not flicker back to an earlier step for a maneuver essentially reached (epsilon tolerance)', () => {
      // At 299m, still 1m short of maneuver 1 (300m) — within the small
      // epsilon tolerance, so it should already report the NEXT maneuver
      // rather than briefly re-showing the one at 300m as "current".
      const result = findCurrentStep(299, stepAlongDistances);

      expect(result.stepIndex).toBe(2);
    });
  });

  describe('computeStepAlongDistances', () => {
    it('computes an along-route distance for each step maneuver', () => {
      const routeGeometry: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [151.2000, -33.8688],
          [151.2030, -33.8688],
          [151.2060, -33.8688],
        ],
      };
      const cumulative = computeCumulativeDistances(routeGeometry.coordinates);
      const steps: NavigationStep[] = [
        {
          distance: 0,
          duration: 0,
          instruction: 'Depart',
          maneuver: { type: 'depart', location: [151.2000, -33.8688] },
        },
        {
          distance: 0,
          duration: 0,
          instruction: 'Turn left',
          maneuver: { type: 'turn', modifier: 'left', location: [151.2060, -33.8688] },
        },
      ];

      const result = computeStepAlongDistances(routeGeometry, steps, cumulative);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeCloseTo(0, 0);
      expect(result[1]).toBeCloseTo(cumulative[cumulative.length - 1], 0);
    });
  });

  describe('calculateRouteProgress (along-route)', () => {
    it('should return 0 when the route has no length', () => {
      expect(calculateRouteProgress(0, 0)).toBe(0);
    });

    it('reports along-route progress as a percentage of total length', () => {
      expect(calculateRouteProgress(250, 1000)).toBeCloseTo(25, 0);
    });

    it('clamps to 100 when along-route distance exceeds total length', () => {
      expect(calculateRouteProgress(1200, 1000)).toBe(100);
    });

    it('clamps to 0 for a negative along-route distance', () => {
      expect(calculateRouteProgress(-50, 1000)).toBe(0);
    });
  });

  describe('isOffRoute', () => {
    it('should return false when within the threshold', () => {
      expect(isOffRoute(20, 100)).toBe(false);
    });

    it('should return true when beyond the threshold', () => {
      expect(isOffRoute(150, 100)).toBe(true);
    });
  });

  describe('updateSmoothedSpeed (ETA smoothing)', () => {
    it('adopts the first reading directly', () => {
      expect(updateSmoothedSpeed(null, 5)).toBe(5);
    });

    it('smooths towards a new reading rather than jumping straight to it', () => {
      const next = updateSmoothedSpeed(5, 10, 0.3);
      expect(next).toBeCloseTo(6.5, 5); // 5 + 0.3 * (10 - 5)
      expect(next).toBeGreaterThan(5);
      expect(next).toBeLessThan(10);
    });

    it('ignores a null reading and keeps the previous smoothed value', () => {
      expect(updateSmoothedSpeed(7, null)).toBe(7);
    });

    it('ignores a near-zero reading (stopped at a stop) and keeps the previous value', () => {
      expect(updateSmoothedSpeed(7, 0.1, 0.3, 0.5)).toBe(7);
    });

    it('treats a null previous value plus a near-zero reading as still unknown', () => {
      expect(updateSmoothedSpeed(null, 0.1, 0.3, 0.5)).toBeNull();
    });

    it('converges towards a steady speed over repeated readings', () => {
      let speed: number | null = null;
      for (let i = 0; i < 20; i++) {
        speed = updateSmoothedSpeed(speed, 4, 0.3);
      }
      expect(speed).toBeCloseTo(4, 5);
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

  describe('alongPathDistance', () => {
    // A straight east-west path ~1.1km long at Sydney's latitude, with a
    // vertex every ~275m so projections land on distinct segments.
    const path: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [151.2000, -33.8688],
        [151.2030, -33.8688],
        [151.2060, -33.8688],
        [151.2090, -33.8688],
        [151.2120, -33.8688],
      ],
    };

    it('measures along-path distance between two points on the path', () => {
      const santa: [number, number] = [151.2015, -33.8688]; // mid segment 0
      const pin: [number, number] = [151.2105, -33.8688];   // mid segment 3
      const result = alongPathDistance(path, santa, pin);

      // 0.009° of longitude at -33.87° ≈ 830 m
      expect(result.passed).toBe(false);
      expect(result.meters).toBeGreaterThan(700);
      expect(result.meters).toBeLessThan(950);
      expect(result.offPathMeters).toBeLessThan(5);
    });

    it('flags points Santa has already passed', () => {
      const santa: [number, number] = [151.2105, -33.8688];
      const pin: [number, number] = [151.2015, -33.8688];
      const result = alongPathDistance(path, santa, pin);

      expect(result.passed).toBe(true);
      expect(result.meters).toBeGreaterThan(700);
    });

    it('reports how far off the path the target point sits', () => {
      const santa: [number, number] = [151.2000, -33.8688];
      // ~550 m north of the path
      const pin: [number, number] = [151.2060, -33.8638];
      const result = alongPathDistance(path, santa, pin);

      expect(result.offPathMeters).toBeGreaterThan(400);
      expect(result.offPathMeters).toBeLessThan(700);
    });

    it('returns ~0 for the same point', () => {
      const spot: [number, number] = [151.2060, -33.8688];
      const result = alongPathDistance(path, spot, spot);
      expect(result.meters).toBeLessThan(1);
    });
  });
});
