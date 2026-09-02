/**
 * Operational alerting — email via Azure Communication Services when the app
 * itself observes a condition that matters on a run night (the realtime
 * connection cap being approached, an elevated broadcast failure rate).
 *
 * Deliberately app-level rather than a generic Azure Monitor platform metric
 * alert: "connections approaching MAX_TOTAL_CONNECTIONS" and "broadcast
 * error rate" are in-process state (server/src/realtime/hub.ts,
 * server/src/routes/broadcast.ts) that a platform metric can't see at all.
 * This is a deliberate complement to, not a replacement for, platform-level
 * monitoring — a process that has crashed or can't start can't send its own
 * "I'm down" email; an Application Insights availability ping on /api/health
 * (not yet set up — see infra/README.md) is the right tool for that failure
 * mode. This one only covers "the app is running but struggling."
 *
 * Mirrors richardthorek/station-manager's backend/src/services/emailService.ts
 * (same SDK, same safe-no-op-when-unconfigured shape) — configure with
 * AZURE_COMMUNICATION_CONNECTION_STRING, EMAIL_FROM_ADDRESS, and
 * OPS_ALERT_EMAIL. Deliberately shares Station Manager's existing ACS
 * instance (already has a verified custom domain) rather than provisioning
 * a second one just for this app's occasional alert email — see
 * infra/.env.example for how to get the connection string.
 */

import { EmailClient, type EmailMessage } from '@azure/communication-email';

let client: EmailClient | null = null;
let fromAddress = '';
let toAddress = '';
let initialized = false;

function ensureInitialized(): boolean {
  if (initialized) return client !== null;
  initialized = true;

  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  const from = process.env.EMAIL_FROM_ADDRESS;
  const to = process.env.OPS_ALERT_EMAIL;

  if (!connectionString || !from || !to) {
    console.warn(
      '[opsAlert] Not configured (need AZURE_COMMUNICATION_CONNECTION_STRING, ' +
        'EMAIL_FROM_ADDRESS, OPS_ALERT_EMAIL) — alerts will be logged only.',
    );
    return false;
  }

  try {
    client = new EmailClient(connectionString);
    fromAddress = from;
    toAddress = to;
    return true;
  } catch (error) {
    console.error('[opsAlert] Failed to initialize Azure Communication Email:', error);
    client = null;
    return false;
  }
}

/** One cooldown window per alert `kind` so an ongoing incident sends one
 * email, not one per triggering request — an alert storm would itself add
 * load on the exact night it matters least to have that happen. */
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

/**
 * Fire-and-forget: send an ops alert email, debounced per `kind`. Never
 * throws and is never awaited by callers — this must not add latency or
 * failure risk to the request that triggered it (same rule as
 * utils/push.ts's notifyRunStartOnce).
 */
export function alertOps(kind: string, subject: string, details: string): void {
  const now = Date.now();
  const last = lastAlertAt.get(kind);
  if (last && now - last < ALERT_COOLDOWN_MS) return;
  lastAlertAt.set(kind, now);

  console.warn(`[opsAlert] ${kind}: ${subject} — ${details}`);

  if (!ensureInitialized() || !client) return;

  const message: EmailMessage = {
    senderAddress: fromAddress,
    content: {
      subject: `[Fire Santa Run] ${subject}`,
      plainText: `${details}\n\n(kind=${kind}, next alert of this kind suppressed for ${ALERT_COOLDOWN_MS / 60_000} minutes)`,
    },
    recipients: { to: [{ address: toAddress }] },
  };

  void (async () => {
    try {
      const poller = await client!.beginSend(message);
      const result = await poller.pollUntilDone();
      if (result.status !== 'Succeeded') {
        console.error('[opsAlert] Email send did not succeed:', result.status);
      }
    } catch (error) {
      console.error('[opsAlert] Error sending alert email:', error);
    }
  })();
}

/** Test seam: reset debounce state between tests. */
export function _resetOpsAlertState(): void {
  lastAlertAt.clear();
}
