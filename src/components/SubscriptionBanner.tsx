/**
 * SubscriptionBanner
 *
 * Shown on the dashboard when the current brigade needs billing attention:
 * either it has never subscribed (prompt to Subscribe) or a payment is failing
 * (prompt to update the card via the billing portal). An active, paid-up
 * brigade sees nothing. Planning routes and broadcasting a live run require an
 * entitled brigade ($5/yr); public live tracking is always free. Non-admins can
 * see the prompt but the server only lets an admin open Checkout / the portal
 * (surfaced as an inline error).
 */

import { useState } from 'react';
import { useBrigade } from '../context';
import { startBrigadeCheckout, openBillingPortal } from '../utils/billing';
import { describeSubscription } from '../utils/subscription';

export function SubscriptionBanner() {
  const { brigade, isEntitled } = useBrigade();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev mode reports every brigade as entitled, so this renders nothing there.
  if (!brigade) return null;

  const info = describeSubscription(brigade);

  // Show only when action is needed: never-subscribed / canceled (not entitled),
  // or a failing payment during the grace window (past_due but still entitled).
  const needsAttention = !isEntitled || brigade.subscriptionStatus === 'past_due';
  if (!needsAttention) return null;

  const useManage = info.action === 'manage';

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      if (useManage) {
        await openBillingPortal(brigade.id);
      } else {
        await startBrigadeCheckout(brigade.id);
      }
      // On success the browser is redirected to Stripe; no further UI needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  // Warning states (past_due / canceled-with-grace) get a calmer amber gradient
  // than the fire-red subscribe prompt so they read as "act soon" not "blocked".
  const isWarning = info.tone === 'warning';
  const background = isWarning
    ? 'linear-gradient(135deg, var(--summer-gold), var(--fire-red))'
    : 'linear-gradient(135deg, var(--fire-red), var(--summer-gold))';

  const heading = useManage
    ? 'Update your brigade billing'
    : 'Subscribe to plan & broadcast your Santa run';
  const buttonLabel = busy
    ? (useManage ? 'Opening…' : 'Starting…')
    : (useManage ? 'Manage billing' : 'Subscribe — $5/yr');

  return (
    <div
      role="region"
      aria-label={useManage ? 'Billing attention required' : 'Subscription required'}
      style={{
        background,
        color: '#ffffff',
        borderRadius: 'var(--border-radius-lg, 16px)',
        padding: '1rem 1.25rem',
        margin: '0 0 1rem',
        boxShadow: 'var(--ui-shadow, 0 4px 12px rgba(0,0,0,0.15))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
        <span role="img" aria-hidden="true" style={{ fontSize: '1.5rem' }}>
          {isWarning ? '⚠️' : '🎅'}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading, inherit)' }}>
            {heading}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.95 }}>
            {info.detail}
          </div>
          {error && (
            <div role="alert" style={{ fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          background: '#ffffff',
          color: 'var(--fire-red, #D32F2F)',
          border: 'none',
          borderRadius: 'var(--border-radius, 12px)',
          padding: '0.6rem 1.1rem',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: busy ? 0.8 : 1,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
