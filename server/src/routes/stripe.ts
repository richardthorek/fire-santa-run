/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stripe subscription endpoints (per-brigade, $5/yr).
 *
 * - POST /api/stripe/create-checkout-session  → hosted Checkout for a brigade admin
 * - POST /api/stripe/create-portal-session    → Stripe billing portal for self-service
 * - POST /api/stripe/webhook                  → signature-verified entitlement sync
 *
 * Entitlement is stored on the brigade record and is the source of truth for the
 * paywall (see utils/subscription.ts). The client never asserts payment state;
 * only the webhook mutates it. Checkout stays off the card-data path (SAQ-A).
 *
 * Configuration (all server-side, never VITE_-prefixed):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
 *   APP_BASE_URL (redirect target; falls back to CORS_ORIGIN)
 */

import { Hono } from 'hono';
import Stripe from 'stripe';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { validateToken, checkBrigadePermission } from '../utils/auth.js';
import type { BrigadeMembership } from '../types/membership.js';
import { updateBrigadeSubscription } from '../utils/subscription.js';

const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';
const MEMBERSHIPS_TABLE = isDevMode ? 'dev-memberships' : 'memberships';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.CORS_ORIGIN || 'https://firesantarun.com.au').replace(/\/$/, '');

// Lazily construct the SDK so the server still boots (and health checks pass)
// when Stripe is not configured — the routes below return 503 in that case.
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = new Stripe(STRIPE_SECRET_KEY);
  return stripeClient;
}

function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getUserMembership(userId: string, brigadeId: string): Promise<BrigadeMembership | null> {
  const client = await getTableClient(MEMBERSHIPS_TABLE);
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapeODataValue(brigadeId)}' and userId eq '${escapeODataValue(userId)}'` },
  });
  for await (const entity of entities) {
    return { id: entity.rowKey, brigadeId: entity.partitionKey, userId: entity.userId, role: entity.role, status: entity.status } as any;
  }
  return null;
}

async function getBrigadeEntity(brigadeId: string): Promise<any | null> {
  const client = await getTableClient(BRIGADES_TABLE);
  try {
    return await client.getEntity(brigadeId, brigadeId);
  } catch (error: any) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

/** Map a Stripe subscription status onto the brigade's stored status enum. */
function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled':
    case 'incomplete_expired': return 'canceled';
    default: return 'none'; // incomplete / paused
  }
}

/**
 * Epoch-seconds end of the current paid period. In recent Stripe API versions
 * current_period_end moved from the subscription onto each subscription item,
 * so read whichever the pinned API version exposes.
 */
function getPeriodEndSeconds(subscription: Stripe.Subscription): number | undefined {
  const anySub = subscription as unknown as { current_period_end?: number };
  if (typeof anySub.current_period_end === 'number') return anySub.current_period_end;
  const item = subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return typeof item?.current_period_end === 'number' ? item.current_period_end : undefined;
}

async function applySubscriptionToBrigade(brigadeId: string, subscription: Stripe.Subscription): Promise<void> {
  const periodEnd = getPeriodEndSeconds(subscription);
  await updateBrigadeSubscription(brigadeId, {
    subscriptionStatus: mapStatus(subscription.status),
    subscribedUntil: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    stripeSubscriptionId: subscription.id,
  });
}

export const stripeRouter = new Hono<{ Variables: { userId?: string } }>();

// --- Public price lookup: the landing page reads the REAL price from Stripe ---
// Single source of truth: change the price in Stripe and the site follows.
// Includes currency_options so international visitors can be shown their local
// currency when multi-currency pricing is configured on the Stripe price.
// Cached in memory (and via Cache-Control) so this never hits Stripe per view.
interface PricePayload {
  unitAmount: number | null;
  currency: string;
  interval: string;
  currencyOptions: Record<string, number>;
}
let priceCache: { data: PricePayload; fetchedAt: number } | null = null;
const PRICE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

stripeRouter.get('/price', async (c) => {
  const stripe = getStripe();
  if (!stripe || !STRIPE_PRICE_ID) return c.json({ error: 'Billing is not configured' }, 503);

  if (priceCache && Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
    return c.json(priceCache.data, 200, { 'Cache-Control': 'public, max-age=3600' });
  }

  try {
    const price = await stripe.prices.retrieve(STRIPE_PRICE_ID, { expand: ['currency_options'] });
    const currencyOptions: Record<string, number> = {};
    for (const [cur, opt] of Object.entries(price.currency_options ?? {})) {
      if (typeof opt?.unit_amount === 'number') currencyOptions[cur] = opt.unit_amount;
    }
    const data: PricePayload = {
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? 'year',
      currencyOptions,
    };
    priceCache = { data, fetchedAt: Date.now() };
    return c.json(data, 200, { 'Cache-Control': 'public, max-age=3600' });
  } catch (error: any) {
    console.error('Error fetching Stripe price:', error);
    return c.json({ error: 'Failed to fetch price', message: error?.message || 'Unknown error' }, 500);
  }
});

