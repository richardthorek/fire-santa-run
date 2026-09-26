/**
 * Pure helpers for the public tracking page's "is Santa's signal stale?" and
 * "Santa's running late" indicators. Kept separate from TrackingView so the
 * timing logic is easy to unit-test without rendering the map.
 */

/** A live position broadcast older than this is considered stale. */
export const STALE_LOCATION_THRESHOLD_MS = 60_000;

/** How long past the scheduled start time to wait before saying Santa's late. */
export const RUN_LATE_THRESHOLD_MS = 10 * 60_000;

/**
 * True when the most recent location broadcast is older than the stale
 * threshold. `lastUpdateAt` is `null` when no broadcast has arrived yet
 * (handled separately by the "waiting to start" copy, not staleness).
 */
export function isLocationStale(
  lastUpdateAt: number | null,
  now: number = Date.now(),
  thresholdMs: number = STALE_LOCATION_THRESHOLD_MS,
): boolean {
  if (lastUpdateAt === null) return false;
  return now - lastUpdateAt > thresholdMs;
}

/** Whole minutes since the last update, floored, minimum 1 once stale. */
export function minutesSinceUpdate(lastUpdateAt: number, now: number = Date.now()): number {
  return Math.max(1, Math.floor((now - lastUpdateAt) / 60_000));
}

/**
 * True once `RUN_LATE_THRESHOLD_MS` has passed since a run's scheduled start
 * with no location broadcast received. `startEpochMs` may be `NaN` for an
 * unparseable date/time — treated as never late.
 */
export function isRunRunningLate(
  startEpochMs: number,
  now: number = Date.now(),
  thresholdMs: number = RUN_LATE_THRESHOLD_MS,
): boolean {
  if (Number.isNaN(startEpochMs)) return false;
  return now - startEpochMs > thresholdMs;
}
