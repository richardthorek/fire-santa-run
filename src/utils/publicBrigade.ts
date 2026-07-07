/**
 * Helpers for the public brigade profile page (/brigade/:slug).
 *
 * Pure functions kept separate from the page component so they are easy to
 * unit-test without rendering or mocking storage.
 */

import type { Route, RouteStatus } from '../types';

/** Statuses that are safe to surface on a public, unauthenticated page. */
const PUBLIC_STATUSES: ReadonlySet<RouteStatus> = new Set<RouteStatus>([
  'published',
  'active',
  'completed',
  'archived',
]);

/** True when a route with this status may be shown to anonymous viewers. */
export function isPublicRouteStatus(status: RouteStatus): boolean {
  return PUBLIC_STATUSES.has(status);
}

/** Statuses considered current/forthcoming for a viewer. */
const UPCOMING_STATUSES: ReadonlySet<RouteStatus> = new Set<RouteStatus>([
  'published',
  'active',
]);

export interface CategorizedRoutes {
  /** Live or scheduled runs, soonest first. */
  upcoming: Route[];
  /** Finished or archived runs, most recent first. */
  past: Route[];
}

function compareByDate(a: Route, b: Route, direction: 'asc' | 'desc'): number {
  const aTime = new Date(a.date).getTime();
  const bTime = new Date(b.date).getTime();
  const safeA = Number.isNaN(aTime) ? 0 : aTime;
  const safeB = Number.isNaN(bTime) ? 0 : bTime;
  return direction === 'asc' ? safeA - safeB : safeB - safeA;
}

/**
 * True when the route's scheduled day is already over. Routes with unparseable
 * dates are treated as not-past so they stay visible in upcoming.
 */
function isDatePast(route: Route, now: Date): boolean {
  const endOfDay = new Date(`${route.date}T23:59:59`);
  if (Number.isNaN(endOfDay.getTime())) return false;
  return endOfDay.getTime() < now.getTime();
}

/**
 * Split a brigade's routes into upcoming vs past for public display, dropping
 * drafts and any non-public statuses.
 *
 * A `published` route whose date has passed is shown under past runs — brigades
 * often never flip old runs to completed/archived, and a 2024 run must not sit
 * under "Upcoming & live" forever. `active` routes are always live regardless
 * of date (a run can start late).
 */
export function categorizeBrigadeRoutes(routes: Route[], now: Date = new Date()): CategorizedRoutes {
  const visible = routes.filter((r) => PUBLIC_STATUSES.has(r.status));

  const isUpcoming = (r: Route) =>
    r.status === 'active' || (UPCOMING_STATUSES.has(r.status) && !isDatePast(r, now));

  const upcoming = visible
    .filter(isUpcoming)
    .sort((a, b) => compareByDate(a, b, 'asc'));

  const past = visible
    .filter((r) => !isUpcoming(r))
    .sort((a, b) => compareByDate(a, b, 'desc'));

  return { upcoming, past };
}

/** True when the brigade has at least one publicly visible route. */
export function hasPublicRoutes(routes: Route[]): boolean {
  return routes.some((r) => PUBLIC_STATUSES.has(r.status));
}

/**
 * Sanitise a user-provided link URL for use in an <a href>. Parses the value as
 * an absolute URL and returns the normalised `href` only when the scheme is
 * http(s); otherwise undefined.
 *
 * Parsing via `URL` (with no base, so `window.location` is never read) is the
 * canonical safe-URL barrier: the protocol allowlist blocks `javascript:` /
 * `data:` schemes, and `URL.href` percent-encodes any HTML meta-characters so
 * they cannot break out of the href attribute.
 */
export function safeHttpUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // Not an absolute, parseable URL.
  }
  return undefined;
}

/**
 * Sanitise a user-provided image URL for use in an <img src>. Parses the value
 * with `URL` (no base, so `window.location` is never read) and returns the
 * normalised `href` only for http(s) or raster `data:image/...` URLs. Excludes
 * `data:image/svg+xml` (SVG can embed script) and every other scheme.
 *
 * Like safeHttpUrl, parsing via `URL` is the canonical safe-URL barrier: the
 * protocol allowlist blocks `javascript:`, and `URL.href` percent-encodes HTML
 * meta-characters.
 */
export function safeImageSrc(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
    if (
      url.protocol === 'data:' &&
      /^data:image\//i.test(trimmed) &&
      !/^data:image\/svg/i.test(trimmed)
    ) {
      return url.href;
    }
  } catch {
    // Not an absolute, parseable URL.
  }
  return undefined;
}
