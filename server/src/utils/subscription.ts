/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Per-brigade subscription entitlement (Stripe) — server side.
 *
 * The brigade record carries the subscription state mirrored from Stripe by the
 * webhook. Planning routes and broadcasting a live run require an entitled
 * brigade; public live tracking is always free. In dev mode billing is bypassed
 * so local development never needs Stripe.
 */

import { getTableClient, isDevMode } from './storage.js';

const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';

export interface BrigadeSubscription {
  subscriptionStatus?: string;
  subscribedUntil?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/**
 * Pure entitlement rule, shared shape with the client helper. Entitled while
 * the paid period has not elapsed (covers cancel-at-period-end and the past_due
 * grace window); when no period end is recorded, entitled if active/trialing.
 */
export function isEntitled(sub: BrigadeSubscription | null | undefined): boolean {
  if (!sub) return false;
  const status = sub.subscriptionStatus;
  if (!status || status === 'none') return false;

  const until = sub.subscribedUntil ? Date.parse(sub.subscribedUntil) : NaN;
  if (!Number.isNaN(until)) return until > Date.now();

  return status === 'active' || status === 'trialing';
}

/** Read the subscription-relevant fields for a brigade, or null if not found. */
export async function getBrigadeSubscription(brigadeId: string): Promise<BrigadeSubscription | null> {
  const client = await getTableClient(BRIGADES_TABLE);
  try {
    const entity: any = await client.getEntity(brigadeId, brigadeId);
    return {
      subscriptionStatus: entity.subscriptionStatus,
      subscribedUntil: entity.subscribedUntil,
      stripeCustomerId: entity.stripeCustomerId,
      stripeSubscriptionId: entity.stripeSubscriptionId,
    };
  } catch (error: any) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

/**
 * Whether a brigade may currently use paid features. Always true in dev mode.
 */
export async function isBrigadeEntitled(brigadeId: string): Promise<boolean> {
  if (isDevMode) return true;
  const sub = await getBrigadeSubscription(brigadeId);
  return isEntitled(sub);
}

/** Merge subscription fields onto a brigade entity (used by the Stripe webhook). */
export async function updateBrigadeSubscription(
  brigadeId: string,
  fields: BrigadeSubscription,
): Promise<void> {
  const client = await getTableClient(BRIGADES_TABLE);
  await client.updateEntity(
    { partitionKey: brigadeId, rowKey: brigadeId, ...fields, updatedAt: new Date().toISOString() },
    'Merge',
  );
}
