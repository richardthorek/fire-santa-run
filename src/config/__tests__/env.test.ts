import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateClientEnv, EnvironmentConfigError, isProductionMode } from '../env';
import { EXAMPLE_MAPBOX_TOKEN } from '../mapbox';

/**
 * The global test setup stubs VITE_DEV_MODE=true and VITE_MAPBOX_TOKEN=test-token.
 * Each test stubs the env it needs and restores afterwards.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isProductionMode', () => {
  it('is false when VITE_DEV_MODE=true', () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    expect(isProductionMode()).toBe(false);
  });

  it('is true when VITE_DEV_MODE is not "true"', () => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    expect(isProductionMode()).toBe(true);
  });
});

describe('validateClientEnv (development mode)', () => {
  it('does not throw even with a placeholder Mapbox token', () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    vi.stubEnv('VITE_MAPBOX_TOKEN', EXAMPLE_MAPBOX_TOKEN);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateClientEnv()).not.toThrow();
  });
});

describe('validateClientEnv (production mode)', () => {
  it('throws an aggregated error listing every missing/invalid var', () => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    vi.stubEnv('VITE_MAPBOX_TOKEN', EXAMPLE_MAPBOX_TOKEN); // placeholder => invalid
    vi.stubEnv('VITE_ENTRA_CLIENT_ID', '');
    vi.stubEnv('VITE_ENTRA_TENANT_ID', '');
    vi.stubEnv('VITE_ENTRA_AUTHORITY', '');

    let caught: unknown;
    try {
      validateClientEnv();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvironmentConfigError);
    const err = caught as EnvironmentConfigError;
    // One Mapbox problem + at least one Entra problem.
    expect(err.problems.length).toBeGreaterThanOrEqual(2);
    expect(err.problems.some((p) => p.includes('VITE_MAPBOX_TOKEN'))).toBe(true);
    expect(err.problems.some((p) => p.toLowerCase().includes('entra'))).toBe(true);
  });

  it('rejects a secret ("sk.") Mapbox token in the browser', () => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'sk.this_is_a_secret_token');
    // Provide valid Entra config so only the Mapbox problem remains.
    vi.stubEnv('VITE_ENTRA_CLIENT_ID', 'client-123');
    vi.stubEnv('VITE_ENTRA_TENANT_ID', 'tenant-123');
    vi.stubEnv(
      'VITE_ENTRA_AUTHORITY',
      'https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8',
    );
    vi.stubEnv('VITE_ENTRA_REDIRECT_URI', 'https://example.com/auth/callback');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => validateClientEnv()).toThrow(EnvironmentConfigError);
  });

  it('passes when Mapbox and Entra are correctly configured', () => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.a_valid_public_token');
    vi.stubEnv('VITE_ENTRA_CLIENT_ID', 'client-123');
    vi.stubEnv('VITE_ENTRA_TENANT_ID', 'tenant-123');
    vi.stubEnv(
      'VITE_ENTRA_AUTHORITY',
      'https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8',
    );
    vi.stubEnv('VITE_ENTRA_REDIRECT_URI', 'https://example.com/auth/callback');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => validateClientEnv()).not.toThrow();
  });
});
