/**
 * Route export utilities — JSON, CSV, KML and print-friendly summaries.
 *
 * All exporters are pure string generators so they can be unit-tested;
 * `downloadFile` handles the browser download plumbing.
 */

import type { Route, Waypoint } from '../types';
import type { Brigade } from '../storage/types';
import { MAPBOX_TOKEN, EXAMPLE_MAPBOX_TOKEN } from '../config/mapbox';

/** Versioned envelope for JSON backups so imports can validate provenance. */
export interface RouteBackup {
  format: 'fire-santa-run-backup';
  version: 1;
  exportedAt: string;
  brigadeId?: string;
  brigadeName?: string;
  routes: Route[];
}

export const BACKUP_FORMAT = 'fire-santa-run-backup';
export const BACKUP_VERSION = 1;

/** Make a string safe for use in a downloaded filename. */
export function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'route';
}

/** Serialise one or more routes into the versioned backup envelope. */
export function routesToBackupJSON(routes: Route[], brigade?: Pick<Brigade, 'id' | 'name'> | null): string {
  const backup: RouteBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    brigadeId: brigade?.id ?? routes[0]?.brigadeId,
    brigadeName: brigade?.name,
    routes,
  };
  return JSON.stringify(backup, null, 2);
}

/** Escape a value for a CSV cell (RFC 4180). */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADER = [
  'route_id', 'route_name', 'route_date', 'route_status', 'route_distance_m',
  'route_estimated_duration_s', 'route_actual_duration_s', 'route_view_count',
  'waypoint_order', 'waypoint_name', 'waypoint_address',
  'longitude', 'latitude', 'estimated_arrival', 'actual_arrival', 'completed', 'notes',
].join(',');

/** One CSV row per waypoint, with route metadata repeated on each row. */
export function routesToCSV(routes: Route[]): string {
  const rows: string[] = [CSV_HEADER];
  for (const route of routes) {
    const waypoints = [...route.waypoints].sort((a, b) => a.order - b.order);
    if (waypoints.length === 0) {
      rows.push([
        route.id, route.name, route.date, route.status, route.distance ?? '',
        route.estimatedDuration ?? '', route.actualDuration ?? '', route.viewCount ?? '',
        '', '', '', '', '', '', '', '', '',
      ].map(csvCell).join(','));
      continue;
    }
    for (const wp of waypoints) {
      rows.push([
        route.id, route.name, route.date, route.status, route.distance ?? '',
        route.estimatedDuration ?? '', route.actualDuration ?? '', route.viewCount ?? '',
        wp.order, wp.name ?? '', wp.address ?? '',
        wp.coordinates[0], wp.coordinates[1],
        wp.estimatedArrival ?? '', wp.actualArrival ?? '',
        wp.isCompleted ? 'yes' : 'no', wp.notes ?? '',
      ].map(csvCell).join(','));
    }
  }
  return rows.join('\r\n');
}

