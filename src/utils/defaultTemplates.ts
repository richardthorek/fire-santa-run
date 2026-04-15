import type { RouteTemplate } from '../types';

/**
 * Built-in route templates that ship with the app.
 * These are seeded into a brigade's template library the first time
 * templates are loaded and when they are not already present.
 */
export const BUILT_IN_TEMPLATES: Omit<RouteTemplate, 'brigadeId' | 'createdAt'>[] = [
  {
    id: 'builtin_suburban_loop',
    name: 'Suburban Loop',
    description:
      'A typical suburban neighbourhood loop. Covers a grid of residential streets with regular stops every few blocks. Great for densely-populated areas.',
    category: 'Suburban',
    isBuiltIn: true,
    waypoints: [],
  },
  {
    id: 'builtin_rural_circuit',
    name: 'Rural Circuit',
    description:
      'A longer rural circuit connecting scattered properties and small communities. Expect larger gaps between stops and unsealed roads.',
    category: 'Rural',
    isBuiltIn: true,
    waypoints: [],
  },
];

/**
 * Seed built-in templates for a brigade if they are not already present.
 * Safe to call multiple times — only adds missing entries.
 */
export function mergeBuiltInTemplates(
  existing: RouteTemplate[],
  brigadeId: string,
): RouteTemplate[] {
  const existingIds = new Set(existing.map(t => t.id));
  const toAdd: RouteTemplate[] = BUILT_IN_TEMPLATES
    .filter(t => !existingIds.has(t.id))
    .map(t => ({
      ...t,
      brigadeId,
      createdAt: new Date().toISOString(),
    }));
  return [...existing, ...toAdd];
}
