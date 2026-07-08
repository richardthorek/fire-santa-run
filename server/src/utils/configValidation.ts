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

  if (!storageConn) {
    const msg =
      'AZURE_STORAGE_CONNECTION_STRING is not set — data persistence will fail.';
    if (devMode) warnings.push(`${msg} (dev mode: localStorage path may be used by the client)`);
    else fatal.push(msg);
  }

  // Realtime tracking is now served in-process via native WebSockets (/api/ws) —
  // no managed Web PubSub. The signed-token secret for privileged WS connections
  // falls back to a hash of the storage connection string, so no extra config is
  // required; warn only if there is nothing to derive a secret from in prod.
  if (!devMode && !process.env.REALTIME_WS_SECRET && !storageConn) {
    warnings.push(
      'No REALTIME_WS_SECRET and no storage connection string — realtime WS token signing will use an insecure fallback.',
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

    // Web Push is optional: with no VAPID keys the notify-me UI hides itself.
    // But HALF a key pair is always a mistake — flag it.
    const vapidVars = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
    const vapidSet = vapidVars.filter((v) => process.env[v]);
    if (vapidSet.length === 1) {
      const missing = vapidVars.filter((v) => !process.env[v]);
      warnings.push(
        `Web Push partially configured — missing ${missing.join(', ')}; ` +
          'generate a pair with `npx web-push generate-vapid-keys`.',
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
