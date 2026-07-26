/**
 * Billing Routes — Stripe integration
 *
 * POST /api/stripe/webhook — Stripe webhook (no auth, verified by signature)
 *
 * Stripe webhooks require the raw request body for signature verification.
 * Hono's body() method will parse JSON by default, but we can access the
 * raw body via the native request stream if needed for full implementation.
 */

import { Hono } from 'hono';

const router = new Hono();

/**
 * POST /webhook — Stripe webhook endpoint
 *
 * Returns 200 immediately to prevent Stripe from retrying.
 * Webhook verification and event processing should be implemented
 * when Stripe SDK integration is added.
 */
router.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400);
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET env var is missing — cannot verify webhook');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  try {
    // Get request body (JSON) — for full Stripe signature verification,
    // we would need the raw bytes, which requires accessing the native
    // request stream before JSON parsing. This is marked as TODO pending
    // Stripe SDK integration and raw body handling setup in main.ts.
    const body = await c.req.json().catch(() => ({}));

    console.info('Stripe webhook acknowledged', {
      timestamp: new Date().toISOString(),
      hasSignature: !!sig,
      bodySize: JSON.stringify(body).length,
    });

    // Return 200 so Stripe stops retrying this event
    return c.json({ received: true }, 200);
  } catch (error) {
    console.error('Error processing Stripe webhook', { error });
    // Always return 200 to prevent Stripe from repeatedly retrying
    return c.json({ received: true }, 200);
  }
});

export { router as billingRouter };
