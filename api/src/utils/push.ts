/**
 * Web Push for "notify me when Santa starts" — Functions (local dev) twin of
 * server/src/utils/push.ts. Keep the two in sync.
 *
 * Configured via VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT — when
 * unset the endpoints report unconfigured and the client hides the UI.
 */

import webpush from 'web-push';
import { createHash } from 'node:crypto';
import { getTableClient, isDevMode } from './storage';

const PUSH_TABLE = isDevMode ? 'dev-pushsubscriptions' : 'pushsubscriptions';
const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';
/** RowKey for the per-route metadata entity (start-notification marker). */
const META_ROW_KEY = '!meta';
/** Re-notify guard: one start push per route per this window. */
const NOTIFY_WINDOW_MS = 12 * 60 * 60 * 1000;

let vapidConfigured = false;

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@firesantarun.com.au',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    vapidConfigured = true;
  }
  return true;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Stable row key for an endpoint URL (endpoints exceed key length limits). */
export function endpointRowKey(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

export async function saveSubscription(routeId: string, sub: StoredSubscription): Promise<void> {
  const client = await getTableClient(PUSH_TABLE);
  await client.upsertEntity(
    {
      partitionKey: routeId,
      rowKey: endpointRowKey(sub.endpoint),
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      createdAt: new Date().toISOString(),
    },
    'Replace',
  );
}

export async function deleteSubscription(routeId: string, endpoint: string): Promise<void> {
  const client = await getTableClient(PUSH_TABLE);
  try {
    await client.deleteEntity(routeId, endpointRowKey(endpoint));
  } catch {
    // Already gone — fine.
  }
}

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

export async function routeExists(routeId: string): Promise<boolean> {
  const client = await getTableClient(ROUTES_TABLE);
  const entities = client.listEntities({
    queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` },
  });
  for await (const _ of entities) {
    void _;
    return true;
  }
  return false;
}

/** Best-effort route name for the notification body. */
async function getRouteName(routeId: string): Promise<string | null> {
  try {
    const client = await getTableClient(ROUTES_TABLE);
    const entities = client.listEntities({
      queryOptions: { filter: `RowKey eq '${escapeODataValue(routeId)}'` },
    });
    for await (const entity of entities) {
      return typeof entity.name === 'string' ? entity.name : null;
    }
  } catch {
    // Name is decorative — never fail the notification on it.
  }
  return null;
}

/**
 * Send the "Santa has started" push to every subscriber of a route, at most
 * once per NOTIFY_WINDOW_MS. Fire-and-forget from the broadcast path.
 */
export async function notifyRunStartOnce(routeId: string, appBaseUrl: string): Promise<void> {
  try {
    if (!ensureVapid()) return;
    const client = await getTableClient(PUSH_TABLE);

    try {
      const meta = await client.getEntity(routeId, META_ROW_KEY);
      const last = typeof meta.startNotifiedAt === 'string' ? Date.parse(meta.startNotifiedAt) : NaN;
      if (!Number.isNaN(last) && Date.now() - last < NOTIFY_WINDOW_MS) return;
    } catch {
      // No marker yet — first broadcast for this route.
    }

    // Claim the marker BEFORE sending so concurrent broadcasts don't double-send.
    await client.upsertEntity(
      { partitionKey: routeId, rowKey: META_ROW_KEY, startNotifiedAt: new Date().toISOString() },
      'Replace',
    );

    const routeName = await getRouteName(routeId);
    const payload = JSON.stringify({
      title: '🎅 Santa is on the way!',
      body: routeName ? `${routeName} has started — tap to watch live.` : 'Your Santa run has started — tap to watch live.',
      url: `${appBaseUrl}/track/${routeId}`,
    });

    const subs = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escapeODataValue(routeId)}'` },
    });
    const sends: Promise<void>[] = [];
    for await (const entity of subs) {
      if (entity.rowKey === META_ROW_KEY) continue;
      const endpoint = entity.endpoint as string;
      const subscription = {
        endpoint,
        keys: { p256dh: entity.p256dh as string, auth: entity.auth as string },
      };
      sends.push(
        webpush.sendNotification(subscription, payload).then(
          () => undefined,
          (err: { statusCode?: number }) => {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              return deleteSubscription(routeId, endpoint);
            }
          },
        ),
      );
    }
    await Promise.allSettled(sends);
  } catch (error) {
    console.error('notifyRunStartOnce failed (non-fatal):', error);
  }
}
