/**
 * LandingPage - Public-facing hero page with integrated authentication
 * Modern, compelling landing page with Australian Summer Christmas theme
 * Features: Hero section, comprehensive feature grid (advent calendar style), sign in/sign up
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { SEO } from '../components';
import { COLORS } from '../utils/constants';

export function LandingPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
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
        description="Track Santa in real-time as your local Rural Fire Service brings Christmas joy to your community. Plan routes, share tracking links, and spread holiday cheer!"
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
                fontSize: 'clamp(60px, 10vw, 72px)', 
                marginBottom: '0.75rem',
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}>
                🎅🚒🎄
              </div>
              <h1 style={{
                fontFamily: 'var(--font-fun)',
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 'normal',
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
                Real-Time Santa Tracking for RFS Brigades
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

            {/* Auth Buttons - Horizontal on larger screens */}
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              width: '100%',
            }}>
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
                <div className="auth-buttons-horizontal" style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}>
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="btn btn-primary"
                  >
                    {isLoggingIn ? '🎅 Signing in...' : '🎅 Sign In'}
                  </button>
                  
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="btn btn-secondary-white"
                  >
                    {isLoggingIn ? '🚀 Creating...' : '🚀 Sign Up Free'}
                  </button>
                </div>
              )}
              
              <p style={{
                fontSize: '0.75rem',
                marginTop: '1rem',
                marginBottom: 0,
                opacity: 0.9,
              }}>
                Sign in with your brigade email via Microsoft
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
                Comprehensive features designed for Australian RFS brigades
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
                border: '4px solid var(--rfs-yellow)',
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
                  Click-to-add waypoints, drag to reorder, optimize with Mapbox Directions API
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
                  Real-time location updates via Azure Web PubSub
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
                  Microsoft Entra ID
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
                  Free Forever
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  No subscriptions
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
              Built for Australian Fire Brigades
            </h2>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--neutral-800)',
              lineHeight: 1.8,
              marginBottom: '2rem',
            }}>
              Celebrate Christmas under the summer sun! This app brings together 
              the proud tradition of RFS community service with modern technology. 
              Plan routes through gum tree-lined streets, coordinate with your brigade, 
              and create magical memories for families across Australia.
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
                  🔥 Free
                </div>
                <div style={{ color: 'var(--neutral-700)', fontSize: '0.875rem' }}>
                  For All Brigades
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

        {/* Footer */}
        <footer style={{
          backgroundColor: 'var(--neutral-900)',
          color: 'var(--neutral-300)',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            🎄 Fire Santa Run • Made with ❤️ for Australian Rural Fire Service brigades
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
            © {new Date().getFullYear()} • Spreading summer Christmas magic across Australia
          </p>
        </footer>
      </div>
    </>
  );
}
