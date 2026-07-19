/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { storageAdapter, type Brigade } from '../storage';
import { useAuth } from './useAuth';

export interface BrigadeContextType {
  brigade: Brigade | null;
  isLoading: boolean;
  /**
   * Whether the organisation has Fire Santa Run enabled (mirrors
   * `useAuth().santaRunEnabled` — Fire Santa Run has no billing of its own).
   */
  isEntitled: boolean;
  /** Re-fetch the brigade record (e.g. after switching organisations). */
  refreshBrigade: () => Promise<void>;
}

export const BrigadeContext = createContext<BrigadeContextType | null>(null);

/**
 * Brigade context: provides the current brigade's data.
 *
 * A brigade is 1:1 with a Station Manager Organization — `user.brigadeId`
 * (from AuthContext) IS the organizationId. This auto-provisions the brigade
 * row the first time a Santa-entitled StationKit organisation opens the app
 * (there's no separate "claiming" step any more — see suite-token-validation.md
 * in the Station-Manager repo).
 */
export function BrigadeProvider({ children }: { children: ReactNode }) {
  const { user, organizationName, santaRunEnabled } = useAuth();
  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBrigade = useCallback(async () => {
    if (!user?.brigadeId) {
      setBrigade(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const brigadeId = user.brigadeId;
      let brigadeData = await storageAdapter.getBrigade(brigadeId);

      if (!brigadeData) {
        const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
        const now = new Date().toISOString();
        brigadeData = {
          id: brigadeId,
          slug: brigadeId,
          name: organizationName || (isDevMode ? (import.meta.env.VITE_MOCK_BRIGADE_NAME || 'Development Fire Brigade') : 'My Brigade'),
          location: '',
          createdAt: now,
          updatedAt: now,
        };
        await storageAdapter.saveBrigade(brigadeData);
      }

      setBrigade(brigadeData);
    } catch (error) {
      console.error('Failed to load brigade:', error);
      setBrigade(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.brigadeId, organizationName]);

  useEffect(() => {
    loadBrigade();
  }, [loadBrigade]);

  const value: BrigadeContextType = {
    brigade,
    isLoading,
    isEntitled: santaRunEnabled,
    refreshBrigade: loadBrigade,
  };

  return <BrigadeContext.Provider value={value}>{children}</BrigadeContext.Provider>;
}
