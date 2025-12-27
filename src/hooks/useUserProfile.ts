/**
 * Custom hook for user profile management.
 * Handles post-authentication user profile creation and updates.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context';
import { storageAdapter } from '../storage';
import { logAuditEvent } from '../utils/auditLog';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';

interface UseUserProfileResult {
  user: User | null;
  memberships: BrigadeMembership[];
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

/**
 * Hook for managing user profile data.
 * Automatically creates user record on first login and fetches memberships.
 */
export function useUserProfile(): UseUserProfileResult {
  const { user: authUser, isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<BrigadeMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const previousMembershipsRef = useRef<string>('[]');

  const refreshProfile = useCallback(async () => {
    if (!authUser || !isAuthenticated) {
      setUser(null);
      setMemberships([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get existing user from database
      let dbUser = await storageAdapter.getUserByEmail(authUser.email);

      if (!dbUser) {
        // First login - create user profile
        dbUser = {
          id: authUser.id,
          email: authUser.email,
          name: authUser.name || authUser.email.split('@')[0],
          entraUserId: authUser.id,
          emailVerified: true, // Entra-authenticated users are verified
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        await storageAdapter.saveUser(dbUser);
        
        // Log user creation
        logAuditEvent('user.created', `User created: ${dbUser.email}`, {
          userId: dbUser.id,
          userEmail: dbUser.email,
        });
      } else {
        // Update last login time
        dbUser.lastLoginAt = new Date().toISOString();
        await storageAdapter.saveUser(dbUser);
      }

      setUser(dbUser);

      // Fetch user's brigade memberships
      const userMemberships = await storageAdapter.getMembershipsByUser(dbUser.id);
      
      // Only update memberships state if the data actually changed
      // This prevents unnecessary re-renders in components that depend on memberships
      // Note: Using JSON.stringify for deep equality is acceptable here because:
      // - Membership arrays are typically small (1-3 items per user)
      // - This runs only on profile refresh, not every render
      // - Prevents infinite loops from unstable array references
      const currentMembershipsJson = JSON.stringify(userMemberships);
      if (currentMembershipsJson !== previousMembershipsRef.current) {
        previousMembershipsRef.current = currentMembershipsJson;
        setMemberships(userMemberships);
      }
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
      if (import.meta.env.DEV) {
        console.debug('updateProfile called', { updates, currentUser: user });
      }

      const updatedUser = {
        ...user,
        ...updates,
      };
      // Avoid unnecessary round-trip if nothing actually changed
      const keys = Object.keys(updates) as (keyof User)[];
      const hasChange = keys.some((k) => {
        return updates[k] !== undefined && updatedUser[k] !== user[k];
      });

      if (!hasChange) {
        if (import.meta.env.DEV) {
          console.debug('updateProfile noop: no changes detected');
        }
        return;
      }

      await storageAdapter.saveUser(updatedUser);
      setUser(updatedUser);

      // Log profile update
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

  // Load profile on mount and when auth state changes
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return {
    user,
    memberships,
    isLoading,
    error,
    refreshProfile,
    updateProfile,
  };
}
