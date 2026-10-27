/**
 * Countdown timer utilities
 * Helpers for calculating time remaining until a route starts
 */

/** Brigades run in Australia; routes without their own zone use this one. */
export const DEFAULT_ROUTE_TIME_ZONE = 'Australia/Sydney';

/** Offset of `timeZone` from UTC at `epochMs`, in milliseconds. */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs));
  const field = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const wallAsUtc = Date.UTC(field('year'), field('month') - 1, field('day'), field('hour'), field('minute'), field('second'));
  return wallAsUtc - Math.floor(epochMs / 1000) * 1000;
}

/**
 * Epoch milliseconds for a wall-clock date and time in a named zone.
 * Checks the offset twice so a start time near a daylight-saving change lands
 * on the right instant.
 */
export function zonedDateTimeToEpoch(date: string, startTime: string, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = startTime.split(':').map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  return wallAsUtc - zoneOffsetMs(firstGuess, timeZone);
}

export interface CountdownTime {
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds remaining (0 when expired) */
  total: number;
}

/**
 * Calculate the time remaining until a route's scheduled start.
 *
 * @param date      Route date in YYYY-MM-DD format
 * @param startTime Route start time in HH:MM (24-hour) format
 * @returns         Countdown breakdown and total ms remaining
 */
export function getCountdownTime(
  date: string,
  startTime: string,
  timeZone: string = DEFAULT_ROUTE_TIME_ZONE,
): CountdownTime {
  // The start is the brigade's wall-clock time in the route's own zone, so a
  // viewer in another zone sees the same moment Santa leaves.
  const total = zonedDateTimeToEpoch(date, startTime, timeZone) - Date.now();

  if (total <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor(total / (1000 * 60 * 60));

  return { hours, minutes, seconds, total };
}

/**
 * Format a countdown value as a zero-padded two-digit string.
 */
export function padCountdownUnit(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Format a route's date and start time into a human-readable string.
 * e.g. "24 December 2024 at 6:00 PM"
 *
 * @param date      Route date in YYYY-MM-DD format
 * @param startTime Route start time in HH:MM (24-hour) format
 * @param timeZone  IANA zone the start time is set in; the zone is named when it isn't the viewer's own
 */
export function formatRouteStartDateTime(
  date: string,
  startTime: string,
  timeZone: string = DEFAULT_ROUTE_TIME_ZONE,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) return `${date} at ${startTime}`;
  const dt = new Date(zonedDateTimeToEpoch(date, startTime, timeZone));
  if (isNaN(dt.getTime())) return `${date} at ${startTime}`;

  const dateStr = dt.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  });
  const timeStr = dt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    timeZoneName: 'short',
  });
  return `${dateStr} at ${timeStr}`;
}
