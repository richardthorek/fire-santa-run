/**
 * SubscriptionBanner
 *
 * Shown on the dashboard when the current brigade has no active subscription.
 * Planning routes and broadcasting a live run require an entitled brigade
 * ($5/yr); public live tracking is always free. The button starts Stripe
 * Checkout via the server. Non-admins can see the prompt but the server only
 * lets an admin create the checkout session (surfaced as an inline error).
 */

import { useState } from 'react';
import { useBrigade } from '../context';
import { startBrigadeCheckout } from '../utils/billing';

export function SubscriptionBanner() {
  const { brigade, isEntitled } = useBrigade();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev mode reports every brigade as entitled, so this renders nothing there.
  if (!brigade || isEntitled) return null;

  const handleSubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      await startBrigadeCheckout(brigade.id);
      // On success the browser is redirected to Stripe; no further UI needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Subscription required"
      style={{
        background: 'linear-gradient(135deg, var(--fire-red), var(--summer-gold))',
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
        <span role="img" aria-hidden="true" style={{ fontSize: '1.5rem' }}>🎅</span>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading, inherit)' }}>
            Subscribe to plan &amp; broadcast your Santa run
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.95 }}>
            $5/year per brigade. Public live tracking is always free.
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
        onClick={handleSubscribe}
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
        {busy ? 'Starting…' : 'Subscribe — $5/yr'}
      </button>
    </div>
  );
}
