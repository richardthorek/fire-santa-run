/**
 * OG Image generation helpers.
 *
 * Builds a 1200×630 SVG image for a given route / brigade.  The SVG embeds a
 * Mapbox Static Images API thumbnail of the route and overlays festive text +
 * decorations so that social-media crawlers receive a rich preview image.
 *
 * All logic is pure-function so it can be unit-tested without a network or
 * Azure dependency.
 */

export interface OGImageData {
  routeName: string;
  brigadeName: string;
  date: string;
  /** GeoJSON LineString coordinates (or empty array when no route geometry) */
  coordinates: [number, number][];
  /** Mapbox access token.  When empty the map thumbnail is omitted. */
  mapboxToken?: string;
}

/** Width / height of the canonical OG image in pixels. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * Build a Mapbox Static Images API URL that shows the route geometry.
 *
 * Docs: https://docs.mapbox.com/api/maps/static-images/
 */
export function buildMapboxStaticUrl(
  coordinates: [number, number][],
  token: string,
  width = 600,
  height = 400
): string {
  if (!token || coordinates.length === 0) return '';

  // Encode route as a GeoJSON path overlay
  const geojson = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };

  // Style: thick red candy-cane line
  const path = encodeURIComponent(JSON.stringify(geojson));
  const overlay = `geojson(${path})`;

  // 'auto' zoom fits the geometry
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `${overlay}/auto/${width}x${height}@2x?padding=40&access_token=${token}`
  );
}

/**
 * Generate a centrepoint from an array of coordinates (simple average).
 */
export function centreOf(coordinates: [number, number][]): [number, number] {
  if (coordinates.length === 0) return [151.2093, -33.8688]; // Sydney default
  const lng = coordinates.reduce((s, c) => s + c[0], 0) / coordinates.length;
  const lat = coordinates.reduce((s, c) => s + c[1], 0) / coordinates.length;
  return [lng, lat];
}

/**
 * Escape a string so it is safe to embed inside an SVG `text` element.
 */
export function svgEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Truncate a string to `maxLen` characters, appending "…" when truncated.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

/**
 * Generate the complete SVG string for an OG preview image.
 */
