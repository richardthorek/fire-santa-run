/**
 * EntitlementGate — full-screen paywall shown IN PLACE of a gated tool
 * (route editor, etc.) when the current organisation doesn't have Fire
 * Santa Run enabled.
 *
 * Fire Santa Run has no billing of its own — entitlement (`santaRunEnabled`)
 * comes entirely from the signed-in Station Manager organisation, either
 * bundled in a paying plan or bought as a standalone add-on. This screen
 * links out to Station Manager's organisation settings rather than starting
 * a checkout here.
 *
 * Dev mode never renders this (every session is entitled); callers gate on
 * `useBrigade().isEntitled`, which mirrors `useAuth().santaRunEnabled`.
 */

import { Link } from 'react-router-dom';
import { SUITE_AUTH_URL } from '../auth/suiteAuth';

export interface EntitlementGateProps {
  /** Heading — tailor to the blocked action, e.g. "Enable Fire Santa Run to create routes". */
  title?: string;
  /** Supporting line under the heading. */
  message?: string;
}

export function EntitlementGate({
  title = 'Enable Fire Santa Run for your organisation',
  message = 'Planning routes and broadcasting a live run needs an organisation with Fire Santa Run enabled. Public live tracking is always free.',
}: EntitlementGateProps) {
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
          border: '4px solid var(--summer-gold)',
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

        <p style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          Included with Station Manager&apos;s Basic and AI Pro plans, or available
          standalone for <strong>$10/year</strong> (unlimited use) or{' '}
          <strong>$15</strong> for a one-off month.
        </p>

        <a
          href={`${SUITE_AUTH_URL}/admin/organization`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.9rem 1.5rem',
            background: 'linear-gradient(135deg, var(--fire-red), var(--summer-gold))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius, 12px)',
            fontWeight: 800,
            fontSize: '1.05rem',
            fontFamily: 'var(--font-heading)',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(211, 47, 47, 0.35)',
            boxSizing: 'border-box',
          }}
        >
          Enable in Station Manager
        </a>

        <div style={{ marginTop: '1.25rem' }}>
          <Link
            to="/dashboard"
            style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
          >
            ← Back to dashboard
          </Link>
        </div>

        <p style={{ color: 'var(--neutral-500)', fontSize: '0.75rem', margin: '1.25rem 0 0' }}>
          Only an organisation owner or admin can change plan or billing.
        </p>
      </div>
    </div>
  );
}
