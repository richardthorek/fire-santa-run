/**
 * Route import utilities — JSON backups (restore), GPX and KML files.
 *
 * Parsing and validation are pure functions returning an ImportResult that the
 * UI renders as a preview before anything is written to storage.
 */

import type { Route, Waypoint, GeoJSON } from '../types';
import { BACKUP_FORMAT } from './routeExport';

export interface ImportIssue {
  severity: 'error' | 'warning';
  message: string;
}

/** A parsed candidate route plus validation/duplicate state for the preview UI. */
export interface ImportCandidate {
  route: Route;
  issues: ImportIssue[];
  /** ID of an existing route this candidate duplicates (same id, or same name+date) */
  duplicateOf?: string;
  /** How the user chose to resolve a duplicate */
  resolution: 'import' | 'replace' | 'copy' | 'skip';
}

export interface ImportResult {
  source: 'backup' | 'route-json' | 'gpx' | 'kml';
  candidates: ImportCandidate[];
  errors: string[];
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isValidCoordinate(c: unknown): c is [number, number] {
  return Array.isArray(c) && c.length === 2 && isFiniteNumber(c[0]) && isFiniteNumber(c[1])
    && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90;
}

/** Validate a route-shaped object; returns issues and a sanitised Route (or null if unusable). */
export function validateImportedRoute(raw: unknown): { route: Route | null; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { route: null, issues: [{ severity: 'error', message: 'Route entry is not an object' }] };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    issues.push({ severity: 'error', message: 'Route is missing a name' });
    return { route: null, issues };
  }

  const waypointsRaw = Array.isArray(obj.waypoints) ? obj.waypoints : [];
  const waypoints: Waypoint[] = [];
  waypointsRaw.forEach((wpRaw, i) => {
    if (typeof wpRaw !== 'object' || wpRaw === null) {
      issues.push({ severity: 'warning', message: `Waypoint ${i + 1} skipped: not an object` });
      return;
    }
    const wp = wpRaw as Record<string, unknown>;
    if (!isValidCoordinate(wp.coordinates)) {
      issues.push({ severity: 'warning', message: `Waypoint ${i + 1} skipped: invalid coordinates` });
      return;
    }
    waypoints.push({
      id: typeof wp.id === 'string' ? wp.id : makeId('wp'),
      coordinates: wp.coordinates as [number, number],
      address: typeof wp.address === 'string' ? wp.address : undefined,
      name: typeof wp.name === 'string' ? wp.name : undefined,
      order: isFiniteNumber(wp.order) ? wp.order : i,
      notes: typeof wp.notes === 'string' ? wp.notes : undefined,
      estimatedArrival: typeof wp.estimatedArrival === 'string' ? wp.estimatedArrival : undefined,
      actualArrival: typeof wp.actualArrival === 'string' ? wp.actualArrival : undefined,
      isCompleted: wp.isCompleted === true,
    });
  });

  if (waypoints.length === 0) {
    issues.push({ severity: 'warning', message: 'Route has no valid waypoints' });
  }

  let geometry: GeoJSON.LineString | undefined;
  const geomRaw = obj.geometry as Record<string, unknown> | undefined;
  if (geomRaw && geomRaw.type === 'LineString' && Array.isArray(geomRaw.coordinates)) {
    const coords = (geomRaw.coordinates as unknown[]).filter(isValidCoordinate) as [number, number][];
    if (coords.length >= 2) {
      geometry = { type: 'LineString', coordinates: coords };
    } else {
      issues.push({ severity: 'warning', message: 'Route geometry dropped: fewer than 2 valid points' });
    }
  }

  const validStatuses = ['draft', 'published', 'active', 'completed', 'archived'];
  const status = typeof obj.status === 'string' && validStatuses.includes(obj.status) ? obj.status : 'draft';
  if (obj.status && status !== obj.status) {
    issues.push({ severity: 'warning', message: `Unknown status "${String(obj.status)}" reset to draft` });
  }

  const route: Route = {
    id: typeof obj.id === 'string' ? obj.id : makeId('route'),
    brigadeId: typeof obj.brigadeId === 'string' ? obj.brigadeId : '',
    name: obj.name.trim(),
    description: typeof obj.description === 'string' ? obj.description : undefined,
    date: typeof obj.date === 'string' && !Number.isNaN(Date.parse(obj.date)) ? obj.date : new Date().toISOString().slice(0, 10),
    startTime: typeof obj.startTime === 'string' ? obj.startTime : '18:00',
    endTime: typeof obj.endTime === 'string' ? obj.endTime : undefined,
    status: status as Route['status'],
    waypoints,
    geometry,
    navigationSteps: Array.isArray(obj.navigationSteps) ? (obj.navigationSteps as Route['navigationSteps']) : undefined,
    distance: isFiniteNumber(obj.distance) ? obj.distance : undefined,
    estimatedDuration: isFiniteNumber(obj.estimatedDuration) ? obj.estimatedDuration : undefined,
    actualDuration: isFiniteNumber(obj.actualDuration) ? obj.actualDuration : undefined,
    navigationSettings: typeof obj.navigationSettings === 'object' && obj.navigationSettings !== null
      ? (obj.navigationSettings as Route['navigationSettings'])
      : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
    comments: Array.isArray(obj.comments) ? (obj.comments as Route['comments']) : undefined,
  };

