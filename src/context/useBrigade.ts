import { useContext } from 'react';
import { BrigadeContext } from './BrigadeContext';
import type { BrigadeContextType } from './BrigadeContext';

export function useBrigade(): BrigadeContextType {
  const context = useContext(BrigadeContext);
  if (!context) {
    throw new Error('useBrigade must be used within a BrigadeProvider');
  }
  return context;
}
