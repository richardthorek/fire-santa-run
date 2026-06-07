/**
 * Vitest setup file
 * Runs before all tests
 */

import { vi } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect } from 'vitest';

// Extend Vitest matchers with axe accessibility matchers
expect.extend(toHaveNoViolations);

// Mock localStorage (implements the Web Storage API surface used in the app,
// including length/key(i) enumeration relied on by getBrigades()).
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
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

global.localStorage = localStorageMock as Storage;

// Mock environment variables for tests
vi.stubEnv('VITE_DEV_MODE', 'true');
vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token');
