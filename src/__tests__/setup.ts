/**
 * Vitest setup file
 * Runs before all tests
 */

import { vi } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect } from 'vitest';

// Extend Vitest matchers with axe accessibility matchers
expect.extend(toHaveNoViolations);

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
