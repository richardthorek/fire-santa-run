/**
 * LandingPage - Public-facing hero page with integrated authentication
 * Modern, compelling landing page with Australian Summer Christmas theme
 * Features: Hero section, comprehensive feature grid (advent calendar style), sign in/sign up
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
// Direct imports: the components/hooks barrels drag mapbox-gl into this public page's chunk.
import { SEO } from '../components/SEO';
import { useSubscriptionPrice } from '../hooks/useSubscriptionPrice';
import { COLORS } from '../utils/constants';

export function LandingPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  // Live price from Stripe (falls back to the static $5 AUD/year) so the page
  // never goes stale when the price changes in the Stripe dashboard.
  const { price, amount, currency } = useSubscriptionPrice();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      await login();
      // After successful login redirect, MSAL will handle the redirect
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

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--neutral-50)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
          <p style={{ color: 'var(--neutral-700)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Fire Santa Run - Track Santa in Real-Time"
        description="Track Santa in real-time as your local fire brigade or community group brings Christmas joy to your neighbourhood. Plan routes, share tracking links, and spread holiday cheer!"
      />
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--santa-red) 0%, var(--fire-red-dark) 30%, var(--fire-red) 60%, var(--sand-light) 100%)',
        overflow: 'auto',
      }}>
        {/* Integrated Hero & Auth Section */}
        <section style={{
          color: 'white',
          padding: '2.5rem 2rem 3rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
          
          <div style={{ 
            position: 'relative', 
            zIndex: 1, 
            maxWidth: '1200px', 
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '2rem',
            alignItems: 'center',
          }}>
            {/* Title Section */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                marginBottom: '0.75rem',
              }}>
                <img
                  src="/icon.svg"
                  alt="Fire Santa Run logo"
                  width={80}
                  height={80}
                  style={{
                    filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.3))',
                  }}
                />
                <div style={{
                  fontSize: 'clamp(40px, 8vw, 56px)',
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                }}>
                  🚒🎄
                </div>
              </div>
              <h1 style={{
                fontFamily: 'var(--font-fun)',
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 'normal',
                color: 'white',
                marginBottom: '0.75rem',
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                lineHeight: 1.1,
              }}>
                Fire Santa Run
              </h1>
              <p style={{
                fontSize: 'clamp(1.15rem, 2.5vw, 1.4rem)',
                marginBottom: '0.5rem',
                fontWeight: 700,
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              }}>
                Real-Time Santa Tracking for Brigades &amp; Community Groups
              </p>
              <p style={{
                fontSize: 'clamp(0.95rem, 1.6vw, 1.05rem)',
                marginBottom: 0,
                opacity: 0.95,
                maxWidth: '700px',
                margin: '0 auto',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              }}>
                Plan routes • Navigate with GPS • Share live tracking links • Spread Christmas joy
              </p>
            </div>

            {/* Public-first CTA: most visitors are families looking for their
                town's run — put "find Santa" ahead of the organizer sign-in. */}
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              width: '100%',
            }}>
              <Link
                to="/brigades?near=1"
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '1.1rem 1.5rem',
                  backgroundColor: 'white',
                  color: 'var(--fire-red)',
                  borderRadius: '14px',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)',
                  textDecoration: 'none',
                  textAlign: 'center',
                  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.25)',
                }}
              >
                🎅 Find a Santa run near me
              </Link>
              <p style={{ margin: '0.6rem 0 1.75rem', fontSize: '0.85rem', opacity: 0.95 }}>
                Free live tracking for everyone — no account, no app.{' '}
                <Link to="/brigades" style={{ color: 'white', fontWeight: 700, textDecoration: 'underline' }}>
                  Browse all brigades
                </Link>
                {' · '}
                <Link to="/demo" style={{ color: 'white', fontWeight: 700, textDecoration: 'underline' }}>
                  Watch a live demo
                </Link>
              </p>

              {loginError && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '10px',
                  marginBottom: '1rem',
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
                  padding: '1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '14px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontSize: '0.9rem',
                    marginBottom: '1rem',
                    opacity: 0.95,
                  }}>
                    🛠️ Development Mode Active
                  </p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="btn btn-tertiary btn-block"
                  >
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                /* One organizer CTA — sign-in and sign-up share the same flow */
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="btn btn-secondary-white btn-block"
                >
                  {isLoggingIn ? '🚒 Signing in...' : '🚒 Run a Santa run — brigade sign in'}
                </button>
              )}

              <p style={{
                fontSize: '0.75rem',
                marginTop: '1rem',
                marginBottom: 0,
                opacity: 0.9,
              }}>
                New brigades and community groups welcome — use an official organisation email where possible to speed up verification.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section - Advent Calendar Style Grid with extended red background */}
        <section style={{
          padding: '3rem 2rem 4rem',
          position: 'relative',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem', color: 'white' }}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.75rem, 4.5vw, 2.25rem)',
                color: 'white',
                marginBottom: '0.75rem',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              }}>
                Everything You Need for Your Santa Run
              </h2>
              <p style={{
                fontSize: '1rem',
                maxWidth: '700px',
                margin: '0 auto',
                opacity: 0.95,
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              }}>
                Everything a fire brigade, fire department, or community crew needs to run the perfect Santa run
              </p>
            </div>

            {/* Fixed grid layout - ensures proper filling */}
            <div className="advent-calendar-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridAutoRows: '200px',
              gap: '1rem',
            }}>
              
              {/* Row 1: 2x2 large + two 1x1 */}
              {/* Large Feature 1 - Route Planning (2x2) */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                gridRow: 'span 2',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '20px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '4px solid var(--summer-gold)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--fire-red)',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}>1</div>
                <div style={{ fontSize: '60px', marginBottom: '1rem' }}>🗺️</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--fire-red)',
                  marginBottom: '0.75rem',
                }}>
                  Route Planning
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.95rem' }}>
                  Click to add stops, drag to reorder, and let smart optimisation find your quickest loop
                </p>
              </div>

              {/* Small Feature 2 - QR Codes (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--sky-blue)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--sky-blue)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>2</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>📱</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--sky-blue)',
                  marginBottom: '0.5rem',
                }}>
                  QR Codes
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Shareable links & QR codes
                </p>
              </div>

              {/* Small Feature 3 - Voice (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--summer-gold)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--summer-gold)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>3</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>🔊</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--summer-gold)',
                  marginBottom: '0.5rem',
                }}>
                  Voice Nav
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Text-to-speech guidance
                </p>
              </div>

              {/* Row 2 continued */}
              {/* Small Feature 4 - Turn-by-Turn (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--gold-accent)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--gold-accent)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>4</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>🧭</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--gold-accent)',
                  marginBottom: '0.5rem',
                }}>
                  Navigation
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Turn-by-turn directions
                </p>
              </div>

              {/* Small Feature 5 - Mobile (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--eucalyptus-green)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--eucalyptus-green)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>5</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>📲</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--eucalyptus-green)',
                  marginBottom: '0.5rem',
                }}>
                  Mobile-First
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Optimized for phones
                </p>
              </div>

              {/* Row 3: Medium 2x1, two 1x1 */}
              {/* Medium Feature 6 - Live Tracking (2x1) */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--christmas-green)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--christmas-green)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}>6</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>📍</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.4rem',
                  color: 'var(--christmas-green)',
                  marginBottom: '0.75rem',
                }}>
                  Live GPS Tracking
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Santa moves on the map the instant the truck does
                </p>
              </div>

              {/* Small Feature 7 - Progress (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--fire-red-light)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--fire-red-light)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>7</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>📊</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--fire-red-light)',
                  marginBottom: '0.5rem',
                }}>
                  Progress
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Real-time ETAs
                </p>
              </div>

              {/* Small Feature 8 - Offline (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--gumtree-green)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--gumtree-green)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>8</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>📶</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--gumtree-green)',
                  marginBottom: '0.5rem',
                }}>
                  Offline Ready
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Cached locally
                </p>
              </div>

              {/* Row 4: two 1x1, Medium 2x1 */}
              {/* Small Feature 9 - Security (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--fire-red)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--fire-red)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>9</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>🔒</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--fire-red)',
                  marginBottom: '0.5rem',
                }}>
                  Secure
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  Protected sign-in for your team
                </p>
              </div>

              {/* Small Feature 10 - Free (1x1) */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--christmas-green)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--christmas-green)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>10</div>
                <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>🎁</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--christmas-green)',
                  marginBottom: '0.5rem',
                }}>
                  Free to Follow
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  No app or login for your community
                </p>
              </div>

              {/* Medium Feature 11 - Multi-Brigade (2x1) */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--sunset-orange)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--sunset-orange)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}>11</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>🚒</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.4rem',
                  color: 'var(--sunset-orange)',
                  marginBottom: '0.75rem',
                }}>
                  Multi-Brigade Support
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Isolated data, custom branding for each brigade
                </p>
              </div>

              {/* Row 5: Medium 2x1, decorative 1x1, small 1x1 */}
              {/* Medium Feature 12 - Social Sharing (2x1) */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                textAlign: 'center',
                border: '3px solid var(--ocean-blue)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--ocean-blue)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}>12</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>📢</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.4rem',
                  color: 'var(--ocean-blue)',
                  marginBottom: '0.75rem',
                }}>
                  Social Media Ready
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Beautiful Open Graph previews for sharing
                </p>
              </div>

              {/* Decorative element (1x1) - Christmas themed */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '16px',
                border: '3px dashed rgba(255, 255, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '64px',
              }}>
                🎄
              </div>

              {/* Decorative element (1x1) - Santa themed */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '16px',
                border: '3px dashed rgba(255, 255, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '64px',
              }}>
                🎅
              </div>
            </div>
          </div>
        </section>
        {/* Community Section */}
        <section style={{
          backgroundColor: 'var(--sand-light)',
          padding: '4rem 2rem',
          marginTop: '2rem',
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '72px', marginBottom: '1.5rem' }}>🚒🎅🌏</div>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              color: 'var(--fire-red)',
              marginBottom: '1.5rem',
            }}>
              Born in Australia, Built for Santa Runs Everywhere
            </h2>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--neutral-800)',
              lineHeight: 1.8,
              marginBottom: '2rem',
            }}>
              From fire brigades cruising gum tree-lined streets under the summer sun
              to fire departments and community crews rolling through the snow — this
              app brings the proud tradition of local Santa runs together with modern
              technology. Plan your route, coordinate your team, and create magical
              memories for families in your community, wherever you are in the world.
            </p>
            <div style={{
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '2.5rem',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: 'var(--fire-red)',
                }}>
                  🔥 Simple
                </div>
                <div style={{ color: 'var(--neutral-700)', fontSize: '0.875rem' }}>
                  Set Up in Minutes
                </div>
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: 'var(--christmas-green)',
                }}>
                  📱 Mobile
                </div>
                <div style={{ color: 'var(--neutral-700)', fontSize: '0.875rem' }}>
                  Optimized First
                </div>
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: 'var(--gold-accent)',
                }}>
                  ⚡ Real-Time
                </div>
                <div style={{ color: 'var(--neutral-700)', fontSize: '0.875rem' }}>
                  Live Updates
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section style={{
          padding: '3.5rem 2rem 4rem',
          backgroundColor: 'var(--neutral-50)',
          position: 'relative',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.75rem, 4.5vw, 2.25rem)',
                color: 'var(--fire-red)',
                marginBottom: '0.75rem',
              }}>
                Simple, Transparent Pricing
              </h2>
              <p style={{
                fontSize: '1.05rem',
                color: 'var(--neutral-700)',
                maxWidth: '700px',
                margin: '0 auto',
              }}>
                Public tracking is always free. Brigades and community groups pay one small yearly fee to plan and run unlimited Santa runs.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
              maxWidth: '1000px',
              margin: '0 auto',
            }}>
              {/* Public Viewer */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                border: '2px solid var(--neutral-200)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ fontSize: '56px', marginBottom: '1rem' }}>🎅</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--fire-red)',
                  marginBottom: '0.5rem',
                }}>
                  Public Viewer
                </h3>
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: 'var(--fire-red)',
                  margin: '1rem 0 0.5rem',
                }}>
                  Free
                </div>
                <p style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', marginTop: '1rem', marginBottom: '1.5rem', flex: 1 }}>
                  Track Santa in real-time with shared QR codes or links. No account or app required.
                </p>
                <ul style={{
                  textAlign: 'left',
                  color: 'var(--neutral-700)',
                  fontSize: '0.95rem',
                  marginBottom: '1.5rem',
                  listStyle: 'none',
                  padding: 0,
                }}>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Live GPS tracking</li>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Route progress</li>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Viewer count</li>
                  <li>✅ Works on any device</li>
                </ul>
              </div>

              {/* Brigade Plan */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 8px 24px rgba(211, 47, 47, 0.15)',
                border: '3px solid var(--fire-red)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transform: 'scale(1.05)',
                transformOrigin: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--fire-red)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}>
                  POPULAR
                </div>

                <div style={{ fontSize: '56px', marginBottom: '1rem' }}>🚒</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--fire-red)',
                  marginBottom: '0.5rem',
                  marginTop: '0.5rem',
                }}>
                  Brigade Pro
                </h3>
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: 'var(--fire-red)',
                  margin: '1rem 0 0.25rem',
                }}>
                  {amount}
                  <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--neutral-600)' }}>/{price.interval}</span>
                </div>
                <p style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem' }}>
                  One simple price per brigade — less than a coffee, covers the whole year.
                  <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--neutral-500)' }}>
                    Billed in {currency}.
                  </span>
                </p>
                <ul style={{
                  textAlign: 'left',
                  color: 'var(--neutral-700)',
                  fontSize: '0.95rem',
                  marginBottom: '1.5rem',
                  listStyle: 'none',
                  padding: 0,
                  flex: 1,
                }}>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Unlimited Santa runs</li>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Route planning & optimization</li>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Turn-by-turn navigation</li>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Brigade branding</li>
                  <li style={{ marginBottom: '0.75rem' }}>✅ Analytics dashboard</li>
                  <li>✅ Team member access</li>
                </ul>

                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--fire-red)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                    opacity: isLoggingIn ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => !isLoggingIn && (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => !isLoggingIn && (e.currentTarget.style.opacity = '1')}
                >
                  {isLoggingIn ? '🎅 Setting up...' : '🎅 Get Started'}
                </button>
              </div>

              {/* Teams (Future) */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                border: '2px solid var(--neutral-200)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                opacity: 0.75,
              }}>
                <div style={{ fontSize: '56px', marginBottom: '1rem' }}>🏢</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--neutral-600)',
                  marginBottom: '0.5rem',
                }}>
                  Multi-Brigade
                </h3>
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: 'var(--neutral-600)',
                  margin: '1rem 0 0.5rem',
                }}>
                  Coming Soon
                </div>
                <p style={{ color: 'var(--neutral-600)', fontSize: '0.9rem', marginTop: '1rem', marginBottom: '1.5rem', flex: 1 }}>
                  For district-level coordination. Contact us for early access.
                </p>
                <ul style={{
                  textAlign: 'left',
                  color: 'var(--neutral-600)',
                  fontSize: '0.95rem',
                  marginBottom: '1.5rem',
                  listStyle: 'none',
                  padding: 0,
                }}>
                  <li style={{ marginBottom: '0.75rem' }}>✨ Coordinate across brigades</li>
                  <li style={{ marginBottom: '0.75rem' }}>✨ Cross-brigade analytics</li>
                  <li>✨ Custom training & support</li>
                </ul>
                <button style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--neutral-200)',
                  color: 'var(--neutral-700)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'not-allowed',
                }}>
                  Coming Soon
                </button>
              </div>
            </div>

            {/* FAQ Section */}
            <div style={{ marginTop: '4rem', maxWidth: '800px', margin: '4rem auto 0' }}>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                color: 'var(--fire-red)',
                marginBottom: '1.5rem',
                textAlign: 'center',
              }}>
                Frequently Asked Questions
              </h3>

              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--neutral-200)' }}>
                  <h4 style={{ color: 'var(--fire-red)', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                    What does it cost?
                  </h4>
                  <p style={{ color: 'var(--neutral-700)', margin: 0, fontSize: '0.95rem' }}>
                    {amount} {currency} a year per brigade — just enough to keep the servers running. You can explore the app and set up your brigade before subscribing; the subscription unlocks route planning and live broadcasting.
                  </p>
                </div>

                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--neutral-200)' }}>
                  <h4 style={{ color: 'var(--fire-red)', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                    Do public viewers need to pay?
                  </h4>
                  <p style={{ color: 'var(--neutral-700)', margin: 0, fontSize: '0.95rem' }}>
                    No—sharing a tracking link or QR code is completely free. Public tracking requires no account or payment.
                  </p>
                </div>

                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--neutral-200)' }}>
                  <h4 style={{ color: 'var(--fire-red)', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                    Can we cancel anytime?
                  </h4>
                  <p style={{ color: 'var(--neutral-700)', margin: 0, fontSize: '0.95rem' }}>
                    Absolutely—no long-term contracts, no lock-in. Cancel your subscription at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          backgroundColor: 'var(--neutral-900)',
          color: 'var(--neutral-300)',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            🎄 Fire Santa Run • Made with ❤️ for the brigades, departments, and community crews who bring Santa to town
          </p>
          <nav aria-label="Legal and help" style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem 1.25rem',
            margin: '1rem 0 0',
            fontSize: '0.8125rem',
          }}>
            <Link to="/brigades" style={{ color: 'var(--neutral-300)', textDecoration: 'underline' }}>Find a brigade</Link>
            <Link to="/help" style={{ color: 'var(--neutral-300)', textDecoration: 'underline' }}>How to track Santa</Link>
            <Link to="/privacy" style={{ color: 'var(--neutral-300)', textDecoration: 'underline' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: 'var(--neutral-300)', textDecoration: 'underline' }}>Terms of Use</Link>
          </nav>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
            © {new Date().getFullYear()} • Spreading Christmas magic, one Santa run at a time
          </p>
        </footer>
      </div>
    </>
  );
}