/** Escape XML special characters. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function waypointPlacemark(wp: Waypoint, index: number): string {
  const name = xmlEscape(wp.name || `Stop ${index + 1}`);
  const descriptionParts = [wp.address, wp.notes].filter(Boolean).map(s => xmlEscape(s!));
  const description = descriptionParts.length
    ? `\n      <description>${descriptionParts.join(' — ')}</description>`
    : '';
  return `    <Placemark>
      <name>${name}</name>${description}
      <Point>
        <coordinates>${wp.coordinates[0]},${wp.coordinates[1]},0</coordinates>
      </Point>
    </Placemark>`;
}

/** Export routes as KML (Google Earth). Waypoints become Placemarks; geometry becomes a LineString path. */
export function routesToKML(routes: Route[], documentName = 'Fire Santa Run Export'): string {
  const folders = routes.map(route => {
    const waypoints = [...route.waypoints].sort((a, b) => a.order - b.order);
    const placemarks = waypoints.map((wp, i) => waypointPlacemark(wp, i)).join('\n');
    const path = route.geometry && route.geometry.coordinates.length > 1
      ? `    <Placemark>
      <name>${xmlEscape(route.name)} — path</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${route.geometry.coordinates.map(([lng, lat]) => `${lng},${lat},0`).join(' ')}</coordinates>
      </LineString>
    </Placemark>`
      : '';
    return `  <Folder>
    <name>${xmlEscape(route.name)}</name>
    <description>${xmlEscape(route.description || '')} (${xmlEscape(route.date)})</description>
${[placemarks, path].filter(Boolean).join('\n')}
  </Folder>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${xmlEscape(documentName)}</name>
  <Style id="routeLine">
    <LineStyle>
      <color>ff2f2fd3</color>
      <width>4</width>
    </LineStyle>
  </Style>
${folders}
</Document>
</kml>`;
}

/** Trigger a browser download of generated content. */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Build a Mapbox Static Images URL for a route overview (or null if no token/geometry). */
export function buildStaticMapUrl(route: Route, width = 640, height = 360): string | null {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === EXAMPLE_MAPBOX_TOKEN) return null;
  const coords = route.geometry?.coordinates?.length
    ? route.geometry.coordinates
    : route.waypoints.map(wp => wp.coordinates);
  if (coords.length === 0) return null;

  // Pin markers for up to the first 10 waypoints (static API URL length limits)
  const pins = route.waypoints
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 10)
    .map((wp, i) => `pin-s-${(i + 1) % 10}+d32f2f(${wp.coordinates[0]},${wp.coordinates[1]})`);

  // Encode the route path as a GeoJSON overlay when available (simplified to keep URL short)
  const overlays: string[] = [...pins];
  if (route.geometry && route.geometry.coordinates.length > 1) {
    const step = Math.max(1, Math.floor(route.geometry.coordinates.length / 80));
    const simplified = route.geometry.coordinates.filter((_, i, arr) => i % step === 0 || i === arr.length - 1);
    const geojson = { type: 'Feature', properties: { stroke: '#D32F2F', 'stroke-width': 4 }, geometry: { type: 'LineString', coordinates: simplified } };
    overlays.push(`geojson(${encodeURIComponent(JSON.stringify(geojson))})`);
  }

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(',')}/auto/${width}x${height}@2x?padding=40&access_token=${MAPBOX_TOKEN}`;
}

function formatDurationHuman(seconds?: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Build a print-friendly HTML route summary (map image, waypoint table,
 * turn-by-turn instructions, brigade branding). Users print or "Save as PDF"
 * from the browser dialog.
 */
export function buildPrintableRouteSummary(route: Route, brigade?: Pick<Brigade, 'name' | 'logo' | 'themeColor'> | null): string {
  // Sanitise values interpolated outside xmlEscape'd text nodes:
  // theme colour goes into CSS — only accept a hex colour literal
  const themeColor = brigade?.themeColor && /^#[0-9a-fA-F]{3,8}$/.test(brigade.themeColor)
    ? brigade.themeColor
    : '#D32F2F';
  // logo goes into an img src attribute — only accept data-URL images or http(s) URLs
  const logoSrc = brigade?.logo && /^(data:image\/|https?:\/\/)/i.test(brigade.logo)
    ? xmlEscape(brigade.logo)
    : null;
  const mapUrl = buildStaticMapUrl(route, 800, 400);
  const waypoints = [...route.waypoints].sort((a, b) => a.order - b.order);

  const waypointRows = waypoints.map((wp, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${xmlEscape(wp.name || `Stop ${i + 1}`)}</td>
        <td>${xmlEscape(wp.address || '')}</td>
        <td>${wp.estimatedArrival ? xmlEscape(new Date(wp.estimatedArrival).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) : '—'}</td>
        <td>${xmlEscape(wp.notes || '')}</td>
      </tr>`).join('');

  const instructions = (route.navigationSteps || []).map((step, i) => `
      <li><span class="step-num">${i + 1}.</span> ${xmlEscape(step.instruction)} <span class="muted">(${(step.distance / 1000).toFixed(1)} km)</span></li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${xmlEscape(route.name)} — Route Summary</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #212121; margin: 2rem; }
  header { display: flex; align-items: center; gap: 1rem; border-bottom: 4px solid ${themeColor}; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  header img { height: 56px; width: 56px; object-fit: contain; border-radius: 8px; }
  h1 { margin: 0; font-size: 1.6rem; color: ${themeColor}; }
  .subtitle { color: #616161; margin: 0.25rem 0 0; }
  .meta { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .meta div { font-size: 0.95rem; }
  .meta strong { display: block; color: ${themeColor}; font-size: 1.15rem; }
  .map { width: 100%; max-width: 800px; border-radius: 8px; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; font-size: 0.85rem; }
  th, td { border: 1px solid #E0E0E0; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
  th { background: ${themeColor}; color: white; }
  td.num { text-align: center; font-weight: 700; }
  ol { padding-left: 1.25rem; font-size: 0.85rem; }
  ol li { margin-bottom: 0.25rem; }
  .muted { color: #757575; }
  h2 { font-size: 1.1rem; border-bottom: 2px solid #E0E0E0; padding-bottom: 0.25rem; }
  footer { margin-top: 2rem; font-size: 0.75rem; color: #757575; border-top: 1px solid #E0E0E0; padding-top: 0.5rem; }
  @media print { body { margin: 0.5cm; } .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    ${logoSrc ? `<img src="${logoSrc}" alt="">` : ''}
    <div>
      <h1>🎅 ${xmlEscape(route.name)}</h1>
      <p class="subtitle">${brigade?.name ? xmlEscape(brigade.name) + ' · ' : ''}${xmlEscape(new Date(route.date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${route.startTime ? ' · departs ' + xmlEscape(route.startTime) : ''}</p>
    </div>
  </header>
  ${route.description ? `<p>${xmlEscape(route.description)}</p>` : ''}
  <div class="meta">
    <div><strong>${waypoints.length}</strong> Stops</div>
    <div><strong>${route.distance ? (route.distance / 1000).toFixed(1) + ' km' : '—'}</strong> Distance</div>
    <div><strong>${formatDurationHuman(route.estimatedDuration)}</strong> Est. duration</div>
    <div><strong>${xmlEscape(route.status)}</strong> Status</div>
  </div>
  ${mapUrl ? `<img class="map" src="${xmlEscape(mapUrl)}" alt="Route overview map">` : ''}
  <h2>📍 Stops</h2>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Address</th><th>ETA</th><th>Notes</th></tr></thead>
    <tbody>${waypointRows}</tbody>
  </table>
  ${instructions ? `<h2>🧭 Turn-by-turn instructions</h2>\n  <ol>${instructions}</ol>` : ''}
  <footer>Generated by Fire Santa Run on ${xmlEscape(new Date().toLocaleString())}</footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`;
}

