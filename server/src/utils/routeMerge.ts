/**
 * Build the route a PUT should write, from the stored route and the request.
 *
 * Fields the client omits keep their stored values. Without this the route
 * would be rewritten from the request alone, and omitted fields would fall
 * back to ''/0, wiping (for example) the organiser's creator reference and
 * the route's geometry. Server-owned fields always come from storage, and
 * updatedAt is stamped by the server rather than trusted from the client.
 */
export function mergeRouteUpdate(
  stored: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
  routeId: string,
  now: Date,
): Record<string, unknown> & { id: string; updatedAt: string } {
  const merged: Record<string, unknown> & { id: string; updatedAt: string } = {
    ...(stored ?? {}),
    ...incoming,
    id: routeId,
    updatedAt: now.toISOString(),
  };

  if (stored) {
    merged.createdAt = stored.createdAt;
    merged.createdBy = stored.createdBy;
    merged.viewCount = stored.viewCount;
  }
  return merged;
}
