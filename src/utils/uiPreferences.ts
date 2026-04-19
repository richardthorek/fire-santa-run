/**
 * UI Preferences utility
 *
 * Lightweight, client-side-only key/value store for transient UI preferences
 * (e.g. "don't show this banner again until …"). These are intentionally
 * client-side-only settings — they must not be persisted in Azure Table Storage
 * or routed through the HTTP API, so they are deliberately separate from the
 * `IStorageAdapter` (which handles business entities).
 *
 * All access is wrapped in try/catch to handle environments where localStorage
 * is unavailable (private-browsing quotas, SSR-like environments, tests).
 */

export const uiPreferences = {
  /**
   * Read a string value. Returns `null` if not set or storage is unavailable.
   */
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Write a string value. Silently ignores errors (e.g. storage quota exceeded).
   */
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently ignore — the preference is best-effort
    }
  },

  /**
   * Remove a stored preference.
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
  },
};
