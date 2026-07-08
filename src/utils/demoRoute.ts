/**
 * The public demo run (/demo): a baked-in sample route with a simulated Santa
 * so anyone — a curious parent or a brigade deciding whether to sign up — can
 * see live tracking without an account, a truck, or a backend connection.
 *
 * The simulator walks Santa along the displayed path (road-following when the
 * Directions fallback in TrackingView succeeds, straight segments otherwise)
 * and feeds the same LocationBroadcast messages a real run produces.
 */

import type { Route, LocationBroadcast } from '../types';
import { calculateDistance } from './navigation';

export const DEMO_ROUTE_ID = 'demo';

/** A friendly fictional town loop (Griffith NSW — matches the sample data). */
export const DEMO_ROUTE: Route = {
  id: DEMO_ROUTE_ID,
  brigadeId: 'demo-brigade',
  name: 'Demo: Christmas Eve Santa Run',
  description: 'A simulated Santa run so you can see live tracking in action.',
  date: new Date().toISOString().slice(0, 10),
  startTime: '19:30',
  status: 'active',
  waypoints: [
    { id: 'demo-w1', coordinates: [146.0357, -34.2872], name: 'Fire Station', address: 'Benerembah St', order: 0, isCompleted: false },
    { id: 'demo-w2', coordinates: [146.0454, -34.2853], name: 'Memorial Park', address: 'Banna Ave', order: 1, isCompleted: false },
    { id: 'demo-w3', coordinates: [146.0533, -34.2812], name: 'Town Centre', address: 'Banna Ave', order: 2, isCompleted: false },
    { id: 'demo-w4', coordinates: [146.0587, -34.2748], name: 'School Oval', address: 'Wakaden St', order: 3, isCompleted: false },
    { id: 'demo-w5', coordinates: [146.0489, -34.2705], name: 'Retirement Village', address: 'Noorebar Ave', order: 4, isCompleted: false },
  ],
  createdAt: new Date().toISOString(),
  createdBy: 'demo',
  viewCount: 0,
};

export interface DemoSimulatorOptions {
  /** The path to move along, as [lng, lat] coordinates. */
  coordinates: [number, number][];
  /** Waypoints — used to advance currentWaypointIndex as Santa passes them. */
  waypoints: Route['waypoints'];
  /** Called with each simulated broadcast, exactly like a live message. */
  onUpdate: (broadcast: LocationBroadcast) => void;
  /** Tick interval in ms (default 2000, like a real broadcaster). */
  intervalMs?: number;
  /** Simulated speed in metres per tick step (default ~parade pace). */
  metersPerTick?: number;
}

/**
 * Start a looping Santa simulation along a path. Returns a stop() cleanup.
 * Distance-based stepping keeps the pace steady regardless of how densely
 * the path is sampled.
 */
export function startDemoSimulator({
  coordinates,
  waypoints,
  onUpdate,
  intervalMs = 2000,
  metersPerTick = 60,
}: DemoSimulatorOptions): () => void {
  if (coordinates.length < 2) return () => {};

  let segment = 0; // index into coordinates
  let intoSegment = 0; // metres progressed into the current segment

  const timer = setInterval(() => {
    // Advance by metersPerTick along the polyline, looping at the end.
    let remaining = metersPerTick;
    while (remaining > 0) {
      const from = coordinates[segment];
      const to = coordinates[segment + 1];
      if (!to) {
        // End of route: pause Santa at the final stop, then restart the loop.
        segment = 0;
        intoSegment = 0;
        break;
      }
      const segmentLength = calculateDistance(from, to);
      const left = segmentLength - intoSegment;
      if (remaining < left) {
        intoSegment += remaining;
        remaining = 0;
      } else {
        remaining -= left;
        segment += 1;
        intoSegment = 0;
      }
    }

    const from = coordinates[segment];
    const to = coordinates[segment + 1] ?? from;
    const segmentLength = calculateDistance(from, to) || 1;
    const t = Math.min(1, intoSegment / segmentLength);
    const position: [number, number] = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
    ];

    // Santa has "passed" every waypoint within 80 m of any earlier point —
    // approximate by nearest waypoint behind the current position.
    let passed = 0;
    for (let i = 0; i < waypoints.length; i++) {
      if (calculateDistance(position, waypoints[i].coordinates) < 80) {
        passed = Math.max(passed, i + 1);
      }
    }

    onUpdate({
      routeId: DEMO_ROUTE_ID,
      location: position,
      timestamp: Date.now(),
      speed: metersPerTick / (intervalMs / 1000),
      currentWaypointIndex: passed,
    });
  }, intervalMs);

  return () => clearInterval(timer);
}
