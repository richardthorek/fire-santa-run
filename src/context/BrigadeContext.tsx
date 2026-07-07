/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { storageAdapter, type Brigade } from '../storage';
import { useAuth } from './useAuth';
import { isBrigadeEntitledForUi } from '../utils/subscription';

export interface BrigadeContextType {
  brigade: Brigade | null;
  isLoading: boolean;
  /** Whether the brigade may use paid features (planning + broadcasting). */
  isEntitled: boolean;
  /** Re-fetch the brigade record (e.g. after returning from Stripe checkout). */
  refreshBrigade: () => Promise<void>;
}

export const BrigadeContext = createContext<BrigadeContextType | null>(null);

/**
 * Brigade context that provides the current brigade's data.
 * Automatically loads brigade based on the authenticated user's brigadeId.
 */
export function BrigadeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBrigade = useCallback(async () => {
    if (!user || !user.brigadeId) {
      setBrigade(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let brigadeData = await storageAdapter.getBrigade(user.brigadeId);

      // If brigade doesn't exist in storage, create it (dev mode scenario)
      if (!brigadeData) {
        const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
        if (isDevMode) {
          const mockBrigadeName = import.meta.env.VITE_MOCK_BRIGADE_NAME || 'Development Fire Brigade';
          brigadeData = {
            id: user.brigadeId,
            slug: user.brigadeId,
            name: mockBrigadeName,
            location: 'Development Location',
            allowedDomains: [],
            allowedEmails: [],
            requireManualApproval: false,
            adminUserIds: [user.id],
            isClaimed: true,
            claimedAt: new Date().toISOString(),
            claimedBy: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await storageAdapter.saveBrigade(brigadeData);
        }
      }

      setBrigade(brigadeData);
    } catch (error) {
      console.error('Failed to load brigade:', error);
      setBrigade(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBrigade();
  }, [loadBrigade]);

  const value: BrigadeContextType = {
    brigade,
    isLoading,
    isEntitled: isBrigadeEntitledForUi(brigade),
    refreshBrigade: loadBrigade,
  };

  return <BrigadeContext.Provider value={value}>{children}</BrigadeContext.Provider>;
}
