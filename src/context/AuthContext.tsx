/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
  email: string;
  name?: string;
  brigadeId: string;
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
 * Authentication context with development mode support.
 * 
 * In dev mode (VITE_DEV_MODE=true):
 * - Automatically provides a mock authenticated user
 * - No actual authentication required
 * - Instant access to all features
 * 
 * In production mode (VITE_DEV_MODE=false):
 * - Requires Microsoft Entra External ID authentication
 * - Full security controls and domain validation
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const [isLoading, setIsLoading] = useState(!isDevMode);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const initializeAuth = () => {
      if (isDevMode) {
        // In dev mode, automatically provide mock user
        const mockBrigadeId = import.meta.env.VITE_MOCK_BRIGADE_ID || 'dev-brigade-1';
        setUser({
          email: 'dev@example.com',
          name: 'Development User',
          brigadeId: mockBrigadeId,
        });
        setIsLoading(false);
      } else {
        // In production, check for existing session
        // TODO: Implement MSAL authentication in Phase 7
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, [isDevMode]);

  const login = async () => {
    if (isDevMode) {
      // In dev mode, login is instant
      return Promise.resolve();
    }
    
    // TODO: Implement MSAL login flow in Phase 7
    throw new Error('Production authentication not yet implemented. Set VITE_DEV_MODE=true for development.');
  };

  const logout = async () => {
    if (isDevMode) {
      // In dev mode, logout does nothing
      return Promise.resolve();
    }
    
    // TODO: Implement MSAL logout flow in Phase 7
    setUser(null);
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
