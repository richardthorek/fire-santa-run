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
