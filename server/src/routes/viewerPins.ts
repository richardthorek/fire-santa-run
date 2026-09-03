/**
 * Opt-in "families waiting here" pins (public, unauthenticated).
 *
 * A viewer who explicitly turns on sharing POSTs a coarse location (already
 * rounded to 3 decimal places / ~110m in the browser; rounded again here) tied
 * to an opaque, client-generated pin id kept in that tab's sessionStorage.
 *
 * The hub holds these in memory only — never written to Table Storage — and
 * fans them out to the navigator's read side in aggregated, grid-snapped form
 * (see hub.pushViewerPins / ViewerPinsMessage). They are dropped on a TTL, when
 * the viewer turns sharing off, and when the run reaches a terminal state.
 *
 * Disable per deployment with VIEWER_PINS_ENABLED=false.
 */

import { Hono } from 'hono';
import { rateLimit } from '../utils/rateLimit.js';
import { hub } from '../realtime/hub.js';

const ENABLED = process.env.VIEWER_PINS_ENABLED !== 'false';

/** Match the client + hub coarsening: 3 dp ≈ 110m. */
function coarsen(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export const viewerPinsRouter = new Hono();

// A sharing viewer refreshes their pin at most every ~30s; 10/min per client
// leaves room for retries and moving the pin without allowing a flood.
viewerPinsRouter.use('/viewer-pins', rateLimit({ name: 'viewer-pins', limit: 10, windowMs: 60_000 }));

/** Lets the tracking page decide whether to show the sharing control at all. */
viewerPinsRouter.get('/viewer-pins/config', (c) => c.json({ enabled: ENABLED }));

/**
 * Upsert or clear one viewer's waiting-spot pin.
 * Body: { routeId, pinId, lng?, lat? } — omit lng/lat (or send null) to clear.
 * Accepts navigator.sendBeacon posts (Blob with type application/json).
 */
viewerPinsRouter.post('/viewer-pins', async (c) => {
  if (!ENABLED) return c.json({ status: 'disabled' }, 403);

  let body: { routeId?: unknown; pinId?: unknown; lng?: unknown; lat?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { routeId, pinId, lng, lat } = body ?? {};
  if (
    typeof routeId !== 'string' || routeId.length === 0 || routeId.length > 128 ||
    typeof pinId !== 'string' || pinId.length === 0 || pinId.length > 128
  ) {
    return c.json({ error: 'routeId and pinId are required strings' }, 400);
  }

  // No coordinates → the viewer turned sharing off (or the page is unloading).
  if (lng == null || lat == null) {
    hub.removeViewerPin(routeId, pinId);
    return c.json({ status: 'cleared' }, 202);
  }

  if (
    typeof lng !== 'number' || typeof lat !== 'number' ||
    !Number.isFinite(lng) || !Number.isFinite(lat) ||
    lng < -180 || lng > 180 || lat < -90 || lat > 90
  ) {
    return c.json({ error: 'lng/lat must be valid coordinates' }, 400);
  }

  hub.setViewerPin(routeId, pinId, coarsen(lng), coarsen(lat));
  return c.json({ status: 'ok' }, 202);
});
