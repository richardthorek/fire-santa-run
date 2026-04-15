/**
 * Countdown timer utilities
 * Helpers for calculating time remaining until a route starts
 */

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
export function getCountdownTime(date: string, startTime: string): CountdownTime {
  // Combining date (YYYY-MM-DD) and time (HH:MM) without a timezone suffix causes
  // the browser to parse the value as *local* time, which is intentional: brigades
  // set their start times in local Australian time and viewers in the same region
  // see the correct countdown. If cross-timezone support is needed in future, the
  // Route type should carry an explicit IANA timezone identifier.
  const startDateTime = new Date(`${date}T${startTime}`);
  const total = startDateTime.getTime() - Date.now();

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
 */
export function formatRouteStartDateTime(date: string, startTime: string): string {
  const dt = new Date(`${date}T${startTime}`);
  if (isNaN(dt.getTime())) return `${date} at ${startTime}`;

  const dateStr = dt.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = dt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}
