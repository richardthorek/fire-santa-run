/**
 * Billing Routes — Stripe integration
 *
 * POST /api/stripe/webhook — Stripe webhook (no auth, verified by signature)
 *
 * Stripe webhooks require access to the raw request body for signature
 * verification. This is handled as a raw body route in app.ts before
 * global JSON parsing middleware.
 */

import { Hono } from 'hono';

const router = new Hono();

/**
 * POST /stripe/webhook — Stripe webhook endpoint
 * Receives raw Buffer body for signature verification.
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
    // TODO: Implement Stripe webhook signature verification and processing
    // when the Stripe SDK is available. For now, acknowledge the webhook
    // so Stripe stops retrying.
    console.info('Stripe webhook received', { timestamp: new Date().toISOString() });
    return c.json({ received: true }, 200);
  } catch (error) {
    console.error('Error processing Stripe webhook', { error });
    // Always return 200 to prevent Stripe from repeatedly retrying
    return c.json({ received: true }, 200);
  }
});

export { router as billingRouter };

export function attachStripeWebhook(): void {
  // Placeholder for legacy API (now handled in app.ts routing)
}
