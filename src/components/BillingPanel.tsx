/**
 * BillingPanel — brigade subscription status + self-service billing.
 *
 * Rendered on the admin Brigade Settings page. Shows the current subscription
 * state (from the brigade record the webhook maintains) and offers the right
 * action: Subscribe via Stripe Checkout when never/no-longer subscribed, or
 * Manage billing via the Stripe billing portal (update card, cancel) when a
 * subscription exists. The server authorises both actions to brigade admins and
 * returns a redirect URL; the client never handles card data.
 *
 * In dev mode (VITE_DEV_MODE=true) billing is bypassed everywhere, so the panel
 * shows a short note instead of live Stripe actions.
 */

import { useState } from 'react';
import { startBrigadeCheckout, openBillingPortal } from '../utils/billing';
import { describeSubscription, type SubscriptionPresentation } from '../utils/subscription';
import { useSubscriptionPrice } from '../hooks/useSubscriptionPrice';
import type { Brigade } from '../storage/types';

const TONE_COLORS: Record<SubscriptionPresentation['tone'], { bg: string; fg: string }> = {
  positive: { bg: 'rgba(67, 160, 71, 0.15)', fg: 'var(--christmas-green, #43A047)' },
  warning: { bg: 'rgba(255, 167, 38, 0.18)', fg: 'var(--summer-gold-darker, #B36A00)' },
  danger: { bg: 'rgba(211, 47, 47, 0.15)', fg: 'var(--fire-red, #D32F2F)' },
  neutral: { bg: 'var(--neutral-100, #f0f0f0)', fg: 'var(--neutral-700, #555)' },
};

export interface BillingPanelProps {
  brigade: Brigade;
}

export function BillingPanel({ brigade }: BillingPanelProps) {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const { label: priceLabel } = useSubscriptionPrice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = describeSubscription(brigade);
  const badge = TONE_COLORS[info.tone];

  const handleAction = async (action: 'subscribe' | 'manage') => {
    setBusy(true);
    setError(null);
    try {
      if (action === 'manage') {
        await openBillingPortal(brigade.id);
      } else {
        await startBrigadeCheckout(brigade.id);
      }
      // Success redirects the browser to Stripe.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <section className="bsp__section" aria-labelledby="bsp-billing">
      <h2 className="bsp__section-title" id="bsp-billing">Subscription &amp; Billing</h2>
      <p className="bsp__section-desc">
        A {priceLabel} brigade subscription unlocks route planning and live broadcasting.
        Public live tracking is always free.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '0.5rem 0 1rem',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.7rem',
            borderRadius: '999px',
            background: badge.bg,
            color: badge.fg,
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {info.label}
        </span>
        <span style={{ color: 'var(--neutral-700, #555)', fontSize: '0.9rem' }}>
          {info.detail}
        </span>
      </div>

      {isDevMode ? (
        <p className="bsp__hint">
          Dev mode — billing is bypassed and every brigade is treated as subscribed.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {info.action === 'subscribe' && (
              <button
                type="button"
                className="bsp__btn bsp__btn--primary"
                onClick={() => handleAction('subscribe')}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Starting…' : `Subscribe — ${priceLabel}`}
              </button>
            )}
            {info.action === 'manage' && (
              <button
                type="button"
                className="bsp__btn bsp__btn--primary"
                onClick={() => handleAction('manage')}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Opening…' : 'Manage billing'}
              </button>
            )}
          </div>
          {error && (
            <p className="bsp__field-error" role="alert" style={{ marginTop: '0.6rem' }}>
              {error}
            </p>
          )}
          <p className="bsp__hint" style={{ marginTop: '0.6rem' }}>
            Payments are processed securely by Stripe. Only brigade admins can change billing.
          </p>
        </>
      )}
    </section>
  );
}
