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

import { STORAGE_CONNECTION_STRING, isDevMode as devModeFlag } from './storage.js';

export interface ServerConfigResult {
  isDevMode: boolean;
  fatal: string[];
  warnings: string[];
}

export function evaluateServerConfig(): ServerConfigResult {
  const devMode = devModeFlag;
  const fatal: string[] = [];
  const warnings: string[] = [];

  // storage.ts itself defaults DEV_MODE to Azurite when no explicit
  // connection string is set (see AZURITE_CONNECTION_STRING there), so
  // STORAGE_CONNECTION_STRING — not the raw env vars — is the source of
  // truth for "is storage actually configured."
  if (!STORAGE_CONNECTION_STRING) {
    const msg =
      'AZURE_STORAGE_CONNECTION_STRING is not set — data persistence will fail.';
    if (devMode) warnings.push(`${msg} (unexpected in dev mode — storage.ts should have defaulted to Azurite)`);
    else fatal.push(msg);
  }

  // Realtime tracking is now served in-process via native WebSockets (/api/ws) —
  // no managed Web PubSub. The signed-token secret for privileged WS connections
  // falls back to a hash of the storage connection string, so no extra config is
  // required; warn only if there is nothing to derive a secret from in prod.
  if (!devMode && !process.env.REALTIME_WS_SECRET && !STORAGE_CONNECTION_STRING) {
    warnings.push(
      'No REALTIME_WS_SECRET and no storage connection string — realtime WS token signing will use an insecure fallback.',
    );
  }

  // Production auth: every request is validated by calling SUITE_AUTH_URL
  // (validateToken() in utils/auth.ts trusts whatever that host's /api/auth/me
  // returns as the caller's identity, org, role, and entitlement) — a
  // misdirected value is a full auth bypass. Fail fast on anything that isn't
  // a well-formed https:// URL; warn (don't fail) if it doesn't look like the
  // expected stationkit.com.au host, since a deliberate non-default value
  // (e.g. a staging Station Manager instance) is a legitimate configuration.
  if (!devMode) {
    const suiteAuthUrl = (process.env.SUITE_AUTH_URL || 'https://stationkit.com.au').trim();
    try {
      const parsed = new URL(suiteAuthUrl);
      if (parsed.protocol !== 'https:') {
        fatal.push(
          `SUITE_AUTH_URL must be an https:// URL — got "${suiteAuthUrl}". Every request's identity, ` +
            'organisation, and entitlement come from whatever this host returns.',
        );
      } else if (!/(^|\.)stationkit\.com\.au$/.test(parsed.hostname)) {
        warnings.push(
          `SUITE_AUTH_URL ("${suiteAuthUrl}") does not look like a stationkit.com.au host — confirm ` +
            'this is deliberate. Every request is authenticated against whatever this URL returns.',
        );
      }
    } catch {
      fatal.push(`SUITE_AUTH_URL is not a valid URL: "${suiteAuthUrl}". Every request is authenticated against this host.`);
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

    // Ops alert email (utils/opsAlert.ts) is optional: with any of these
    // three unset, alerts are logged only, not emailed — never fatal. But a
    // partial set is always a mistake.
    const opsAlertVars = ['AZURE_COMMUNICATION_CONNECTION_STRING', 'EMAIL_FROM_ADDRESS', 'OPS_ALERT_EMAIL'];
    const opsAlertSet = opsAlertVars.filter((v) => process.env[v]);
    if (opsAlertSet.length > 0 && opsAlertSet.length < opsAlertVars.length) {
      const missing = opsAlertVars.filter((v) => !process.env[v]);
      warnings.push(
        `Ops alert email partially configured — missing ${missing.join(', ')}; alerts will be logged only. ` +
          'See infra/.env.example.',
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
