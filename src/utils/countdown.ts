/**
 * Countdown timer utilities
 * Helpers for calculating time remaining until a route starts
 */

/** Brigades run in Australia; routes without their own zone use this one. */
export const DEFAULT_ROUTE_TIME_ZONE = 'Australia/Sydney';

/** Offset of `timeZone` from UTC at `epochMs`, in milliseconds. */
export function zoneOffsetMs(epochMs: number, timeZone: string): number {
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

/** The zone the viewer's device is set to, e.g. 'Australia/Adelaide'. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * A city name for an IANA zone, e.g. 'Australia/Adelaide' -> 'Adelaide'.
 * Used when naming the event's zone to a viewer in another zone.
 */
export function cityForTimeZone(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}

/**
 * Format a route's start for display. The viewer's device zone comes first, as
 * the time they will see Santa arrive. When the event zone shows a different
 * clock time, the event's own time follows in brackets, e.g.
 * "Thu 24 Dec at 8:00 pm AEDT (7:30 pm ACDT in Adelaide)".
 *
 * @param date       Route date in YYYY-MM-DD format
 * @param startTime  Route start time in HH:MM (24-hour) format, in the event zone
 * @param eventZone  IANA zone the organiser set the start time in
 * @param viewerZone IANA zone to show first; defaults to the device's zone
 */
export function formatRouteStartDateTime(
  date: string,
  startTime: string,
  eventZone: string = DEFAULT_ROUTE_TIME_ZONE,
  viewerZone: string = deviceTimeZone(),
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) return `${date} at ${startTime}`;
  const epoch = zonedDateTimeToEpoch(date, startTime, eventZone);
  if (Number.isNaN(epoch)) return `${date} at ${startTime}`;

  const viewerTime = new Date(epoch);
  const viewerDay = viewerTime.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: viewerZone });
  const viewerClock = viewerTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: viewerZone });
  const viewerLine = `${viewerDay} at ${viewerClock}`;

  // Same clock time in both zones: nothing to add.
  if (zoneOffsetMs(epoch, viewerZone) === zoneOffsetMs(epoch, eventZone)) return viewerLine;

  const eventClock = viewerTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: eventZone });
  return `${viewerLine} (${eventClock} in ${cityForTimeZone(eventZone)})`;
}

/**
 * Format the organiser's start time in the event's own zone, for material that
 * is read at the venue, such as the poster: "Thu 24 Dec, 7:30 pm ACDT".
 */
export function formatEventStartInEventZone(date: string, startTime: string, eventZone: string = DEFAULT_ROUTE_TIME_ZONE): { day: string; time: string } {
  const epoch = zonedDateTimeToEpoch(date, startTime, eventZone);
  if (Number.isNaN(epoch)) return { day: date, time: startTime };
  const at = new Date(epoch);
  return {
    day: at.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: eventZone }),
    time: at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: eventZone }),
  };
}
