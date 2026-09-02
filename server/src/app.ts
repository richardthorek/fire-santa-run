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

/**
 * Content-Security-Policy (Tier 1b hardening, post-launch audit 2026-09).
 * This server serves both the API and the built SPA (main.ts mounts static
 * file / SPA-fallback routes on this same app after createApp() registers
 * this middleware), so the header applies to the HTML document too, not just
 * JSON responses. Built from the external hosts the client actually talks
 * to (grepped from src/): Mapbox GL JS (api.mapbox.com, plus its telemetry
 * sibling events.mapbox.com; mapbox-gl also spins up parsing workers from
 * blob: URLs, hence worker-src/child-src), Google Fonts (stylesheet +
 * font files), Geoscience Australia's fire-station lookup
 * (services.ga.gov.au, called directly from the browser — see
 * src/utils/fireStationData.ts), and Station Manager (SUITE_AUTH_URL —
 * read live so this tracks whatever the deployment is actually configured
 * to call, including through the santa.stationkit.com.au domain move).
 * 'unsafe-inline' on style-src is a deliberate, common tradeoff: this is a
 * React app with real inline `style={{...}}` usage throughout — removing
 * that would be a much larger refactor than this hardening pass, and inline
 * *styles* are a materially smaller XSS vector than inline *scripts* (which
 * stay locked to 'self' — the Vite build emits only hashed same-origin
 * script files, no inline script content).
 *
 * Shipped as Report-Only rather than enforcing: this could not be verified
 * against a real browser session with real Mapbox/Station Manager traffic
 * from the environment this was written in (no Mapbox token, no live
 * deployment to test against). Report-Only asks browsers to evaluate the
 * policy and log violations to the console without blocking anything, so it
 * is safe to ship as-is. Before flipping to enforcing (rename the header to
 * `Content-Security-Policy`), load the app in a real browser — production or
 * a local build with a real VITE_MAPBOX_TOKEN — exercise the map (public
 * tracking, route editor), sign-in (Station Manager redirect/session calls),
 * and push notification opt-in, and confirm devtools shows zero CSP
 * violations for legitimate requests.
 */
function buildCsp(): string {
  let suiteAuthHost = 'stationkit.com.au';
  try {
    suiteAuthHost = new URL(process.env.SUITE_AUTH_URL || 'https://stationkit.com.au').host;
  } catch {
    // Fall back to the default host above if SUITE_AUTH_URL is malformed —
    // validateServerEnv() already flags a malformed value as fatal at startup.
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://api.mapbox.com",
    `connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://services.ga.gov.au https://${suiteAuthHost}`,
    "worker-src 'self' blob:",
    "child-src blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}
const CONTENT_SECURITY_POLICY = buildCsp();

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
    // Report-Only until verified against a real browser session — see buildCsp() above.
    c.res.headers.set('Content-Security-Policy-Report-Only', CONTENT_SECURITY_POLICY);
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
