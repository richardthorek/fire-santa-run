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

/**
 * Sanitise a user-provided link URL for use in an <a href>. Returns the
 * normalised URL only when it resolves to http(s); otherwise undefined. This
 * blocks dangerous schemes such as `javascript:` and `data:` that would
 * otherwise allow DOM-based XSS, since React does not sanitise href/src values.
 */
export function safeHttpUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sanitise a user-provided image URL for use in an <img src>. Allows http(s)
 * and `data:image/...` (brigade logos may be stored as base64 data URLs);
 * rejects `javascript:` and any other scheme.
 */
export function safeImageSrc(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    if (url.protocol === 'data:' && /^data:image\//i.test(value.trim())) return value;
    return undefined;
  } catch {
    return undefined;
  }
}
