/**
 * SessionExpiryBanner — warns a signed-in brigade member when their Station
 * Manager suite token (24h JWT, no refresh endpoint) is about to lapse.
 * Shown by AppLayout on authenticated pages when under 2 hours remain, so a
 * navigator doesn't get logged out mid-run.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearStoredToken, refreshSession } from '../auth/suiteAuth';
import { useSessionExpiry } from '../hooks/useSessionExpiry';

const WARNING_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

function formatExpiryTime(remainingMs: number): string {
  const expiresAt = new Date(Date.now() + remainingMs);
  return expiresAt
    .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    .replace('AM', 'am')
    .replace('PM', 'pm');
}

export function SessionExpiryBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { remainingMs } = useSessionExpiry();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (isDevMode || remainingMs === null || remainingMs >= WARNING_THRESHOLD_MS) {
    return null;
  }

  const goToLogin = () => {
    clearStoredToken();
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
  };

  const handleReSignIn = async () => {
    // Try a refresh first — if the token is still valid this keeps the
    // member signed in without leaving the run screen. Only fall back to a
    // full sign-in redirect once the token is actually beyond refreshing.
    setIsRefreshing(true);
    try {
      const session = await refreshSession();
      if (!session) goToLogin();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'var(--summer-gold)',
        color: 'var(--summer-gold-ink, #241A00)',
        textAlign: 'center',
        padding: '0.65rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
      }}
    >
      <span>
        <span role="img" aria-hidden="true">⏳</span>{' '}
        {remainingMs <= 0
          ? 'Your sign-in has expired. Sign in again to keep planning and broadcasting.'
          : `Your sign-in expires at ${formatExpiryTime(remainingMs)}. Sign in again now so it doesn't lapse during the run.`}
      </span>
      <button
        type="button"
        onClick={handleReSignIn}
        disabled={isRefreshing}
        style={{
          background: 'var(--summer-gold-ink, #241A00)',
          color: 'var(--summer-gold, #F6A609)',
          border: 'none',
          borderRadius: 'var(--border-radius-sm, 8px)',
          padding: '0.4rem 0.9rem',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: isRefreshing ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: isRefreshing ? 0.7 : 1,
        }}
      >
        {remainingMs <= 0 ? 'Sign in again' : 'Stay signed in'}
      </button>
    </div>
  );
}
