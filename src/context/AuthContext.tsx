/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  restoreSession,
  signIn as suiteSignIn,
  signInWithPasskey as suiteSignInWithPasskey,
  signUp as suiteSignUp,
  signOut as suiteSignOut,
  switchOrg as suiteSwitchOrg,
  type SuiteSession,
  type SuiteMembership,
  type SignUpInput,
} from '../auth/suiteAuth';
import { logLogin, logLogout, logLoginFailed } from '../utils/auditLog';

export interface User {
  /** Station Manager user id. */
  id: string;
  email: string;
  name: string;
  /**
   * The active brigade — 1:1 with the user's current Station Manager
   * organizationId. Named `brigadeId` (this app's own domain vocabulary)
   * throughout the rest of the codebase.
   */
  brigadeId?: string;
  role?: 'owner' | 'admin' | 'viewer';
}

export type AuthMembership = SuiteMembership;

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  /** Whether the active brigade's Station Manager org grants Fire Santa Run. */
  santaRunEnabled: boolean;
  organizationName: string | null;
  planCode: string | null;
  /** Every StationKit organisation this user belongs to (multi-brigade membership). */
  memberships: AuthMembership[];
  login: (email: string, password: string) => Promise<void>;
  /** Sign in with a passkey — no username needed, the browser's own picker shows every passkey it holds. */
  loginWithPasskey: () => Promise<void>;
  signup: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Switch the active brigade for a multi-brigade member; reissues the session. */
  switchBrigade: (organizationId: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

function sessionToUser(session: SuiteSession): User {
  return {
    id: session.userId,
    email: session.email,
    name: session.email,
    brigadeId: session.organizationId,
    role: session.role,
  };
}

/**
 * Authentication context backed by Station Manager (the StationKit suite
 * identity provider) — replaces the previous Microsoft Entra External ID
 * integration.
 *
 * In dev mode (VITE_DEV_MODE=true):
 * - Automatically provides a mock authenticated user
 * - No actual authentication required
 *
 * In production mode:
 * - On load, silently resumes an existing Station Manager sign-in via the
 *   cross-subdomain SSO cookie (no redirect); falls back to a stored token.
 * - `login`/`signup` call Station Manager directly.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [santaRunEnabled, setSantaRunEnabled] = useState(false);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<AuthMembership[]>([]);

  const applySession = useCallback((session: SuiteSession) => {
    setUser(sessionToUser(session));
    setSantaRunEnabled(session.santaRunEnabled);
    setOrganizationName(session.organizationName ?? null);
    setPlanCode(session.planCode);
    setMemberships(session.memberships);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setSantaRunEnabled(false);
    setOrganizationName(null);
    setPlanCode(null);
    setMemberships([]);
  }, []);

  useEffect(() => {
    if (isDevMode) {
      const mockBrigadeId = import.meta.env.VITE_MOCK_BRIGADE_ID || 'dev-brigade-1';
      setUser({
        id: 'dev-user-1',
        email: 'dev@example.com',
        name: 'Development User',
        brigadeId: mockBrigadeId,
        role: 'admin',
      });
      setSantaRunEnabled(true);
      setOrganizationName('Development Brigade');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const session = await restoreSession();
        if (cancelled) return;
        if (session) {
          applySession(session);
          logLogin(session.userId, session.email);
        } else {
          clearSession();
        }
      } catch (error) {
        console.error('[Auth] Failed to restore session:', error);
        clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDevMode, applySession, clearSession]);

  const login = async (email: string, password: string) => {
    if (isDevMode) return;
    try {
      const session = await suiteSignIn(email, password);
      applySession(session);
      logLogin(session.userId, session.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logLoginFailed(email, message);
      throw error;
    }
  };

  const loginWithPasskey = async () => {
    if (isDevMode) return;
    const session = await suiteSignInWithPasskey();
    applySession(session);
    logLogin(session.userId, session.email);
  };

  const signup = async (input: SignUpInput) => {
    if (isDevMode) return;
    const session = await suiteSignUp(input);
    applySession(session);
    logLogin(session.userId, session.email);
  };

  const logout = async () => {
    if (isDevMode) {
      return;
    }
    if (user) {
      logLogout(user.id, user.email);
    }
    try {
      await suiteSignOut();
    } finally {
      clearSession();
    }
  };

  const switchBrigade = async (organizationId: string) => {
    if (isDevMode) return;
    const session = await suiteSwitchOrg(organizationId);
    applySession(session);
  };

  const value: AuthContextType = {
    isAuthenticated: !!user,
    user,
    isLoading,
    santaRunEnabled,
    organizationName,
    planCode,
    memberships,
    login,
    loginWithPasskey,
    signup,
    logout,
    switchBrigade,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
