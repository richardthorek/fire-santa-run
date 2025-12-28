import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
      // Coverage thresholds - temporarily disabled for pre-v1.0 development
      // These will be re-enabled as hard requirements once project reaches v1.0
      // Coverage reports are still generated and tracked via Codecov
      // thresholds: {
      //   statements: 40,
      //   branches: 40,
      //   functions: 40,
      //   lines: 40,
      // },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
