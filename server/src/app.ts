import { Hono } from 'hono';
import { brigadesRouter } from './routes/brigades.js';
import { routesRouter } from './routes/routes.js';
import { usersRouter } from './routes/users.js';
import { negotiateRouter } from './routes/negotiate.js';
import { broadcastRouter } from './routes/broadcast.js';
import { fireStationsRouter } from './routes/fire-stations.js';
import { analyticsRouter } from './routes/analytics.js';
import { healthRouter } from './routes/health.js';
import { telemetryRouter } from './routes/telemetry.js';
import { pushRouter } from './routes/push.js';
import { auditRouter } from './routes/audit.js';

const isDevMode = process.env.DEV_MODE === 'true';
// CORS_ORIGIN may be a comma-separated list. Default covers both the current
// production domain and the incoming stationkit.com.au subdomain during the
// suite rebrand transition — drop firesantarun.com.au once DNS for
// santa.stationkit.com.au is live and traffic has cut over.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'https://firesantarun.com.au,https://santa.stationkit.com.au')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const isAllowedOrigin = (origin: string | undefined): boolean => !!origin && ALLOWED_ORIGINS.includes(origin);

export function createApp() {
  const app = new Hono();

  // CORS preflight: answer OPTIONS before any route handler runs so authed
  // cross-origin writes (which send an Authorization header) pass preflight.
  app.options('*', (c) => {
    const origin = c.req.header('origin');
    const headers = new Headers({ Vary: 'Origin' });
    if (isDevMode || isAllowedOrigin(origin)) {
      headers.set('Access-Control-Allow-Origin', isDevMode ? (origin ?? '*') : (origin as string));
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
      if (isAllowedOrigin(origin)) {
        c.res.headers.set('Access-Control-Allow-Origin', origin as string);
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
  app.route('/api', negotiateRouter);
  app.route('/api', broadcastRouter);
  app.route('/api', fireStationsRouter);
  app.route('/api/analytics', analyticsRouter);
  app.route('/api/push', pushRouter);
  app.route('/api/audit', auditRouter);

  return app;
}