  if (typeof obj.date === 'string' && Number.isNaN(Date.parse(obj.date))) {
    issues.push({ severity: 'warning', message: `Invalid date "${obj.date}" reset to today` });
  }

  return { route, issues };
}

function parseJSONImport(content: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { source: 'route-json', candidates: [], errors: ['File is not valid JSON'] };
  }

  const obj = parsed as Record<string, unknown>;
  let rawRoutes: unknown[];
  let source: ImportResult['source'];

  if (obj && obj.format === BACKUP_FORMAT && Array.isArray(obj.routes)) {
    rawRoutes = obj.routes;
    source = 'backup';
  } else if (Array.isArray(parsed)) {
    rawRoutes = parsed;
    source = 'route-json';
  } else if (obj && (Array.isArray(obj.waypoints) || typeof obj.name === 'string')) {
    rawRoutes = [parsed];
    source = 'route-json';
  } else {
    return {
      source: 'route-json',
      candidates: [],
      errors: ['JSON does not look like a Fire Santa Run backup or route export'],
    };
  }

  const errors: string[] = [];
  const candidates: ImportCandidate[] = [];
  rawRoutes.forEach((raw, i) => {
    const { route, issues } = validateImportedRoute(raw);
    if (!route) {
      errors.push(`Entry ${i + 1}: ${issues.map(iss => iss.message).join('; ')}`);
      return;
    }
    candidates.push({ route, issues, resolution: 'import' });
  });

  return { source, candidates, errors };
}

function parseXml(content: string): Document | null {
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  return doc.querySelector('parsererror') ? null : doc;
}

/** Parse a GPX file: <wpt> elements become waypoints, first <trk>/<rte> becomes geometry. */
export function parseGPX(content: string, fallbackName: string): ImportResult {
  const doc = parseXml(content);
  if (!doc || !doc.querySelector('gpx')) {
    return { source: 'gpx', candidates: [], errors: ['File is not a valid GPX document'] };
  }

  const issues: ImportIssue[] = [];
  const waypoints: Waypoint[] = [];
  doc.querySelectorAll('wpt').forEach((el, i) => {
    const lat = parseFloat(el.getAttribute('lat') || '');
    const lon = parseFloat(el.getAttribute('lon') || '');
    if (!isValidCoordinate([lon, lat])) {
      issues.push({ severity: 'warning', message: `GPX waypoint ${i + 1} skipped: invalid lat/lon` });
      return;
    }
    waypoints.push({
      id: makeId('wp'),
      coordinates: [lon, lat],
      name: el.querySelector('name')?.textContent?.trim() || undefined,
      notes: el.querySelector('desc')?.textContent?.trim() || undefined,
      order: waypoints.length,
      isCompleted: false,
    });
  });

  const trackPoints: [number, number][] = [];
  doc.querySelectorAll('trkpt, rtept').forEach(el => {
    const lat = parseFloat(el.getAttribute('lat') || '');
    const lon = parseFloat(el.getAttribute('lon') || '');
    if (isValidCoordinate([lon, lat])) trackPoints.push([lon, lat]);
  });

  // A GPX with only a track still imports: track points become the geometry,
  // and start/end become waypoints so the route is editable.
  if (waypoints.length === 0 && trackPoints.length >= 2) {
    waypoints.push(
      { id: makeId('wp'), coordinates: trackPoints[0], name: 'Start', order: 0, isCompleted: false },
      { id: makeId('wp'), coordinates: trackPoints[trackPoints.length - 1], name: 'Finish', order: 1, isCompleted: false },
    );
    issues.push({ severity: 'warning', message: 'No GPX waypoints found — created Start/Finish stops from the track' });
  }

  if (waypoints.length === 0) {
    return { source: 'gpx', candidates: [], errors: ['GPX file contains no usable waypoints or track points'] };
  }

  const name = doc.querySelector('gpx > metadata > name, trk > name, rte > name')?.textContent?.trim() || fallbackName;
  const route: Route = {
    id: makeId('route'),
    brigadeId: '',
    name,
    date: new Date().toISOString().slice(0, 10),
    startTime: '18:00',
    status: 'draft',
    waypoints,
    geometry: trackPoints.length >= 2 ? { type: 'LineString', coordinates: trackPoints } : undefined,
    createdAt: new Date().toISOString(),
  };

  return { source: 'gpx', candidates: [{ route, issues, resolution: 'import' }], errors: [] };
}

