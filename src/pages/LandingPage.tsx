/**
 * LandingPage - Public-facing hero page
 * Modern, compelling landing page with Australian Summer Christmas theme
 * Features: Hero section, value propositions, sign in/sign up CTAs
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { SEO } from '../components';

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

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

            {/* CTA Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '2rem',
            }}>
              <a
                href="/login"
                style={{
                  padding: '1.25rem 2.5rem',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--santa-red)',
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  textDecoration: 'none',
                  display: 'inline-block',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
                }}
              >
                🎄 Sign In
              </a>
              <a
                href="/login"
                style={{
                  padding: '1.25rem 2.5rem',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'white',
                  backgroundColor: 'transparent',
                  border: '3px solid white',
                  borderRadius: 'var(--border-radius)',
                  textDecoration: 'none',
                  display: 'inline-block',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🚀 Sign Up Free
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section style={{
          padding: '4rem 2rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              color: 'var(--fire-red)',
              marginBottom: '1rem',
            }}>
              Aussie Summer Christmas Magic ☀️
            </h2>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--neutral-700)',
              maxWidth: '700px',
              margin: '0 auto',
            }}>
              Designed for Australian Rural Fire Service brigades to spread Christmas joy 
              while celebrating our unique summer traditions
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            marginTop: '3rem',
          }}>
            {/* Feature 1 */}
            <div className="card-hover" style={{
              backgroundColor: 'white',
              padding: '2.5rem',
              borderRadius: 'var(--border-radius)',
              boxShadow: 'var(--ui-shadow-soft)',
              textAlign: 'center',
              border: '3px solid var(--rfs-yellow)',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🗺️</div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                color: 'var(--fire-red)',
                marginBottom: '1rem',
              }}>
                Route Planning
              </h3>
              <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6 }}>
                Plan your Santa run with intuitive drag-and-drop waypoints. 
                Optimize routes through your community with Mapbox navigation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card-hover" style={{
              backgroundColor: 'white',
              padding: '2.5rem',
              borderRadius: 'var(--border-radius)',
              boxShadow: 'var(--ui-shadow-soft)',
              textAlign: 'center',
              border: '3px solid var(--christmas-green)',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '1rem' }}>📍</div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                color: 'var(--christmas-green)',
                marginBottom: '1rem',
              }}>
                Real-Time Tracking
              </h3>
              <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6 }}>
                Families track Santa live with a shareable link. Watch the magic 
                unfold on a beautifully styled candy cane route.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card-hover" style={{
              backgroundColor: 'white',
              padding: '2.5rem',
              borderRadius: 'var(--border-radius)',
              boxShadow: 'var(--ui-shadow-soft)',
              textAlign: 'center',
              border: '3px solid var(--gold-accent)',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🧭</div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                color: 'var(--gold-accent)',
                marginBottom: '1rem',
              }}>
                Turn-by-Turn Navigation
              </h3>
              <p style={{ color: 'var(--neutral-700)', lineHeight: 1.6 }}>
                Professional navigation with voice guidance. Never miss a stop 
                as you spread holiday cheer through the community.
              </p>
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

        {/* CTA Section */}
        <section style={{
          background: 'linear-gradient(135deg, var(--gumtree-green) 0%, var(--christmas-green) 100%)',
          color: 'white',
          padding: '4rem 2rem',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-fun)',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            marginBottom: '1rem',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          }}>
            Ready to Spread Holiday Cheer?
          </h2>
          <p style={{
            fontSize: '1.25rem',
            marginBottom: '2.5rem',
            opacity: 0.95,
          }}>
            Join fire brigades across Australia using Fire Santa Run
          </p>
          <a
            href="/login"
            style={{
              padding: '1.25rem 3rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--christmas-green)',
              backgroundColor: 'white',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              textDecoration: 'none',
              display: 'inline-block',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
            }}
          >
            🎅 Get Started Now
          </a>
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
