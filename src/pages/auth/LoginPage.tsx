import { useEffect, useState } from 'react';
import { useAuth } from '../../context';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { COLORS } from '../../utils/constants';

type Mode = 'login' | 'signup';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.85rem 1rem',
  fontSize: '1rem',
  border: `1px solid ${COLORS.neutral300}`,
  borderRadius: '10px',
  marginBottom: '0.9rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: COLORS.neutral700,
  marginBottom: '0.3rem',
};

/**
 * Login / Sign-up Page
 *
 * Authenticates against Station Manager (the StationKit suite identity
 * provider). Sign-up creates a new Station Manager organisation (Community
 * plan) and its owner account — the brigade in this app.
 * In dev mode, automatically redirects authenticated users.
 */
export function LoginPage() {
  const { isAuthenticated, login, loginWithPasskey, signup, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
  const passkeySupported = browserSupportsWebAuthn();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');

  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const returnUrl = searchParams.get('returnUrl') || (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await signup({ organizationName, billingEmail: email, username, password, email });
      }
    } catch (error) {
      console.error(`${mode} failed:`, error);
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setSubmitError(null);
    setIsPasskeySubmitting(true);
    try {
      await loginWithPasskey();
    } catch (error) {
      // A cancelled OS prompt throws NotAllowedError — not a real failure.
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setIsPasskeySubmitting(false);
        return;
      }
      console.error('Passkey sign-in failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Passkey sign-in failed. Please try again.');
      setIsPasskeySubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', backgroundColor: COLORS.neutral50 }}>
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
        <p style={{ fontSize: '1.125rem', color: COLORS.neutral800 }}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', backgroundColor: COLORS.neutral50 }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: '600px' }}>
        <div style={{ fontSize: '96px', marginBottom: '1rem' }}>🎅🎄</div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: COLORS.fireRed, marginBottom: '1rem', lineHeight: 1.2 }}>
          Fire Santa Run
        </h1>
        <p style={{ fontSize: '1.25rem', color: COLORS.neutral800, marginBottom: '0.5rem' }}>
          Track Santa's route in real-time
        </p>
        <p style={{ fontSize: '1rem', color: COLORS.neutral700 }}>
          Plan routes, navigate with turn-by-turn directions, and share the magic with your community
        </p>
      </div>

      {/* Login/Signup Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '2.5rem', maxWidth: '420px', width: '100%' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.neutral900, marginBottom: '0.5rem', textAlign: 'center' }}>
          {mode === 'login' ? 'Sign In' : 'Create Your Brigade Account'}
        </h2>
        <p style={{ fontSize: '0.875rem', color: COLORS.neutral700, marginBottom: '1.5rem', textAlign: 'center' }}>
          {isDevMode
            ? 'Development mode is enabled - you are automatically authenticated'
            : mode === 'login'
              ? 'Sign in with your StationKit account (Station Manager, Fire Santa Run, or any StationKit app).'
              : "Create a free brigade account. It's the same account used across StationKit."}
        </p>

        {isDevMode ? (
          <div style={{ padding: '1rem', backgroundColor: COLORS.summerGoldLight + '40', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: COLORS.neutral800, margin: 0 }}>
              🛠️ Development Mode<br />You are automatically signed in
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <label style={labelStyle} htmlFor="organizationName">Brigade / organisation name</label>
                <input
                  id="organizationName"
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Riverside Fire Brigade"
                  required
                  style={inputStyle}
                />
                <label style={labelStyle} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                />
              </>
            )}

            <label style={labelStyle} htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
              style={inputStyle}
            />

            {submitError && (
              <div style={{ padding: '0.85rem 1rem', backgroundColor: COLORS.fireRedLight + '20', borderLeft: `4px solid ${COLORS.fireRed}`, borderRadius: '8px', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.875rem', color: COLORS.fireRedDark, margin: 0 }}>{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'white',
                background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                border: 'none',
                borderRadius: '12px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                marginBottom: '1rem',
              }}
            >
              {isSubmitting ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>

            {mode === 'login' && passkeySupported && (
              <button
                type="button"
                onClick={() => void handlePasskeyLogin()}
                disabled={isPasskeySubmitting}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.fireRed,
                  background: 'white',
                  border: `2px solid ${COLORS.fireRed}`,
                  borderRadius: '12px',
                  cursor: isPasskeySubmitting ? 'not-allowed' : 'pointer',
                  opacity: isPasskeySubmitting ? 0.7 : 1,
                  marginBottom: '1rem',
                }}
              >
                {isPasskeySubmitting ? 'Waiting for passkey…' : '🔑 Sign in with a passkey'}
              </button>
            )}

            <p style={{ fontSize: '0.875rem', color: COLORS.neutral700, textAlign: 'center', margin: 0 }}>
              {mode === 'login' ? (
                <>New to Fire Santa Run?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setSubmitError(null); }} style={{ background: 'none', border: 'none', color: COLORS.fireRed, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Create an account
                  </button>
                </>
              ) : (
                <>Already have a StationKit account?{' '}
                  <button type="button" onClick={() => { setMode('login'); setSubmitError(null); }} style={{ background: 'none', border: 'none', color: COLORS.fireRed, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        )}

        <p style={{ fontSize: '0.75rem', color: COLORS.neutral700, textAlign: 'center', marginTop: '1.5rem', marginBottom: 0 }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      {/* Info Section */}
      <div style={{ marginTop: '3rem', maxWidth: '600px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.neutral900, marginBottom: '1rem' }}>For Brigade Members</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral900, margin: 0 }}>Plan Routes</p>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧭</div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral900, margin: 0 }}>Navigate</p>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📱</div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.neutral900, margin: 0 }}>Share Live Tracking</p>
          </div>
        </div>
      </div>
    </div>
  );
}
