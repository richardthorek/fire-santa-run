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

type BrigadeSubscriptionInfo = Pick<Brigade, 'subscriptionStatus' | 'subscribedUntil'>;

/** Which self-service billing action the UI should offer for a given state. */
export type BillingAction = 'subscribe' | 'manage' | 'none';

export interface SubscriptionPresentation {
  /** Short status word for a badge, e.g. "Active", "Payment due". */
  label: string;
  /** One-line description of what the state means for the brigade. */
  detail: string;
  /** Visual tone so callers can pick a colour without duplicating the mapping. */
  tone: 'positive' | 'warning' | 'danger' | 'neutral';
  /** The billing action that best resolves the current state. */
  action: BillingAction;
  /** Whether paid features are currently usable (mirrors isBrigadeEntitled). */
  entitled: boolean;
  /** Formatted renewal/expiry date when known (e.g. "7 July 2026"), else null. */
  renewsOn: string | null;
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Map a brigade's subscription state to display copy + the action to offer.
 * Centralises the status → messaging mapping so the dashboard banner and the
 * settings billing panel stay consistent.
 */
export function describeSubscription(
  brigade: BrigadeSubscriptionInfo | null | undefined,
): SubscriptionPresentation {
  const status = brigade?.subscriptionStatus ?? 'none';
  const entitled = isBrigadeEntitled(brigade);
  const renewsOn = formatDate(brigade?.subscribedUntil);

  switch (status) {
    case 'active':
      return {
        label: 'Active',
        detail: renewsOn ? `Renews on ${renewsOn}.` : 'Your brigade subscription is active.',
        tone: 'positive',
        action: 'manage',
        entitled,
        renewsOn,
      };
    case 'trialing':
      return {
        label: 'Trial',
        detail: renewsOn ? `Trial — billing starts ${renewsOn}.` : 'Your brigade is on a trial.',
        tone: 'positive',
        action: 'manage',
        entitled,
        renewsOn,
      };
    case 'past_due':
      return {
        label: 'Payment due',
        detail: entitled && renewsOn
          ? `Payment failed — update your card before ${renewsOn} to avoid losing access.`
          : 'Payment failed. Update your card to restore planning and broadcasting.',
        tone: 'warning',
        action: 'manage',
        entitled,
        renewsOn,
      };
    case 'canceled':
      return {
        label: 'Canceled',
        detail: entitled && renewsOn
          ? `Canceled — access remains until ${renewsOn}.`
          : 'Your subscription has ended. Resubscribe to plan and broadcast again.',
        tone: entitled ? 'warning' : 'danger',
        action: entitled ? 'manage' : 'subscribe',
        entitled,
        renewsOn,
      };
    case 'none':
    default:
      return {
        label: 'Not subscribed',
        detail: 'Subscribe to plan routes and broadcast a live run. Public tracking is always free.',
        tone: 'neutral',
        action: 'subscribe',
        entitled,
        renewsOn,
      };
  }
}
