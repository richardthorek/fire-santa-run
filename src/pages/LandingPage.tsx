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
        backgroundColor: 'var(--neutral-50)',
        overflow: 'auto',
      }}>
        {/* Hero Section */}
        <section style={{
          background: 'linear-gradient(135deg, var(--santa-red) 0%, var(--fire-red-dark) 50%, var(--gold-accent) 100%)',
          color: 'white',
          padding: '4rem 2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative elements */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
          
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ 
              fontSize: '96px', 
              marginBottom: '1rem',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}>
              🎅🚒🎄
            </div>
            <h1 style={{
              fontFamily: 'var(--font-fun)',
              fontSize: 'clamp(2.5rem, 8vw, 5rem)',
              fontWeight: 'normal',
              marginBottom: '1rem',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              lineHeight: 1.1,
            }}>
              Fire Santa Run
            </h1>
            <p style={{
              fontSize: 'clamp(1.25rem, 3vw, 2rem)',
              marginBottom: '0.5rem',
              fontWeight: 600,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
            }}>
              Track Santa's Journey in Real-Time
            </p>
            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              marginBottom: '3rem',
              opacity: 0.95,
              maxWidth: '600px',
              margin: '0 auto 3rem',
            }}>
              Your local Rural Fire Service brings Christmas magic to the community. 
              Plan routes, navigate with confidence, and share the festive joy!
            </p>
          </div>
        </section>

        {/* Authentication Section */}
        <section style={{
          padding: '3rem 2rem',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            boxShadow: 'var(--ui-shadow-soft)',
            padding: '2.5rem',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.75rem',
              color: COLORS.fireRed,
              marginBottom: '0.5rem',
              textAlign: 'center',
            }}>
              Sign In or Sign Up
            </h2>
            <p style={{
              fontSize: '0.95rem',
              color: COLORS.neutral700,
              marginBottom: '2rem',
              textAlign: 'center',
            }}>
              {isDevMode 
                ? '🛠️ Development mode - you are automatically authenticated'
                : 'Join your brigade to plan routes and track Santa'}
            </p>

            {loginError && (
              <div style={{
                padding: '1rem',
                backgroundColor: COLORS.fireRedLight + '20',
                borderLeft: `4px solid ${COLORS.fireRed}`,
                borderRadius: '12px',
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
                padding: '1.25rem',
                backgroundColor: COLORS.summerGoldLight + '40',
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '0.95rem',
                  color: COLORS.neutral800,
                  margin: 0,
                }}>
                  🛠️ Development Mode Active<br />
                  <strong>You are automatically signed in</strong>
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    marginTop: '1rem',
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'white',
                    background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  style={{
                    width: '100%',
                    padding: '1.15rem',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'white',
                    background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                    opacity: isLoggingIn ? 0.7 : 1,
                    transition: 'all 0.3s ease',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoggingIn) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(211, 47, 47, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.3)';
                  }}
                >
                  {isLoggingIn ? '🎅 Signing in...' : '🎅 Sign In with Microsoft'}
                </button>
                
                <div style={{
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  margin: '1.25rem 0',
                }}>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    backgroundColor: COLORS.neutral300,
                  }} />
                  <span style={{
                    padding: '0 1rem',
                    fontSize: '0.8rem',
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
                    padding: '1.15rem',
                    fontSize: '1.05rem',
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
                  {isLoggingIn ? '🚀 Creating account...' : '🚀 Create New Account'}
                </button>
                
                <div style={{
                  padding: '1rem',
                  backgroundColor: COLORS.neutral100,
                  borderRadius: '10px',
                  marginTop: '1.5rem',
                }}>
                  <p style={{
                    fontSize: '0.8rem',
                    color: COLORS.neutral700,
                    margin: 0,
                    lineHeight: 1.5,
                  }}>
                    <strong>New to Fire Santa Run?</strong><br />
                    Click "Create New Account" to register with your brigade email address through Microsoft's secure authentication system.
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
        </section>

        {/* Features Section - Advent Calendar Style Grid */}
        <section style={{
          padding: '4rem 2rem',
          background: 'linear-gradient(180deg, var(--neutral-50) 0%, var(--sand-light) 100%)',
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                color: 'var(--fire-red)',
                marginBottom: '1rem',
              }}>
                🎄 Open the Doors to Christmas Magic 🎄
              </h2>
              <p style={{
                fontSize: '1.125rem',
                color: 'var(--neutral-700)',
                maxWidth: '700px',
                margin: '0 auto',
              }}>
                Discover all the features that make Fire Santa Run the perfect tool for your brigade's Christmas celebrations
              </p>
            </div>

            {/* Advent Calendar Grid - Mixed sizes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              gridAutoRows: 'auto',
            }}>
              
              {/* Large Feature 1 - Route Planning */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                gridRow: 'span 2',
                backgroundColor: 'white',
                padding: '2.5rem',
                borderRadius: '24px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '4px solid var(--rfs-yellow)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--fire-red)',
                  color: 'white',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                }}>1</div>
                <div style={{ fontSize: '80px', marginBottom: '1.5rem' }}>🗺️</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.8rem',
                  color: 'var(--fire-red)',
                  marginBottom: '1rem',
                }}>
                  Interactive Route Planning
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6, fontSize: '1.05rem' }}>
                  Plan your Santa run with intuitive click-to-add waypoints on an interactive Mapbox map. 
                  Drag waypoints to reorder stops, search for addresses, and optimize routes automatically.
                </p>
              </div>

              {/* Medium Feature 2 - Real-Time Tracking */}
              <div className="card-hover" style={{
                gridRow: 'span 2',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '20px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--christmas-green)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--christmas-green)',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>2</div>
                <div style={{ fontSize: '64px', marginBottom: '1rem' }}>📍</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--christmas-green)',
                  marginBottom: '1rem',
                }}>
                  Live GPS Tracking
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6 }}>
                  Families track Santa live on a beautiful candy cane route. 
                  Real-time location updates via Azure Web PubSub with smooth animations.
                </p>
              </div>

              {/* Small Feature 3 - Turn-by-Turn */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--gold-accent)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--gold-accent)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>3</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>🧭</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--gold-accent)',
                  marginBottom: '0.75rem',
                }}>
                  Turn-by-Turn Navigation
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Professional navigation with voice guidance powered by Mapbox Directions API.
                </p>
              </div>

              {/* Small Feature 4 - QR Codes */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--sky-blue)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--sky-blue)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>4</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>📱</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--sky-blue)',
                  marginBottom: '0.75rem',
                }}>
                  QR Codes & Links
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Generate shareable tracking links and downloadable QR codes for flyers.
                </p>
              </div>

              {/* Medium Feature 5 - Multi-Brigade */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '20px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--sunset-orange)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--sunset-orange)',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>5</div>
                <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🚒</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--sunset-orange)',
                  marginBottom: '1rem',
                }}>
                  Multi-Brigade Support
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6 }}>
                  Each brigade gets isolated data and configuration. Manage multiple routes, 
                  historical archives, and custom branding. Built for the entire RFS community.
                </p>
              </div>

              {/* Small Feature 6 - Mobile First */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--eucalyptus-green)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--eucalyptus-green)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>6</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>📲</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--eucalyptus-green)',
                  marginBottom: '0.75rem',
                }}>
                  Mobile-First Design
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Optimized for drivers and families on mobile devices.
                </p>
              </div>

              {/* Small Feature 7 - Voice Guidance */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--summer-gold)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--summer-gold)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>7</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>🔊</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--summer-gold)',
                  marginBottom: '0.75rem',
                }}>
                  Voice Instructions
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Text-to-speech turn warnings keep drivers focused on the road.
                </p>
              </div>

              {/* Small Feature 8 - Progress Tracking */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--fire-red-light)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--fire-red-light)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>8</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>📊</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--fire-red-light)',
                  marginBottom: '0.75rem',
                }}>
                  Progress Tracking
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Real-time ETAs, completion status, and route progress indicators.
                </p>
              </div>

              {/* Medium Feature 9 - Social Sharing */}
              <div className="card-hover" style={{
                gridColumn: 'span 2',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '20px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--ocean-blue)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'var(--ocean-blue)',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>9</div>
                <div style={{ fontSize: '64px', marginBottom: '1rem' }}>📢</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  color: 'var(--ocean-blue)',
                  marginBottom: '1rem',
                }}>
                  Rich Social Media Previews
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6 }}>
                  Share routes on Facebook, Twitter, and more with beautiful Open Graph previews. 
                  Dynamic meta tags show route details and festive imagery.
                </p>
              </div>

              {/* Small Feature 10 - Offline Support */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--gumtree-green)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--gumtree-green)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>10</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>📶</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--gumtree-green)',
                  marginBottom: '0.75rem',
                }}>
                  Offline Ready
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Routes cached locally for areas with poor connectivity.
                </p>
              </div>

              {/* Small Feature 11 - Security */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--fire-red)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--fire-red)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>11</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>🔒</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--fire-red)',
                  marginBottom: '0.75rem',
                }}>
                  Enterprise Security
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  Microsoft Entra authentication with domain whitelisting.
                </p>
              </div>

              {/* Small Feature 12 - Free Forever */}
              <div className="card-hover" style={{
                backgroundColor: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                boxShadow: 'var(--ui-shadow-soft)',
                textAlign: 'center',
                border: '3px solid var(--christmas-green)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'var(--christmas-green)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}>12</div>
                <div style={{ fontSize: '56px', marginBottom: '0.75rem' }}>🎁</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.3rem',
                  color: 'var(--christmas-green)',
                  marginBottom: '0.75rem',
                }}>
                  Free Forever
                </h3>
                <p style={{ color: 'var(--neutral-700)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  No subscriptions, no hidden fees. Free for all RFS brigades.
                </p>
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