export function buildOGImageSVG(data: OGImageData): string {
  const { routeName, brigadeName, date, coordinates, mapboxToken } = data;

  const safeRoute = svgEscape(truncate(routeName, 48));
  const safeBrigade = svgEscape(truncate(brigadeName, 60));
  const safeDate = svgEscape(date);

  const mapUrl =
    mapboxToken && coordinates.length > 0
      ? buildMapboxStaticUrl(coordinates, mapboxToken, 560, 400)
      : '';

  // Snowflake positions (deterministic, no randomness for caching stability)
  const snowflakes: Array<{ x: number; y: number; size: number; opacity: number }> = [
    { x: 80, y: 50, size: 20, opacity: 0.8 },
    { x: 200, y: 30, size: 14, opacity: 0.6 },
    { x: 1100, y: 40, size: 18, opacity: 0.75 },
    { x: 950, y: 70, size: 12, opacity: 0.65 },
    { x: 650, y: 20, size: 16, opacity: 0.7 },
    { x: 780, y: 580, size: 14, opacity: 0.6 },
    { x: 100, y: 580, size: 22, opacity: 0.85 },
    { x: 1050, y: 560, size: 16, opacity: 0.7 },
    { x: 380, y: 600, size: 12, opacity: 0.55 },
  ];

  const snowflakeSVG = snowflakes
    .map(
      ({ x, y, size, opacity }) =>
        `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" opacity="${opacity}" fill="white">❄</text>`
    )
    .join('\n    ');

  // Decorative Christmas trees in the bottom corners
  const treeSVG = `
    <text x="50" y="610" font-size="40" text-anchor="middle" opacity="0.9">🌲</text>
    <text x="110" y="620" font-size="28" text-anchor="middle" opacity="0.8">🌲</text>
    <text x="1150" y="610" font-size="40" text-anchor="middle" opacity="0.9">🌲</text>
    <text x="1090" y="620" font-size="28" text-anchor="middle" opacity="0.8">🌲</text>`;

  // Map thumbnail panel (right half)
  const mapPanel = mapUrl
    ? `<image href="${mapUrl}" x="600" y="80" width="560" height="400" preserveAspectRatio="xMidYMid slice" clip-path="url(#mapClip)"/>`
    : `<rect x="600" y="80" width="560" height="400" rx="16" fill="#E3F2FD" opacity="0.6"/>
    <text x="880" y="295" font-size="80" text-anchor="middle">🗺️</text>`;

  return `<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Australian summer sky gradient -->
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1565C0"/>
      <stop offset="50%" stop-color="#0288D1"/>
      <stop offset="100%" stop-color="#29B6F6"/>
    </linearGradient>
    <!-- Festive red banner gradient -->
    <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#D32F2F"/>
      <stop offset="100%" stop-color="#B71C1C"/>
    </linearGradient>
    <!-- White card gradient -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.97"/>
      <stop offset="100%" stop-color="#FFF8E1" stop-opacity="0.95"/>
    </linearGradient>
    <!-- Clip path for map thumbnail -->
    <clipPath id="mapClip">
      <rect x="600" y="80" width="560" height="400" rx="16"/>
    </clipPath>
    <!-- Drop shadow filter -->
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#00000033"/>
    </filter>
  </defs>

  <!-- Background: Australian summer sky -->
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#skyGrad)"/>

  <!-- Festive snowflakes -->
  ${snowflakeSVG}

  <!-- Sun (top-right) -->
  <circle cx="1100" cy="100" r="70" fill="#FFA726" opacity="0.85"/>
  <circle cx="1100" cy="100" r="55" fill="#FFD54F" opacity="0.6"/>

  <!-- White content card (left panel) -->
  <rect x="30" y="60" width="540" height="510" rx="24" fill="url(#cardGrad)" filter="url(#shadow)"/>

  <!-- Top red banner stripe -->
  <rect x="30" y="60" width="540" height="90" rx="24" fill="url(#bannerGrad)"/>
  <rect x="30" y="120" width="540" height="30" fill="url(#bannerGrad)"/>

  <!-- summer-gold accent line -->
  <rect x="30" y="145" width="540" height="6" fill="#FFD600"/>

  <!-- Banner emoji + "Fire Santa Run" -->
  <text x="80" y="117" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="white">🎅</text>
  <text x="130" y="117" font-family="Arial Black, Arial, sans-serif" font-size="28" font-weight="bold" fill="white">Fire Santa Run</text>

  <!-- Brigade name -->
  <text x="300" y="200" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="bold" fill="#D32F2F" text-anchor="middle">${safeBrigade}</text>

  <!-- Divider -->
  <line x1="60" y1="215" x2="540" y2="215" stroke="#FFCA28" stroke-width="2"/>

  <!-- Route name (large) -->
  <text x="300" y="285" font-family="Arial Black, Arial, sans-serif" font-size="36" font-weight="bold" fill="#212121" text-anchor="middle" dominant-baseline="middle">${safeRoute}</text>

  <!-- Date pill -->
  <rect x="170" y="330" width="260" height="42" rx="21" fill="#D32F2F"/>
  <text x="300" y="357" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="white" text-anchor="middle">📅 ${safeDate}</text>

  <!-- tagline -->
  <text x="300" y="430" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#455A64" text-anchor="middle">Community Santa Run</text>
  <text x="300" y="458" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#78909C" text-anchor="middle">Christmas Community Service 🔥🎄</text>

  <!-- Call to action -->
  <rect x="100" y="490" width="400" height="50" rx="25" fill="#FFA726"/>
  <text x="300" y="521" font-family="Arial Black, Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">🔴 Track Santa Live</text>

  <!-- Map thumbnail (right panel) -->
  ${mapPanel}

  <!-- Map panel border -->
  <rect x="600" y="80" width="560" height="400" rx="16" fill="none" stroke="#FFD600" stroke-width="3"/>

  <!-- Map panel label -->
  <rect x="615" y="455" width="530" height="40" rx="8" fill="rgba(0,0,0,0.45)"/>
  <text x="880" y="481" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="white" text-anchor="middle">🎅 Santa's Route</text>

  <!-- Bottom decorations -->
  ${treeSVG}

  <!-- Bottom gold accent bar -->
  <rect x="0" y="618" width="${OG_IMAGE_WIDTH}" height="12" fill="#FFD600" opacity="0.9"/>
</svg>`;
}
