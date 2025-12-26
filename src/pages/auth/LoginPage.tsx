import { useEffect, useState } from 'react';
import { useAuth } from '../../context';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { COLORS } from '../../utils/constants';

/**
 * Login Page
 * 
 * Handles user authentication via Microsoft Entra External ID.
 * In dev mode, automatically redirects authenticated users.
 * In production mode, shows login button that redirects to Entra login.
 */
export function LoginPage() {
  const { isAuthenticated, login, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  // Support both URL parameter and location state for return URL
  const returnUrl = searchParams.get('returnUrl') || (location.state as any)?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, returnUrl]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      await login();
      // After successful login redirect, MSAL will handle the redirect
      // and the user will be authenticated
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError(
        error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred during login. Please try again.'
      );
      setIsLoggingIn(false);
    }
  };

  if (isLoading || isLoggingIn) {
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
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
        <p style={{ fontSize: '1.125rem', color: COLORS.neutral800 }}>
          {isLoggingIn ? 'Redirecting to login...' : 'Checking authentication...'}
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
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '3rem',
        maxWidth: '600px',
      }}>
        <div style={{ fontSize: '96px', marginBottom: '1rem' }}>🎅🎄</div>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          color: COLORS.fireRed,
          marginBottom: '1rem',
          lineHeight: 1.2,
        }}>
          Fire Santa Run
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: COLORS.neutral800,
          marginBottom: '0.5rem',
        }}>
          Track Santa's route in real-time
        </p>
        <p style={{
          fontSize: '1rem',
          color: COLORS.neutral700,
        }}>
          Plan routes, navigate with turn-by-turn directions, and share the magic with your community
        </p>
      </div>

      {/* Login Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        padding: '2.5rem',
        maxWidth: '400px',
        width: '100%',
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: COLORS.neutral900,
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}>
          Sign In or Sign Up
        </h2>
        <p style={{
          fontSize: '0.875rem',
          color: COLORS.neutral700,
          marginBottom: '2rem',
          textAlign: 'center',
        }}>
          {isDevMode 
            ? 'Development mode is enabled - you are automatically authenticated'
            : 'Sign in with your brigade email address, or create a new account to get started'}
        </p>

        {loginError && (
          <div style={{
            padding: '1rem',
            backgroundColor: COLORS.fireRedLight + '20',
            borderLeft: `4px solid ${COLORS.fireRed}`,
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: COLORS.fireRedDark,
              margin: 0,
            }}>
              {loginError}
            </p>
          </div>
        )}

        {isDevMode ? (
          <div style={{
            padding: '1rem',
            backgroundColor: COLORS.summerGoldLight + '40',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: COLORS.neutral800,
              margin: 0,
            }}>
              🛠️ Development Mode<br />
              You are automatically signed in
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'white',
                background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                border: 'none',
                borderRadius: '12px',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.7 : 1,
                transition: 'all 0.3s ease',
                marginBottom: '1rem',
              }}
              onMouseEnter={(e) => {
                if (!isLoggingIn) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In with Microsoft'}
            </button>
            
            <div style={{
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              margin: '1rem 0',
            }}>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: COLORS.neutral300,
              }} />
              <span style={{
                padding: '0 1rem',
                fontSize: '0.75rem',
                color: COLORS.neutral700,
                fontWeight: 500,
              }}>
                OR
              </span>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: COLORS.neutral300,
              }} />
            </div>
            
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.fireRed,
                background: 'white',
                border: `2px solid ${COLORS.fireRed}`,
                borderRadius: '12px',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.7 : 1,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (!isLoggingIn) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.15)';
                  e.currentTarget.style.backgroundColor = COLORS.neutral50;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              {isLoggingIn ? 'Creating account...' : 'Create New Account'}
            </button>
            
            <div style={{
              padding: '1rem',
              backgroundColor: COLORS.neutral100,
              borderRadius: '8px',
              marginTop: '1.5rem',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: COLORS.neutral700,
                margin: 0,
                lineHeight: 1.5,
              }}>
                <strong>New to Fire Santa Run?</strong><br />
                Click "Create New Account" to register. You'll be able to create an account using your email address through Microsoft's secure authentication system.
              </p>
            </div>
          </>
        )}

        <p style={{
          fontSize: '0.75rem',
          color: COLORS.neutral700,
          textAlign: 'center',
          marginTop: '1.5rem',
          marginBottom: 0,
        }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      {/* Info Section */}
      <div style={{
        marginTop: '3rem',
        maxWidth: '600px',
        textAlign: 'center',
      }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: COLORS.neutral900,
          marginBottom: '1rem',
        }}>
          For Brigade Members
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
            <p style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral900,
              margin: 0,
            }}>
              Plan Routes
            </p>
          </div>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧭</div>
            <p style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral900,
              margin: 0,
            }}>
              Navigate
            </p>
          </div>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📱</div>
            <p style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: COLORS.neutral900,
              margin: 0,
            }}>
              Share Live Tracking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
