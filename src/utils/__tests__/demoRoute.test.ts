import { describe, it, expect, vi, afterEach } from 'vitest';
import { startDemoSimulator } from '../demoRoute';
import type { Route } from '../../types';

const waypoints: Route['waypoints'] = [
  { id: 'w1', coordinates: [0, 0], name: 'Stop 1', order: 0, isCompleted: false },
  { id: 'w2', coordinates: [0.009, 0], name: 'Stop 2', order: 1, isCompleted: false },
  { id: 'w3', coordinates: [0.018, 0], name: 'Stop 3', order: 2, isCompleted: false },
  { id: 'w4', coordinates: [0.027, 0], name: 'Stop 4', order: 3, isCompleted: false },
];

// Points ~1km apart along the equator (0.009deg lng ~= 1000m), 4 segments = ~4km total.
const coordinates: [number, number][] = waypoints.map((w) => w.coordinates);

afterEach(() => {
  vi.useRealTimers();
});

describe('startDemoSimulator lap restart', () => {
  it('never resets progress before the loop wraps', () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const onLapRestart = vi.fn();
    const stop = startDemoSimulator({
      coordinates,
      waypoints,
      onUpdate,
      onLapRestart,
      intervalMs: 1000,
      metersPerTick: 100,
    });

    // 3000m covered — well short of the ~4000m full loop.
    vi.advanceTimersByTime(30 * 1000);
    expect(onLapRestart).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();

    stop();
  });

  it('signals a lap restart once the path loops, and progress drops back down', () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const onLapRestart = vi.fn();
    const stop = startDemoSimulator({
      coordinates,
      waypoints,
      onUpdate,
      onLapRestart,
      intervalMs: 1000,
      metersPerTick: 100,
    });

    // 4500m covered — past the ~4000m full loop, so it must have wrapped.
    vi.advanceTimersByTime(45 * 1000);
    expect(onLapRestart).toHaveBeenCalled();

    // The waypoint index right after the restart must not still read as
    // "all stops done" — this is what let TrackingView show a completed
    // route forever after lap 1 (only ever allowed to increase before this fix).
    const restartCallOrder = onLapRestart.mock.invocationCallOrder[0];
    const updateAfterRestart = onUpdate.mock.calls.find((_call, i) => {
      return onUpdate.mock.invocationCallOrder[i] > restartCallOrder;
    });
    expect(updateAfterRestart).toBeDefined();
    expect(updateAfterRestart![0].currentWaypointIndex).toBeLessThan(waypoints.length);

    stop();
  });

  it('calls onLapRestart before onUpdate on the wrapping tick', () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const onUpdate = vi.fn(() => order.push('update'));
    const onLapRestart = vi.fn(() => order.push('restart'));
    const stop = startDemoSimulator({
      coordinates: [[0, 0], [0.009, 0]], // 2 points: wraps on every tick
      waypoints: [waypoints[0], waypoints[1]],
      onUpdate,
      onLapRestart,
      intervalMs: 1000,
      metersPerTick: 2000, // overshoots the ~1km segment immediately
    });

    vi.advanceTimersByTime(1000);
    expect(order).toEqual(['restart', 'update']);

    stop();
  });
});
