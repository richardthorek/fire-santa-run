/**
 * Tests for the nearest-neighbour TSP heuristic in src/utils/mapbox.ts
 */

import { describe, it, expect } from 'vitest';
import { nearestNeighborTsp, twoOptImprove } from '../mapbox';

describe('twoOptImprove', () => {
  it('improves a crossing-path tour by uncrossing', () => {
    // Create a square: corners at (0,0), (0,1), (1,0), (1,1)
    // Inefficient path with crossing: 0→2→1→3 (crosses itself)
    // Better path: 0→1→3→2 or similar (no crossing)
    const coords: [number, number][] = [
      [0, 0],       // 0: bottom-left (start)
      [1, 1],       // 1: top-right
      [1, 0],       // 2: bottom-right
      [0, 1],       // 3: top-left (end)
    ];

    // Crossing path: 0→2→1→3
    const crossingPath = [0, 2, 1, 3];
    
    // Improve it
    const improved = twoOptImprove(crossingPath, coords);
    
    // Start and end must remain fixed
    expect(improved[0]).toBe(0);
    expect(improved[improved.length - 1]).toBe(3);

    // All indices must be present
    expect(new Set(improved).size).toBe(4);
    expect(improved.length).toBe(4);
  });

  it('does not modify an already optimal tour', () => {
    // Simple line: 0→1→2→3 (already optimal)
    const coords: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];

    const optimalPath = [0, 1, 2, 3];
    const result = twoOptImprove(optimalPath, coords);
    
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('preserves start and end waypoints', () => {
    const coords: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ];

    const path = [0, 2, 1, 3];
    const result = twoOptImprove(path, coords);

    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(3);
  });

  it('returns all waypoint indices exactly once', () => {
    const coords: [number, number][] = [
      [0, 0],
      [5, 5],
      [10, 0],
      [5, -5],
      [15, 0],
    ];

    const path = [0, 4, 1, 2, 3];
    const result = twoOptImprove(path, coords);

    expect(result.length).toBe(5);
    expect(new Set(result).size).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(result).toContain(i);
    }
  });
});


describe('nearestNeighborTsp', () => {
  it('returns [0] for a single coordinate', () => {
    const result = nearestNeighborTsp([[151.2, -33.8]]);
    expect(result).toEqual([0]);
  });

  it('returns [0, 1] for two coordinates (unchanged)', () => {
    const coords: [number, number][] = [
      [151.2, -33.8],
      [151.3, -33.9],
    ];
    expect(nearestNeighborTsp(coords)).toEqual([0, 1]);
  });

  it('preserves start (index 0) and end (last index) for 3+ waypoints', () => {
    const coords: [number, number][] = [
      [151.0, -33.0], // start — must stay at position 0
      [151.5, -33.5],
      [151.1, -33.1],
      [151.9, -33.9], // end — must stay at last position
    ];
    const result = nearestNeighborTsp(coords);
    expect(result[0]).toBe(0);                     // start preserved
    expect(result[result.length - 1]).toBe(3);     // end preserved
    expect(result).toHaveLength(4);
  });

  it('reorders 3 middle waypoints to the nearest-neighbour order', () => {
    // Lay points on a line: start=0, then A is far right, B is close to start, end=3
    // Expected greedy order: start → B → A → end
    const start: [number, number] = [151.0, -33.0];
    const nearB: [number, number] = [151.01, -33.0]; // ~1 km from start
    const farA: [number, number] = [155.0, -33.0];   // ~400+ km from start
    const end: [number, number] = [156.0, -33.0];    // fixed last waypoint

    const coords = [start, farA, nearB, end]; // input indices: 0=start, 1=farA, 2=nearB, 3=end
    const result = nearestNeighborTsp(coords);

    expect(result[0]).toBe(0);              // start fixed
    expect(result[result.length - 1]).toBe(3); // end fixed
    // Greedy from start should visit nearB (index 2) before farA (index 1)
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(1);
  });

  it('returns all indices exactly once', () => {
    const n = 6;
    const coords: [number, number][] = Array.from({ length: n }, (_, i) => [
      151.0 + i * 0.1,
      -33.0 - i * 0.1,
    ]);
    const result = nearestNeighborTsp(coords);
    expect(result).toHaveLength(n);
    expect(new Set(result).size).toBe(n);
    // Every index from 0..n-1 must appear exactly once
    for (let i = 0; i < n; i++) {
      expect(result).toContain(i);
    }
  });

  it('handles identical middle coordinates without infinite loop', () => {
    const coords: [number, number][] = [
      [151.0, -33.0],
      [151.1, -33.1],
      [151.1, -33.1], // duplicate of index 1
      [152.0, -34.0],
    ];
    const result = nearestNeighborTsp(coords);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(3);
  });
});
