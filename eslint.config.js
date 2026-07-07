import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'api/dist', 'server/dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow unused vars that start with underscore (intentionally unused parameters)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // --- Deferred: rules newly promoted to "recommended" by the June 2026 ---
      // dependency consolidation (ESLint 9→10 and eslint-plugin-react-hooks
      // 7.0→7.1). They flag a pre-existing baseline across ~13 files and are
      // unrelated to the dependency upgrades themselves. They are kept as
      // warnings (still visible in lint output) rather than blocking errors so
      // this consolidation stays focused; a dedicated lint-cleanup pass is
      // tracked in MASTER_PLAN.md §29.
      //
      // ESLint 10 core additions:
      'preserve-caught-error': 'warn',
      'no-useless-assignment': 'warn',
      // eslint-plugin-react-hooks 7.1 React Compiler diagnostics:
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
])
