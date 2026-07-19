/**
 * Custom hook for user profile management.
 * Handles post-authentication local profile creation and updates — the
 * account itself (identity, org membership, role) lives in Station Manager;
 * this hook manages Santa Run's own local profile fields (currently just an
 * avatar) keyed by the same user id.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context';
import { storageAdapter } from '../storage';
import { logAuditEvent } from '../utils/auditLog';
import type { User } from '../types/user';

interface UseUserProfileResult {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

/**
 * Hook for managing user profile data.
 * Automatically creates the local user record on first login.
 */
export function useUserProfile(): UseUserProfileResult {
  const { user: authUser, isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refreshProfile = useCallback(async () => {
    if (!authUser || !isAuthenticated) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let dbUser = await storageAdapter.getUserByEmail(authUser.email);

      if (!dbUser) {
        // First login - create local profile
        dbUser = {
          id: authUser.id,
          email: authUser.email,
          name: authUser.name || authUser.email.split('@')[0],
          emailVerified: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        await storageAdapter.saveUser(dbUser);

        logAuditEvent('user.created', `User created: ${dbUser.email}`, {
          userId: dbUser.id,
          userEmail: dbUser.email,
        });
      } else {
        dbUser.lastLoginAt = new Date().toISOString();
        await storageAdapter.saveUser(dbUser);
      }

      setUser(dbUser);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      // Detect common SPA fallback where API returns index.html (HTML starts with '<!doctype')
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('<!doctype') || msg.includes('<html')) {
        setError('Failed to load profile: server returned HTML (possible auth redirect). Please ensure the API is accessible and you are authenticated.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [authUser, isAuthenticated]);

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) {
      throw new Error('No user to update');
    }

    if (inFlightRef.current) {
      if (import.meta.env.DEV) {
        console.debug('updateProfile: another update in-flight, skipping');
      }
      return;
    }

    inFlightRef.current = true;
    try {
      const updatedUser = {
        ...user,
        ...updates,
      };
      const keys = Object.keys(updates) as (keyof User)[];
      const hasChange = keys.some((k) => {
        return updates[k] !== undefined && updatedUser[k] !== user[k];
      });

      if (!hasChange) {
        return;
      }

      await storageAdapter.saveUser(updatedUser);
      setUser(updatedUser);

      logAuditEvent('user.updated', `User profile updated: ${user.email}`, {
        userId: user.id,
        userEmail: user.email,
        metadata: { updatedFields: Object.keys(updates) },
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return {
    user,
    isLoading,
    error,
    refreshProfile,
    updateProfile,
  };
}
