import { useState, useEffect } from 'react';
import { useAuth } from '../../context';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../utils/constants';

/**
 * Logout Page
 * 
 * Handles user logout and shows confirmation message.
 * Automatically logs out in dev mode.
 * In production mode, redirects to Entra logout.
 */
export function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  // In dev mode, auto-complete logout immediately
  const [logoutComplete, setLogoutComplete] = useState(isDevMode);

  useEffect(() => {
    // In dev mode, auto-redirect after showing message
    if (isDevMode) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isDevMode, navigate]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      await logout();
      setLogoutComplete(true);
      
      // In production mode, MSAL will handle the redirect
      // In dev mode, redirect to landing page after a short delay
      if (isDevMode) {
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  if (isLoggingOut || logoutComplete) {
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
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>
          {logoutComplete ? '👋' : '🎅'}
        </div>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: COLORS.neutral900,
          marginBottom: '0.5rem',
        }}>
          {logoutComplete ? 'Logged Out Successfully' : 'Logging Out...'}
        </h1>
        <p style={{
          fontSize: '1rem',
          color: COLORS.neutral700,
        }}>
          {logoutComplete ? 'Redirecting to login page...' : 'Please wait...'}
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
      {/* Logout Confirmation Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        padding: '2.5rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🚪</div>
        
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: COLORS.neutral900,
          marginBottom: '0.5rem',
        }}>
          Sign Out?
        </h1>
        
        <p style={{
          fontSize: '1rem',
          color: COLORS.neutral700,
          marginBottom: '2rem',
        }}>
          Are you sure you want to sign out? You'll need to sign in again to access your brigade dashboard.
        </p>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '2rem',
        }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1,
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.neutral800,
              backgroundColor: COLORS.neutral100,
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.neutral200;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.neutral100;
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              flex: 1,
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'white',
              background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Sign Out
          </button>
        </div>

        {isDevMode && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: COLORS.summerGoldLight + '40',
            borderRadius: '8px',
          }}>
            <p style={{
              fontSize: '0.75rem',
              color: COLORS.neutral800,
              margin: 0,
            }}>
              🛠️ Development Mode: Logout is simulated
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
