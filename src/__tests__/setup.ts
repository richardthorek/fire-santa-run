/**
 * Vitest setup file
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock as Storage;

// Mock environment variables for tests
vi.stubEnv('VITE_DEV_MODE', 'true');
vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token');
