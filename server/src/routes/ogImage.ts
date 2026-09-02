/**
 * GET /api/og-image — Dynamic Open Graph image generation
 *
 * Generates a route-specific 1200×630 SVG social-preview card containing:
 *   - Brigade name & route name
 *   - Route date
 *   - Embedded Mapbox Static Images API map thumbnail
 *   - Festive decorations (snowflakes, Christmas trees, summer sky)
 *
 * The generated SVG is cached in Azure Blob Storage (container: "og-images")
 * keyed by `{brigadeId}/{routeId}.svg`. On cache hit the stored bytes are
 * returned directly; on miss the SVG is built, cached (if blob storage is
 * configured) and returned. Anonymous — social-media crawlers fetch this
 * with no auth, same as the public tracking page it decorates.
 *
 * Query parameters:
 *   routeId   - Required. The route identifier.
 *   brigadeId - Required. The brigade identifier.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { getTableClient, isDevMode } from '../utils/storage.js';
import { getCachedBlob, setCachedBlob } from '../utils/blobStorage.js';
import { buildOGImageSVG } from '../utils/ogImageBuilder.js';

const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';
const BRIGADES_TABLE = isDevMode ? 'devbrigades' : 'brigades';
const OG_IMAGES_CONTAINER = 'og-images';

async function fetchRouteEntity(brigadeId: string, routeId: string): Promise<any | null> {
  try {
    const client = await getTableClient(ROUTES_TABLE);
    return await client.getEntity(brigadeId, routeId);
  } catch (err: any) {
    if (err?.statusCode === 404) return null;
    throw err;
  }
}

async function fetchBrigadeEntity(brigadeId: string): Promise<any | null> {
  try {
    const client = await getTableClient(BRIGADES_TABLE);
    return await client.getEntity(brigadeId, brigadeId);
  } catch (err: any) {
    if (err?.statusCode === 404) return null;
    throw err;
  }
}

export const ogImageRouter = new Hono();

ogImageRouter.get('/og-image', async (c) => {
  const routeId = c.req.query('routeId');
  const brigadeId = c.req.query('brigadeId');

  if (!routeId || !brigadeId) {
    return c.json({ error: 'Missing required parameters: routeId, brigadeId' }, 400);
  }

  const blobKey = `${brigadeId}/${routeId}.svg`;
  const svgHeaders = {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400',
  };

  // ----- Check cache first -----
  try {
    const cached = await getCachedBlob(OG_IMAGES_CONTAINER, blobKey);
    if (cached) {
      return new Response(new Uint8Array(cached), { status: 200, headers: svgHeaders });
    }
  } catch (cacheErr) {
    // Cache read failure is non-fatal – fall through to regeneration.
    console.warn('[og-image] cache read failed:', cacheErr);
  }

  // ----- Fetch route & brigade data -----
  let routeEntity: any;
  let brigadeEntity: any;

  try {
    [routeEntity, brigadeEntity] = await Promise.all([
      fetchRouteEntity(brigadeId, routeId),
      fetchBrigadeEntity(brigadeId),
    ]);
  } catch (err) {
    console.error('[og-image] error fetching data:', err);
    return c.json({ error: 'Failed to fetch route/brigade data' }, 500);
  }

  if (!routeEntity) {
    return c.json({ error: 'Route not found' }, 404);
  }

  // ----- Build SVG -----
  let coordinates: [number, number][] = [];
  if (routeEntity.geometry) {
    try {
      const parsed = JSON.parse(routeEntity.geometry) as { coordinates?: [number, number][] };
      coordinates = parsed.coordinates ?? [];
    } catch {
      // Malformed geometry – fall back to no route on the map thumbnail.
      console.warn(`[og-image] could not parse geometry for route ${routeId}`);
    }
  }

  const svgContent = buildOGImageSVG({
    routeName: routeEntity.name ?? 'Santa Run',
    brigadeName: brigadeEntity?.name ?? brigadeId,
    date: routeEntity.date ?? '',
    coordinates,
    mapboxToken: process.env.MAPBOX_TOKEN,
  });

  const svgBuffer = Buffer.from(svgContent, 'utf-8');

  // ----- Store in cache (non-blocking, errors are non-fatal) -----
  setCachedBlob(OG_IMAGES_CONTAINER, blobKey, svgBuffer, 'image/svg+xml').catch((err) => {
    console.warn('[og-image] cache write failed (non-fatal):', err);
  });

  return new Response(new Uint8Array(svgBuffer), { status: 200, headers: svgHeaders });
});
