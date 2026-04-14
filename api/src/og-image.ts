/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /api/og-image - Dynamic Open Graph image generation
 *
 * Generates a route-specific 1200×630 SVG social-preview card containing:
 *   - Brigade name & route name
 *   - Route date
 *   - Embedded Mapbox Static Images API map thumbnail
 *   - Festive decorations (snowflakes, Christmas trees, summer sky)
 *
 * The generated SVG is cached in Azure Blob Storage (container: "og-images")
 * keyed by `{brigadeId}/{routeId}.svg`.  On cache hit the stored bytes are
 * returned directly; on miss the SVG is built, cached (if blob storage is
 * configured) and returned.
 *
 * Endpoints:
 *   GET /api/og-image?routeId={id}&brigadeId={id}
 *
 * Query parameters:
 *   routeId   - Required. The route identifier.
 *   brigadeId - Required. The brigade identifier.
 *
 * Responses:
 *   200  image/svg+xml   – The generated preview image
 *   400  application/json – Missing required parameters
 *   404  application/json – Route or brigade not found
 *   500  application/json – Internal error
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTableClient, isDevMode } from './utils/storage';
import { getCachedBlob, setCachedBlob } from './utils/blobStorage';
import { buildOGImageSVG } from './utils/ogImageBuilder';

const ROUTES_TABLE = isDevMode ? 'dev-routes' : 'routes';
const BRIGADES_TABLE = isDevMode ? 'dev-brigades' : 'brigades';
const OG_IMAGES_CONTAINER = 'og-images';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function getOGImage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const routeId = request.query.get('routeId');
  const brigadeId = request.query.get('brigadeId');

  if (!routeId || !brigadeId) {
    return {
      status: 400,
      jsonBody: { error: 'Missing required parameters: routeId, brigadeId' },
    };
  }

  const blobKey = `${brigadeId}/${routeId}.svg`;

  // ----- Check cache first -----
  try {
    const cached = await getCachedBlob(OG_IMAGES_CONTAINER, blobKey);
    if (cached) {
      context.log(`OG image cache hit: ${blobKey}`);
      return {
        status: 200,
        body: cached,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      };
    }
  } catch (cacheErr) {
    // Cache read failure is non-fatal – fall through to regeneration.
    context.warn('OG image cache read failed:', cacheErr);
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
    context.error('OG image: error fetching data:', err);
    return {
      status: 500,
      jsonBody: { error: 'Failed to fetch route/brigade data' },
    };
  }

  if (!routeEntity) {
    return {
      status: 404,
      jsonBody: { error: 'Route not found' },
    };
  }

  // ----- Build SVG -----
  let coordinates: [number, number][] = [];
  if (routeEntity.geometry) {
    try {
      const parsed = JSON.parse(routeEntity.geometry) as { coordinates?: [number, number][] };
      coordinates = parsed.coordinates ?? [];
    } catch {
      // Malformed geometry – fall back to no route on the map thumbnail.
      context.warn(`OG image: could not parse geometry for route ${routeId}`);
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
    context.warn('OG image: cache write failed (non-fatal):', err);
  });

  context.log(`OG image generated: ${blobKey}`);

  return {
    status: 200,
    body: svgBuffer,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

app.http('og-image', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'og-image',
  handler: getOGImage,
});