// --- Checkout: start a subscription for a brigade (admin only) ---
stripeRouter.post('/create-checkout-session', async (c) => {
  const stripe = getStripe();
  if (!stripe || !STRIPE_PRICE_ID) return c.json({ error: 'Billing is not configured' }, 503);

  const authResult = await validateToken(c.req.raw);
  if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);

  const { brigadeId } = await c.req.json().catch(() => ({} as any));
  if (!brigadeId) return c.json({ error: 'Missing required field: brigadeId' }, 400);

  // Managing billing is an admin-settings action.
  const permission = await checkBrigadePermission(authResult.userId!, brigadeId, 'edit_settings', getUserMembership);
  if (!permission.authorized) return c.json({ error: 'Forbidden', message: permission.error || 'Insufficient permissions' }, 403);

  const brigade = await getBrigadeEntity(brigadeId);
  if (!brigade) return c.json({ error: 'Brigade not found' }, 404);

  try {
    // Reuse an existing Stripe customer for the brigade, else create one keyed
    // by brigadeId so all future events resolve back to this brigade.
    let customerId: string | undefined = brigade.stripeCustomerId || undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: brigade.contactEmail || undefined,
        name: brigade.name || undefined,
        metadata: { brigadeId },
      });
      customerId = customer.id;
      await updateBrigadeSubscription(brigadeId, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: brigadeId,
      // Stamp brigadeId on the subscription so every later subscription event
      // carries it without an extra lookup.
      subscription_data: { metadata: { brigadeId } },
      metadata: { brigadeId },
      success_url: `${APP_BASE_URL}/dashboard?checkout=success`,
      cancel_url: `${APP_BASE_URL}/dashboard?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return c.json({ url: session.url }, 200);
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return c.json({ error: 'Failed to create checkout session', message: error?.message || 'Unknown error' }, 500);
  }
});

// --- Billing portal: manage/cancel an existing subscription (admin only) ---
stripeRouter.post('/create-portal-session', async (c) => {
  const stripe = getStripe();
  if (!stripe) return c.json({ error: 'Billing is not configured' }, 503);

  const authResult = await validateToken(c.req.raw);
  if (!authResult.authenticated) return c.json({ error: 'Unauthorized', message: authResult.error || 'Authentication required' }, 401);

  const { brigadeId } = await c.req.json().catch(() => ({} as any));
  if (!brigadeId) return c.json({ error: 'Missing required field: brigadeId' }, 400);

  const permission = await checkBrigadePermission(authResult.userId!, brigadeId, 'edit_settings', getUserMembership);
  if (!permission.authorized) return c.json({ error: 'Forbidden', message: permission.error || 'Insufficient permissions' }, 403);

  const brigade = await getBrigadeEntity(brigadeId);
  if (!brigade?.stripeCustomerId) return c.json({ error: 'No billing account for this brigade yet' }, 400);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: brigade.stripeCustomerId,
      return_url: `${APP_BASE_URL}/dashboard`,
    });
    return c.json({ url: session.url }, 200);
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return c.json({ error: 'Failed to create portal session', message: error?.message || 'Unknown error' }, 500);
  }
});

// --- Webhook: the ONLY writer of entitlement state ---
stripeRouter.post('/webhook', async (c) => {
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return c.json({ error: 'Billing is not configured' }, 503);

  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'Missing stripe-signature header' }, 400);

  // Signature verification requires the exact raw body bytes.
  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error: any) {
    console.error('Stripe webhook signature verification failed:', error?.message);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const brigadeId = session.metadata?.brigadeId || session.client_reference_id || undefined;
        if (brigadeId && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await applySubscriptionToBrigade(brigadeId, subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const brigadeId = subscription.metadata?.brigadeId;
        if (brigadeId) {
          await applySubscriptionToBrigade(brigadeId, subscription);
        } else {
          console.warn(`Subscription event ${event.id} has no brigadeId metadata; ignoring.`);
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (error: any) {
    console.error(`Error handling Stripe event ${event.type}:`, error);
    // 500 tells Stripe to retry — appropriate for transient storage failures.
    return c.json({ error: 'Webhook handler failed' }, 500);
  }

  return c.json({ received: true }, 200);
});
