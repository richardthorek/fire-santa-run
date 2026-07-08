/**
 * /api/push — Web Push subscriptions for "notify me when Santa starts".
 * Functions (local dev) twin of server/src/routes/push.ts — keep in sync.
 *
 * Public viewers are anonymous, so subscribe requires no auth — but it is
 * rate-limited, validates the subscription shape, and only accepts routes
 * that exist. The push itself is sent from the broadcast path on the first
 * location update of a run.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { checkRateLimit } from './rateLimit';
import {
  getVapidPublicKey,
  isPushConfigured,
  saveSubscription,
  deleteSubscription,
  routeExists,
} from './utils/push';

export async function pushPublicKey(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const publicKey = getVapidPublicKey();
  if (!publicKey || !isPushConfigured()) {
    return { status: 404, jsonBody: { error: 'Push notifications are not configured' } };
  }
  return { status: 200, jsonBody: { publicKey } };
}

export async function pushSubscribe(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const limited = checkRateLimit(request, 'push-subscribe', 10, 60_000);
    if (limited) return limited;

    if (!isPushConfigured()) {
      return { status: 404, jsonBody: { error: 'Push notifications are not configured' } };
    }

    const body = await request.json() as {
      routeId?: string;
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };

    const routeId = body.routeId;
    const sub = body.subscription;
    if (!routeId || typeof routeId !== 'string' || routeId.length > 100) {
      return { status: 400, jsonBody: { error: 'Missing or invalid routeId' } };
    }
    if (
      !sub ||
      typeof sub.endpoint !== 'string' ||
      !sub.endpoint.startsWith('https://') ||
      sub.endpoint.length > 1000 ||
      typeof sub.keys?.p256dh !== 'string' ||
      typeof sub.keys?.auth !== 'string' ||
      sub.keys.p256dh.length > 200 ||
      sub.keys.auth.length > 100
    ) {
      return { status: 400, jsonBody: { error: 'Invalid push subscription' } };
    }

    if (!(await routeExists(routeId))) {
      return { status: 404, jsonBody: { error: 'Route not found' } };
    }

    await saveSubscription(routeId, {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    });

    return { status: 201, jsonBody: { success: true } };
  } catch (error) {
    context.error('Error saving push subscription:', error);
    return { status: 500, jsonBody: { error: 'Failed to save subscription' } };
  }
}

export async function pushUnsubscribe(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const limited = checkRateLimit(request, 'push-subscribe', 10, 60_000);
    if (limited) return limited;

    const body = await request.json() as { routeId?: string; endpoint?: string };
    if (!body.routeId || typeof body.routeId !== 'string' || typeof body.endpoint !== 'string') {
      return { status: 400, jsonBody: { error: 'Missing routeId or endpoint' } };
    }
    await deleteSubscription(body.routeId, body.endpoint);
    return { status: 200, jsonBody: { success: true } };
  } catch (error) {
    context.error('Error removing push subscription:', error);
    return { status: 500, jsonBody: { error: 'Failed to remove subscription' } };
  }
}

app.http('push-public-key', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'push/public-key',
  handler: pushPublicKey,
});

app.http('push-subscribe', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'push/subscribe',
  handler: pushSubscribe,
});

app.http('push-unsubscribe', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'push/unsubscribe',
  handler: pushUnsubscribe,
});
