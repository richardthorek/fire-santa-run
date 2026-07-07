/**
 * Per-brigade subscription entitlement (Stripe).
 *
 * A brigade must be entitled to plan routes and broadcast a live run; public
 * live tracking is always free. The server is the source of truth — these
 * helpers drive UX (paywall prompts, disabled buttons) and mirror the same
 * rule the backend enforces.
 */

import type { Brigade } from '../storage/types';

export type SubscriptionStatus = NonNullable<Brigade['subscriptionStatus']>;

/**
 * Whether a brigade may currently use paid features.
 *
 * Entitled when the paid period has not yet elapsed (covers cancel-at-period-end
 * and the past_due grace window), or — when no period end is recorded — when the
 * subscription is active/trialing.
 */
export function isBrigadeEntitled(brigade: Pick<Brigade, 'subscriptionStatus' | 'subscribedUntil'> | null | undefined): boolean {
  if (!brigade) return false;
  const status = brigade.subscriptionStatus;
  if (!status || status === 'none') return false;

  const until = brigade.subscribedUntil ? Date.parse(brigade.subscribedUntil) : NaN;
  if (!Number.isNaN(until)) return until > Date.now();

  return status === 'active' || status === 'trialing';
}

/**
 * Client-side entitlement check. In dev mode (VITE_DEV_MODE=true) the backend
 * bypasses billing, so the UI treats every brigade as entitled to match.
 */
export function isBrigadeEntitledForUi(brigade: Pick<Brigade, 'subscriptionStatus' | 'subscribedUntil'> | null | undefined): boolean {
  if (import.meta.env.VITE_DEV_MODE === 'true') return true;
  return isBrigadeEntitled(brigade);
}
