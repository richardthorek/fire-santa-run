/**
 * Server-side environment validation.
 *
 * Asserts the backend has the configuration it needs before accepting traffic.
 * Called once at startup (see server/src/main.ts).
 *
 * - Development mode (DEV_MODE=true): logs warnings only, never exits.
 * - Production mode: a missing Storage connection string is fatal (the API is
 *   useless without it); a missing Web PubSub connection string is a loud
 *   warning (the SPA and read-only tracking can still serve, but live
 *   broadcasting will fail until it is configured).
 */

export interface ServerConfigResult {
  isDevMode: boolean;
  fatal: string[];
  warnings: string[];
}

function isDevMode(): boolean {
  return process.env.DEV_MODE === 'true';
}

export function evaluateServerConfig(): ServerConfigResult {
  const devMode = isDevMode();
  const fatal: string[] = [];
  const warnings: string[] = [];

  const storageConn =
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  const pubSubConn = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING;

  if (!storageConn) {
    const msg =
      'AZURE_STORAGE_CONNECTION_STRING is not set — data persistence will fail.';
    if (devMode) warnings.push(`${msg} (dev mode: localStorage path may be used by the client)`);
    else fatal.push(msg);
  }

  if (!pubSubConn) {
    warnings.push(
      'AZURE_WEBPUBSUB_CONNECTION_STRING is not set — real-time location broadcasting will not work.',
    );
  }

  // Production auth: the backend validates Entra tokens; warn if absent.
  if (!devMode) {
    const entraMissing = ['VITE_ENTRA_TENANT_ID', 'VITE_ENTRA_CLIENT_ID'].filter(
      (v) => !process.env[v],
    );
    if (entraMissing.length > 0) {
      warnings.push(
        `Entra config missing (${entraMissing.join(', ')}) — API token validation may reject all requests.`,
      );
    }

    // Billing is optional: without full Stripe config the /api/stripe routes
    // return 503 and the paywall cannot be enforced (brigades stay unentitled).
    const stripeVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'];
    const stripeSet = stripeVars.filter((v) => process.env[v]);
    if (stripeSet.length > 0 && stripeSet.length < stripeVars.length) {
      const missing = stripeVars.filter((v) => !process.env[v]);
      warnings.push(
        `Stripe partially configured — missing ${missing.join(', ')}; subscription checkout/webhook will not work.`,
      );
    }
  }

  return { isDevMode: devMode, fatal, warnings };
}

/**
 * Validate server configuration and log the result. In production, throws when
 * fatal configuration is missing so the process fails fast on a bad deploy.
 */
export function validateServerEnv(): void {
  const { isDevMode: devMode, fatal, warnings } = evaluateServerConfig();

  for (const warning of warnings) {
    console.warn(`[config] WARNING: ${warning}`);
  }

  if (fatal.length > 0) {
    const message =
      `[config] FATAL: invalid server configuration:\n` +
      fatal.map((f) => `  • ${f}`).join('\n');
    console.error(message);
    throw new Error(message);
  }

  console.log(
    `[config] Server configuration validated (mode: ${devMode ? 'development' : 'production'}, ${warnings.length} warning(s)).`,
  );
}
