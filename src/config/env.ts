/**
 * Centralised client-side environment validation.
 *
 * `import.meta.env.*` is read across many modules; this is the single place
 * that asserts the required variables are present and sane for the current
 * mode. Call `validateClientEnv()` once at startup (see src/main.tsx).
 *
 * Behaviour:
 * - Development mode (VITE_DEV_MODE=true): never throws — missing optional
 *   config is logged as a warning so local dev stays zero-config.
 * - Production mode (VITE_DEV_MODE!='true'): throws a single
 *   `EnvironmentConfigError` aggregating every problem, so the app fails fast
 *   with one clear message instead of scattered runtime failures.
 */

import { initializeMsalConfig } from '../auth/msalConfig';
import { EXAMPLE_MAPBOX_TOKEN } from './mapbox';

/** Aggregated, human-readable configuration error. */
export class EnvironmentConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `Invalid environment configuration:\n${problems
        .map((p) => `  • ${p}`)
        .join('\n')}\n\nSee .env.example and docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md.`,
    );
    this.name = 'EnvironmentConfigError';
    this.problems = problems;
  }
}

/** True when the app is running in production (auth + real backend) mode. */
export function isProductionMode(): boolean {
  return import.meta.env.VITE_DEV_MODE !== 'true';
}

function checkMapboxToken(problems: string[], isProd: boolean): void {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  if (!token || token === EXAMPLE_MAPBOX_TOKEN) {
    const message =
      'VITE_MAPBOX_TOKEN is missing or set to the example placeholder — maps, geocoding and directions will not work.';
    if (isProd) {
      problems.push(message);
    } else {
      console.warn(`[env] ${message} (dev mode: continuing with placeholder)`);
    }
    return;
  }

  if (!token.startsWith('pk.')) {
    problems.push(
      'VITE_MAPBOX_TOKEN does not look like a public token (it should start with "pk."). Do not use a secret "sk." token in the browser.',
    );
  }
}

function checkEntraConfig(problems: string[]): void {
  // initializeMsalConfig() validates Entra vars and throws a descriptive error
  // in production mode; in dev mode it is a no-op aside from logging.
  try {
    initializeMsalConfig();
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Validate the client environment. Throws `EnvironmentConfigError` in
 * production mode when required configuration is missing or invalid.
 */
export function validateClientEnv(): void {
  const isProd = isProductionMode();
  const problems: string[] = [];

  checkMapboxToken(problems, isProd);
  checkEntraConfig(problems);

  if (problems.length > 0) {
    throw new EnvironmentConfigError(problems);
  }

  if (import.meta.env.DEV) {
    console.info(
      `[env] Configuration validated (mode: ${isProd ? 'production' : 'development'}).`,
    );
  }
}
