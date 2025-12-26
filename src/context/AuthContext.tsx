/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest, isMsalConfigured } from '../auth/msalConfig';
import { refreshToken } from '../auth/tokenManager';
import { logLogin, logLogout, logLoginFailed } from '../utils/auditLog';

export interface User {
  id: string;        // User ID (from Entra or generated in dev mode)
  email: string;
  name?: string;
  brigadeId?: string; // Default/current brigade ID (for backwards compatibility)
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Authentication context with development mode support and MSAL integration.
 * 
 * In dev mode (VITE_DEV_MODE=true):
 * - Automatically provides a mock authenticated user
 * - No actual authentication required
 * - Instant access to all features
 * 
 * In production mode (VITE_DEV_MODE=false):
 * - Requires Microsoft Entra External ID authentication
 * - Full security controls and domain validation
 * - Uses MSAL for authentication flows
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const [isLoading, setIsLoading] = useState(!isDevMode);
  const [user, setUser] = useState<User | null>(null);
  
  // MSAL hooks (only used in production mode)
  const { instance, accounts, inProgress } = useMsal();

  useEffect(() => {
    const initializeAuth = async () => {
      if (isDevMode) {
        // In dev mode, automatically provide mock user
        const mockBrigadeId = import.meta.env.VITE_MOCK_BRIGADE_ID || 'dev-brigade-1';
        setUser({
          id: 'dev-user-1',
          email: 'dev@example.com',
          name: 'Development User',
          brigadeId: mockBrigadeId,
        });
        setIsLoading(false);
      } else if (isMsalConfigured()) {
        // In production mode with MSAL configured, check for authenticated user
        if (inProgress === InteractionStatus.None) {
          if (accounts && accounts.length > 0) {
            // User is authenticated
            const account = accounts[0];
            const authenticatedUser = {
              id: account.homeAccountId, // Unique user identifier from Entra
              email: account.username,
              name: account.name || account.username,
              brigadeId: undefined, // Will be set by BrigadeContext
            };
            setUser(authenticatedUser);
            
            // Log successful login
            logLogin(authenticatedUser.id, authenticatedUser.email);
            
            // Start token refresh interval (refresh every 30 minutes)
            const refreshInterval = setInterval(async () => {
              try {
                await refreshToken(instance, account);
              } catch (error) {
                console.error('[Auth] Token refresh failed:', error);
              }
            }, 30 * 60 * 1000); // 30 minutes
            
            setIsLoading(false);
            return () => clearInterval(refreshInterval);
          } else {
            // No authenticated user
            setUser(null);
            setIsLoading(false);
          }
        } else {
          // Authentication in progress, keep loading
          setIsLoading(true);
        }
      } else {
        // Production mode but MSAL not configured
        console.warn(
          '[Auth] Production mode enabled but MSAL not configured. ' +
          'Set VITE_DEV_MODE=true for development or configure Entra External ID.'
        );
        setIsLoading(false);
        setUser(null);
      }
    };
    
    initializeAuth();
  }, [isDevMode, accounts, inProgress, instance]);

  const login = async () => {
    if (isDevMode) {
      // In dev mode, login is instant
      return Promise.resolve();
    }
    
    if (!isMsalConfigured()) {
      const error = new Error(
        'Production authentication not configured. ' +
        'Set VITE_DEV_MODE=true for development or configure Entra External ID. ' +
        'See docs/ENTRA_EXTERNAL_ID_SETUP.md for setup instructions.'
      );
      logLoginFailed('unknown', error.message);
      throw error;
    }

    try {
      setIsLoading(true);
      // Use redirect flow (recommended for SPAs)
      await instance.loginRedirect(loginRequest);
      // After redirect, user will be redirected back to the app
      // and the auth state will be updated automatically
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logLoginFailed('unknown', errorMessage);
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    if (isDevMode) {
      // In dev mode, logout does nothing
      return Promise.resolve();
    }
    
    if (!isMsalConfigured()) {
      setUser(null);
      return;
    }

    try {
      setIsLoading(true);
      
      // Log logout before clearing session
      if (user) {
        logLogout(user.id, user.email);
      }
      
      // Use redirect flow for logout
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error('[Auth] Logout failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const value: AuthContextType = {
    isAuthenticated: !!user,
    user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
