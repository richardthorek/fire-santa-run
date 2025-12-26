/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode } from 'react';
import { storageAdapter, type Brigade } from '../storage';
import { useAuth } from './useAuth';

export interface BrigadeContextType {
  brigade: Brigade | null;
  isLoading: boolean;
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

  useEffect(() => {
    const loadBrigade = async () => {
      if (!user) {
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
              adminUserIds: ['dev-user-1'],
              isClaimed: true,
              claimedAt: new Date().toISOString(),
              claimedBy: 'dev-user-1',
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
    };

    loadBrigade();
  }, [user]);

  const value: BrigadeContextType = {
    brigade,
    isLoading,
  };

  return <BrigadeContext.Provider value={value}>{children}</BrigadeContext.Provider>;
}