/** Open the printable summary in a new window and trigger the print dialog. */
export function openPrintableRouteSummary(route: Route, brigade?: Pick<Brigade, 'name' | 'logo' | 'themeColor'> | null): void {
  const html = buildPrintableRouteSummary(route, brigade);
  // Load via a Blob URL rather than document.write: all interpolated values in
  // the generated document are escaped/validated, and the blob document gets a
  // unique opaque origin instead of inheriting the app's origin.
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    URL.revokeObjectURL(url);
    alert('Please allow pop-ups to print the route summary.');
    return;
  }
  // Revoke once the new window has had time to load the blob
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Export a single route in the chosen format and download it. */
export function exportRoute(route: Route, format: 'json' | 'csv' | 'kml', brigade?: Pick<Brigade, 'id' | 'name'> | null): void {
  const base = safeFilename(route.name);
  if (format === 'json') {
    downloadFile(`${base}.json`, routesToBackupJSON([route], brigade), 'application/json');
  } else if (format === 'csv') {
    downloadFile(`${base}.csv`, routesToCSV([route]), 'text/csv');
  } else {
    downloadFile(`${base}.kml`, routesToKML([route], route.name), 'application/vnd.google-earth.kml+xml');
  }
}

/** Export all brigade routes in the chosen format and download it. */
export function exportRoutes(routes: Route[], format: 'json' | 'csv' | 'kml', brigade?: Pick<Brigade, 'id' | 'name'> | null): void {
  const base = safeFilename(brigade?.name ? `${brigade.name}-routes` : 'brigade-routes');
  if (format === 'json') {
    downloadFile(`${base}.json`, routesToBackupJSON(routes, brigade), 'application/json');
  } else if (format === 'csv') {
    downloadFile(`${base}.csv`, routesToCSV(routes), 'text/csv');
  } else {
    downloadFile(`${base}.kml`, routesToKML(routes, brigade?.name || 'Brigade routes'), 'application/vnd.google-earth.kml+xml');
  }
}
