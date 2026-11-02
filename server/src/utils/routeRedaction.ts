/**
 * Strip organiser-only fields from a route served to anyone who is not a
 * member of its brigade: the creator reference, the last editor, and the
 * brigade-internal comments.
 */
export function redactForPublic<T extends { createdBy?: unknown; lastEditedBy?: unknown; comments?: unknown }>(
  route: T,
): Omit<T, 'createdBy' | 'lastEditedBy' | 'comments'> {
  const { createdBy: _createdBy, lastEditedBy: _lastEditedBy, comments: _comments, ...publicRoute } = route;
  return publicRoute;
}
