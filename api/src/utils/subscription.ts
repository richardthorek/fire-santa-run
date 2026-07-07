/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Per-brigade subscription entitlement — api/ (local dev) mirror of the server/
 * helper, kept in parity per the two-backends rule.
 *
 * In dev mode (VITE_DEV_MODE=true) billing is bypassed and every brigade is
 * entitled, so local development never touches Stripe. The Stripe checkout and
 * webhook themselves live only in the production server/ backend.
 */

import { getTableClient, isDevMode } from './storage';

const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';

export function isEntitled(sub: { subscriptionStatus?: string; subscribedUntil?: string } | null | undefined): boolean {
  if (!sub) return false;
  const status = sub.subscriptionStatus;
  if (!status || status === 'none') return false;
  const until = sub.subscribedUntil ? Date.parse(sub.subscribedUntil) : NaN;
  if (!Number.isNaN(until)) return until > Date.now();
  return status === 'active' || status === 'trialing';
}

/** Whether a brigade may currently use paid features. Always true in dev mode. */
export async function isBrigadeEntitled(brigadeId: string): Promise<boolean> {
  if (isDevMode) return true;
  const client = await getTableClient(BRIGADES_TABLE);
  try {
    const entity: any = await client.getEntity(brigadeId, brigadeId);
    return isEntitled({ subscriptionStatus: entity.subscriptionStatus, subscribedUntil: entity.subscribedUntil });
  } catch (error: any) {
    if (error.statusCode === 404) return false;
    throw error;
  }
}
