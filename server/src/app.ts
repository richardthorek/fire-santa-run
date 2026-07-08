import { Hono } from 'hono';
import { brigadesRouter } from './routes/brigades.js';
import { routesRouter } from './routes/routes.js';
import { usersRouter } from './routes/users.js';
import { membersRouter } from './routes/members.js';
import { invitationsRouter } from './routes/invitations.js';
import { negotiateRouter } from './routes/negotiate.js';
import { broadcastRouter } from './routes/broadcast.js';
import { rfsStationsRouter } from './routes/rfs-stations.js';
import { verificationRouter } from './routes/verification.js';
import { adminVerificationRouter } from './routes/admin-verification.js';
import { claimRouter } from './routes/claim.js';
import { analyticsRouter } from './routes/analytics.js';
import { healthRouter } from './routes/health.js';
import { telemetryRouter } from './routes/telemetry.js';
import { stripeRouter } from './routes/stripe.js';
import { pushRouter } from './routes/push.js';

const isDevMode = process.env.DEV_MODE === 'true';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'https://firesantarun.com.au';

export function createApp() {
  const app = new Hono();

  // CORS preflight: answer OPTIONS before any route handler runs so authed
  // cross-origin writes (which send an Authorization header) pass preflight.
  app.options('*', (c) => {
    const origin = c.req.header('origin');
    const headers = new Headers({ Vary: 'Origin' });
    if (isDevMode || origin === ALLOWED_ORIGIN) {
      headers.set('Access-Control-Allow-Origin', isDevMode ? (origin ?? '*') : ALLOWED_ORIGIN);
      headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      headers.set('Access-Control-Max-Age', '86400');
    }
    return new Response(null, { status: 204, headers });
  });

  // Security headers + CORS on every response.
  app.use('*', async (c, next) => {
    await next();
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('X-Frame-Options', 'DENY');
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
    // Only enforce strict CORS in production; dev uses Vite's proxy.
    // Always set Vary: Origin so caches don't serve a CORS response cross-origin.
    if (!isDevMode) {
      c.res.headers.set('Vary', 'Origin');
      const origin = c.req.header('origin');
      if (origin === ALLOWED_ORIGIN) {
        c.res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      }
    }
  });

  // Health, readiness, and client telemetry ingestion.
  app.route('/api', healthRouter);
  app.route('/api', telemetryRouter);

  // API routes
  app.route('/api/brigades', brigadesRouter);
  app.route('/api/routes', routesRouter);
  app.route('/api/users', usersRouter);

  // Members are scoped under brigade — clone brigadeId from the mount path
  const brigadeScoped = new Hono();
  brigadeScoped.route('/:brigadeId/members', membersRouter);
  brigadeScoped.route('/:brigadeId', claimRouter);
  app.route('/api/brigades', brigadeScoped);

  app.route('/api/invitations', invitationsRouter);
  app.route('/api', negotiateRouter);
  app.route('/api', broadcastRouter);
  app.route('/api', rfsStationsRouter);
  app.route('/api/verification', verificationRouter);
  app.route('/api/site-admin/verification', adminVerificationRouter);
  app.route('/api/analytics', analyticsRouter);
  app.route('/api/stripe', stripeRouter);
  app.route('/api/push', pushRouter);

  return app;
}
