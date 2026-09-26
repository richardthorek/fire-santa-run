/**
 * BroadcastHealthBanner — mobile, prominent banner for the navigator (in-truck)
 * view surfacing that Santa's location isn't reaching viewers.
 *
 * Consumes the `broadcastHealth`/`lastSuccessfulBroadcastAt` pair returned by
 * `useLocationBroadcast`. Intentionally has no opinion on where it's mounted —
 * the caller wires it in (see useLocationBroadcast's return shape).
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { clearStoredToken } from '../auth/suiteAuth';

export type BroadcastHealth = 'ok' | 'degraded' | 'failing' | 'auth-expired';

export interface BroadcastHealthBannerProps {
  broadcastHealth: BroadcastHealth;
  /** Epoch ms of the last broadcast that succeeded, or null if none yet this session. */
  lastSuccessfulBroadcastAt: number | null;
}

export function BroadcastHealthBanner({ broadcastHealth, lastSuccessfulBroadcastAt }: BroadcastHealthBannerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (broadcastHealth === 'ok') return null;

  const handleSignInAgain = () => {
    clearStoredToken();
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
  };

  const isAuthExpired = broadcastHealth === 'auth-expired';
  const isFailing = broadcastHealth === 'failing';

  const message = isAuthExpired
    ? "Not broadcasting — viewers can't see Santa"
    : 'Having trouble sending location…';

  return (
    <div
      role={isAuthExpired || isFailing ? 'alert' : 'status'}
      aria-live={isAuthExpired || isFailing ? 'assertive' : 'polite'}
      style={{
        background: 'var(--fire-red)',
        color: '#ffffff',
        borderRadius: 'var(--border-radius, 12px)',
        padding: '0.85rem 1rem',
        margin: '0 0 0.75rem',
        boxShadow: 'var(--ui-shadow, 0 4px 12px rgba(0,0,0,0.15))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.6rem',
        fontFamily: 'var(--font-body, inherit)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <span role="img" aria-hidden="true" style={{ fontSize: '1.25rem' }}>
          {isAuthExpired ? '🔒' : '📡'}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{message}</div>
          {lastSuccessfulBroadcastAt && (
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
              Last sent {new Date(lastSuccessfulBroadcastAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
      {isAuthExpired && (
        <button
          type="button"
          onClick={handleSignInAgain}
          style={{
            background: '#ffffff',
            color: 'var(--fire-red, #D32F2F)',
            border: 'none',
            borderRadius: 'var(--border-radius-sm, 8px)',
            padding: '0.55rem 1rem',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Sign in again
        </button>
      )}
    </div>
  );
}
