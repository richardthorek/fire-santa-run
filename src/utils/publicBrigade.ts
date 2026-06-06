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
 * Split a brigade's routes into upcoming vs past for public display, dropping
 * drafts and any non-public statuses.
 */
export function categorizeBrigadeRoutes(routes: Route[]): CategorizedRoutes {
  const visible = routes.filter((r) => PUBLIC_STATUSES.has(r.status));

  const upcoming = visible
    .filter((r) => UPCOMING_STATUSES.has(r.status))
    .sort((a, b) => compareByDate(a, b, 'asc'));

  const past = visible
    .filter((r) => !UPCOMING_STATUSES.has(r.status))
    .sort((a, b) => compareByDate(a, b, 'desc'));

  return { upcoming, past };
}

/** True when the brigade has at least one publicly visible route. */
export function hasPublicRoutes(routes: Route[]): boolean {
  return routes.some((r) => PUBLIC_STATUSES.has(r.status));
}

// Matches a string that begins with an http(s):// scheme. Used for <img src>,
// where the data:image branch is handled separately.
const HTTP_URL_PREFIX = /^https?:\/\//i;

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
 * Sanitise a user-provided image URL for use in an <img src>. Allows absolute
 * http(s) URLs and raster `data:image/...` URLs (brigade logos may be stored as
 * base64). Excludes `data:image/svg+xml` (SVG can embed script) and every other
 * scheme.
 */
export function safeImageSrc(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (HTTP_URL_PREFIX.test(trimmed)) return trimmed;
  if (/^data:image\//i.test(trimmed) && !/^data:image\/svg/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}
