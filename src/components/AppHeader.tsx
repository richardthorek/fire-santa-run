/**
 * AppHeader component
 * 
 * Application header with user profile menu and navigation controls.
 * Provides access to profile settings, brigade management, and logout.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useBrigade } from '../context';
import { COLORS } from '../utils/constants';

export interface AppHeaderProps {
  /**
   * Whether to show the header (can be hidden on specific pages like tracking view)
   */
  show?: boolean;
}

export function AppHeader({ show = true }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const { brigade } = useBrigade();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  if (!show || !user) {
    return null;
  }

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'white',
        borderBottom: `2px solid ${COLORS.neutral200}`,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Logo / Brand */}
        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: COLORS.fireRed,
            fontWeight: 700,
            fontSize: '1.25rem',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>🎅</span>
          <span className="brand-text">
            Fire Santa Run
          </span>
        </Link>

        {/* User Profile Menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.neutral300}`,
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.neutral50;
              e.currentTarget.style.borderColor = COLORS.fireRed;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = COLORS.neutral300;
            }}
          >
            {/* User Avatar Circle */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            
            {/* User Name (hide on mobile) */}
            <span className="user-name" style={{ color: COLORS.neutral900 }}>
              {user.name || user.email.split('@')[0]}
            </span>
            
            {/* Dropdown Arrow */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                right: 0,
                minWidth: '240px',
                backgroundColor: 'white',
                border: `1px solid ${COLORS.neutral200}`,
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden',
                zIndex: 1001,
              }}
            >
              {/* User Info Section */}
              <div
                style={{
                  padding: '1rem',
                  borderBottom: `1px solid ${COLORS.neutral200}`,
                  backgroundColor: COLORS.neutral50,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: COLORS.neutral900,
                    marginBottom: '0.25rem',
                  }}
                >
                  {user.name || 'User'}
                </div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: COLORS.neutral700,
                    marginBottom: '0.5rem',
                  }}
                >
                  {user.email}
                </div>
                {brigade && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: COLORS.neutral700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <span>🚒</span>
                    <span>{brigade.name}</span>
                  </div>
                )}
              </div>

              {/* Menu Items */}
              <div style={{ padding: '0.5rem' }}>
                <MenuLink
                  to="/profile"
                  icon="👤"
                  label="Your Profile"
                  onClick={() => setMenuOpen(false)}
                />
                <MenuLink
                  to="/dashboard"
                  icon="📊"
                  label="Dashboard"
                  onClick={() => setMenuOpen(false)}
                />
                {brigade && (
                  <MenuLink
                    to={`/dashboard/${brigade.id}/members`}
                    icon="👥"
                    label="Manage Members"
                    onClick={() => setMenuOpen(false)}
                  />
                )}
                <MenuLink
                  to="/brigades/claim"
                  icon="🚒"
                  label={brigade ? 'Switch Brigade' : 'Claim Brigade'}
                  onClick={() => setMenuOpen(false)}
                />
              </div>

              {/* Logout Section */}
              <div
                style={{
                  padding: '0.5rem',
                  borderTop: `1px solid ${COLORS.neutral200}`,
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: COLORS.fireRed,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = COLORS.neutral100;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Helper component for menu links
interface MenuLinkProps {
  to: string;
  icon: string;
  label: string;
  onClick?: () => void;
}

function MenuLink({ to, icon, label, onClick }: MenuLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        borderRadius: '8px',
        textDecoration: 'none',
        color: COLORS.neutral900,
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = COLORS.neutral100;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      <span style={{ fontWeight: 500 }}>{label}</span>
    </Link>
  );
}
