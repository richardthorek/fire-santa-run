/**
 * SubscriptionGate — full-screen paywall shown IN PLACE of a gated tool
 * (route editor, etc.) when the current brigade has no active subscription.
 *
 * This replaces the old behaviour where an unentitled user could open the
 * editor, fill in a route, hit Save, and only then bounce off a 402/403. Here
 * we stop them at the door with a clear, festive "subscribe to unlock" screen
 * and a one-tap Checkout button — no dead-end, no redirect loop.
 *
 * Dev mode never renders this (every brigade is entitled); callers gate on
 * `useBrigade().isEntitled`, which already accounts for dev mode.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBrigade } from '../context';
import { useSubscriptionPrice } from '../hooks/useSubscriptionPrice';
import { startBrigadeCheckout } from '../utils/billing';

export interface SubscriptionGateProps {
  /** Heading — tailor to the blocked action, e.g. "Subscribe to create routes". */
  title?: string;
  /** Supporting line under the heading. */
  message?: string;
}

export function SubscriptionGate({
  title = 'Subscribe to plan your Santa run',
  message = 'Planning routes and broadcasting a live run needs an active brigade subscription. Public live tracking is always free.',
}: SubscriptionGateProps) {
  const { brigade } = useBrigade();
  const { label: priceLabel } = useSubscriptionPrice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!brigade) return;
    setBusy(true);
    setError(null);
    try {
      await startBrigadeCheckout(brigade.id);
      // Success redirects to Stripe Checkout.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start checkout. Only brigade admins can subscribe — please try again.',
      );
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background: 'linear-gradient(160deg, var(--fire-red) 0%, var(--fire-red-dark, #B71C1C) 55%, var(--summer-gold) 140%)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 'var(--border-radius-lg, 20px)',
          padding: '2.25rem 1.75rem',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
          border: '4px solid var(--rfs-yellow)',
        }}
      >
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '0.75rem' }} aria-hidden="true">
          🎅🎁
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.6rem',
            color: 'var(--fire-red)',
            margin: '0 0 0.5rem',
          }}
        >
          {title}
        </h1>
        <p style={{ color: 'var(--neutral-700)', fontSize: '1rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
          {message}
        </p>

        {brigade && (
          <p style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
            One subscription covers <strong>{brigade.name}</strong> for the whole year — {priceLabel}.
          </p>
        )}

        <button
          type="button"
          onClick={handleSubscribe}
          disabled={busy || !brigade}
          style={{
            width: '100%',
            padding: '0.9rem 1.5rem',
            background: 'linear-gradient(135deg, var(--fire-red), var(--summer-gold))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius, 12px)',
            fontWeight: 800,
            fontSize: '1.05rem',
            fontFamily: 'var(--font-heading)',
            cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px rgba(211, 47, 47, 0.35)',
            opacity: busy ? 0.85 : 1,
          }}
        >
          {busy ? 'Starting…' : `Subscribe — ${priceLabel}`}
        </button>

        {error && (
          <p role="alert" style={{ color: 'var(--fire-red)', fontSize: '0.85rem', fontWeight: 600, margin: '0.75rem 0 0' }}>
            {error}
          </p>
        )}

        <div style={{ marginTop: '1.25rem' }}>
          <Link
            to="/dashboard"
            style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
          >
            ← Back to dashboard
          </Link>
        </div>

        <p style={{ color: 'var(--neutral-500)', fontSize: '0.75rem', margin: '1.25rem 0 0' }}>
          Payments are processed securely by Stripe. Only brigade admins can subscribe.
        </p>
      </div>
    </div>
  );
}
