/**
 * Statuses visible to anyone who is not an actual member of the owning
 * brigade. Drafts and internal comments (real display names attached) are
 * not meant to leak to a caller who merely knows the brigadeId — and it is
 * not a secret; GET /brigades/public hands out every brigade's id.
 *
 * Shared so every anonymous-reachable route surface (GET /routes,
 * GET /routes/:id, GET /og-image) enforces the same boundary and can't
 * drift apart.
 */
export const PUBLIC_ROUTE_STATUSES = new Set(['published', 'active', 'completed', 'archived']);

/**
 * Whether a route counts as a "current or upcoming run" for the purpose of the
 * public brigade directory's default visibility (`Brigade.publicListing:
 * 'auto'`). A brigade with at least one such run is listed; one with only past,
 * draft or archived runs is not, until it schedules its next.
 *
 * - `active` → running right now, always counts.
 * - `published` with today's date or later (or no date) → upcoming, counts.
 * - anything else (draft / completed / archived, or a past published date) → no.
 *
 * `now` is injectable for tests.
 */
export function isCurrentOrUpcomingRun(
  route: { status?: string; date?: string },
  now: Date = new Date(),
): boolean {
  if (route.status === 'active') return true;
  if (route.status !== 'published') return false;
  if (!route.date) return true;
  const runDate = new Date(route.date);
  if (Number.isNaN(runDate.getTime())) return true; // unparseable — keep the brigade listed
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return runDate.getTime() >= startOfToday.getTime();
}