/** Parse a KML file: Point Placemarks become waypoints, first LineString becomes geometry. */
export function parseKML(content: string, fallbackName: string): ImportResult {
  const doc = parseXml(content);
  if (!doc || !doc.querySelector('kml')) {
    return { source: 'kml', candidates: [], errors: ['File is not a valid KML document'] };
  }

  const issues: ImportIssue[] = [];
  const waypoints: Waypoint[] = [];
  let lineCoords: [number, number][] = [];

  doc.querySelectorAll('Placemark').forEach((pm, i) => {
    const name = pm.querySelector('name')?.textContent?.trim() || undefined;
    const description = pm.querySelector('description')?.textContent?.trim() || undefined;
    const pointCoords = pm.querySelector('Point > coordinates')?.textContent?.trim();
    if (pointCoords) {
      const [lon, lat] = pointCoords.split(',').map(parseFloat);
      if (isValidCoordinate([lon, lat])) {
        waypoints.push({
          id: makeId('wp'),
          coordinates: [lon, lat],
          name,
          notes: description,
          order: waypoints.length,
          isCompleted: false,
        });
      } else {
        issues.push({ severity: 'warning', message: `Placemark ${i + 1} skipped: invalid coordinates` });
      }
      return;
    }
    const lineText = pm.querySelector('LineString > coordinates')?.textContent?.trim();
    if (lineText && lineCoords.length === 0) {
      lineCoords = lineText.split(/\s+/).map(triple => {
        const [lon, lat] = triple.split(',').map(parseFloat);
        return [lon, lat] as [number, number];
      }).filter(isValidCoordinate);
    }
  });

  if (waypoints.length === 0 && lineCoords.length >= 2) {
    waypoints.push(
      { id: makeId('wp'), coordinates: lineCoords[0], name: 'Start', order: 0, isCompleted: false },
      { id: makeId('wp'), coordinates: lineCoords[lineCoords.length - 1], name: 'Finish', order: 1, isCompleted: false },
    );
    issues.push({ severity: 'warning', message: 'No point Placemarks found — created Start/Finish stops from the path' });
  }

  if (waypoints.length === 0) {
    return { source: 'kml', candidates: [], errors: ['KML file contains no usable Placemarks'] };
  }

  const name = doc.querySelector('Document > name, Folder > name')?.textContent?.trim() || fallbackName;
  const route: Route = {
    id: makeId('route'),
    brigadeId: '',
    name,
    date: new Date().toISOString().slice(0, 10),
    startTime: '18:00',
    status: 'draft',
    waypoints,
    geometry: lineCoords.length >= 2 ? { type: 'LineString', coordinates: lineCoords } : undefined,
    createdAt: new Date().toISOString(),
  };

  return { source: 'kml', candidates: [{ route, issues, resolution: 'import' }], errors: [] };
}

/** Parse an uploaded file by extension/content into import candidates. */
export function parseImportFile(filename: string, content: string): ImportResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.gpx')) return parseGPX(content, filename.replace(/\.gpx$/i, ''));
  if (lower.endsWith('.kml')) return parseKML(content, filename.replace(/\.kml$/i, ''));
  if (lower.endsWith('.json')) return parseJSONImport(content);

  // Sniff content for extensionless files
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJSONImport(content);
  if (trimmed.includes('<gpx')) return parseGPX(content, filename);
  if (trimmed.includes('<kml')) return parseKML(content, filename);
  return { source: 'route-json', candidates: [], errors: ['Unsupported file type — use .json, .gpx or .kml'] };
}

/** Flag candidates that duplicate existing routes (same id, or same name + date). */
export function markDuplicates(candidates: ImportCandidate[], existingRoutes: Route[]): ImportCandidate[] {
  return candidates.map(candidate => {
    const byId = existingRoutes.find(r => r.id === candidate.route.id);
    const byNameDate = existingRoutes.find(
      r => r.name.toLowerCase() === candidate.route.name.toLowerCase() && r.date === candidate.route.date
    );
    const duplicate = byId || byNameDate;
    if (!duplicate) return candidate;
    return {
      ...candidate,
      duplicateOf: duplicate.id,
      resolution: 'copy',
      issues: [
        ...candidate.issues,
        { severity: 'warning', message: `Matches existing route "${duplicate.name}" (${duplicate.date})` },
      ],
    };
  });
}

/**
 * Materialise a candidate into the route that should be saved, applying the
 * chosen duplicate resolution and re-scoping to the target brigade.
 * Returns null when the candidate is skipped.
 */
export function resolveCandidate(candidate: ImportCandidate, brigadeId: string): Route | null {
  if (candidate.resolution === 'skip') return null;
  const route: Route = { ...candidate.route, brigadeId };
  if (candidate.resolution === 'replace' && candidate.duplicateOf) {
    route.id = candidate.duplicateOf;
  } else if (candidate.resolution === 'copy' && candidate.duplicateOf) {
    route.id = makeId('route');
    route.name = `${route.name} (imported)`;
  }
  return route;
}
