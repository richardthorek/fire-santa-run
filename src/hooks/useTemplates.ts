import { useState, useEffect, useCallback } from 'react';
import { storageAdapter } from '../storage';
import type { RouteTemplate } from '../types';
import { useAuth } from '../context';
import { useUserProfile } from './useUserProfile';
import { mergeBuiltInTemplates } from '../utils/defaultTemplates';

/**
 * Custom hook for managing route templates for the current brigade.
 * Automatically seeds built-in templates on first load.
 */
export function useTemplates() {
  const { user } = useAuth();
  const { memberships } = useUserProfile();
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const activeBrigadeId = user?.brigadeId ?? memberships.find(m => m.status === 'active')?.brigadeId;

  const loadTemplates = useCallback(async () => {
    if (!activeBrigadeId) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const stored = await storageAdapter.getTemplates(activeBrigadeId);
      const merged = mergeBuiltInTemplates(stored, activeBrigadeId);

      // Persist any newly-seeded built-in templates
      const toSave = merged.filter(t => !stored.some(s => s.id === t.id));
      for (const template of toSave) {
        await storageAdapter.saveTemplate(activeBrigadeId, template);
      }

      setTemplates(merged);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load templates');
      setError(error);
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeBrigadeId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const saveTemplate = useCallback(
    async (template: RouteTemplate) => {
      if (!activeBrigadeId) {
        throw new Error('User must be authenticated with a brigade to save templates');
      }

      try {
        if (!template.brigadeId) {
          template.brigadeId = activeBrigadeId;
        }
        await storageAdapter.saveTemplate(activeBrigadeId, template);
        await loadTemplates();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to save template');
        setError(error);
        throw error;
      }
    },
    [activeBrigadeId, loadTemplates],
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!activeBrigadeId) {
        throw new Error('User must be authenticated with a brigade to delete templates');
      }

      try {
        await storageAdapter.deleteTemplate(activeBrigadeId, templateId);
        await loadTemplates();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete template');
        setError(error);
        throw error;
      }
    },
    [activeBrigadeId, loadTemplates],
  );

  return {
    templates,
    isLoading,
    error,
    saveTemplate,
    deleteTemplate,
    refreshTemplates: loadTemplates,
  };
}
