import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { COLORS } from '../../utils/constants';

/**
 * OAuth Callback Page
 * 
 * This page handles the OAuth redirect after successful authentication with
 * Microsoft Entra External ID. MSAL automatically processes the auth code
 * and acquires tokens.
 * 
 * In dev mode, this page immediately redirects to dashboard.
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const { inProgress } = useMsal();
  const [error, setError] = useState<string | null>(null);
  
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  useEffect(() => {
    // In dev mode, immediately redirect to dashboard
    if (isDevMode) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // In production mode, wait for MSAL to finish processing the redirect
    // MSAL handles this automatically via handleRedirectPromise() in main.tsx
    // Once complete, redirect to dashboard
    if (inProgress === 'none') {
      // Get the return URL from session storage (if set during login)
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/dashboard';
      sessionStorage.removeItem('auth_return_url');
      
      navigate(returnUrl, { replace: true });
    }
  }, [isDevMode, inProgress, navigate]);

  // Handle errors from URL parameters (if any)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');
    
    if (errorParam) {
      setError(errorDescription || errorParam);
      
      // Redirect to login page after showing error
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    }
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: COLORS.neutral50,
      }}>
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>❌</div>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: COLORS.fireRed,
          marginBottom: '0.5rem',
        }}>
          Authentication Error
        </h1>
        <p style={{
          fontSize: '1rem',
          color: COLORS.neutral700,
          textAlign: 'center',
          maxWidth: '400px',
          marginBottom: '2rem',
        }}>
          {error}
        </p>
        <p style={{
          fontSize: '0.875rem',
          color: COLORS.neutral700,
        }}>
          Redirecting to login page...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: COLORS.neutral50,
    }}>
      {/* Loading Animation */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
        
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: COLORS.neutral900,
          marginBottom: '0.5rem',
        }}>
          Completing Sign In...
        </h1>
        
        <p style={{
          fontSize: '1rem',
          color: COLORS.neutral700,
          marginBottom: '2rem',
        }}>
          Please wait while we set up your session
        </p>

        {/* Loading Spinner */}
        <div style={{
          width: '48px',
          height: '48px',
          border: `4px solid ${COLORS.neutral200}`,
          borderTopColor: COLORS.fireRed,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
