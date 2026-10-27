/**
 * The organiser's run-plan email: a static map of the route with every stop,
 * then the turn-by-turn directions and the stops with their planned times.
 * Pure builders only; sending lives in emailSender.ts.
 */

/** Encoded-polyline precision Mapbox's Static Images API expects. */
const POLYLINE_PRECISION = 1e5;

/** Keep the static map URL well under the API's length limit. */
const MAX_MAP_POINTS = 240;

/** Mapbox pin labels run 1–99, so the plan shows at most this many stops on the map. */
const MAX_MAP_STOPS = 60;

export interface PlanStop {
  name: string;
  address?: string;
  coordinates: [number, number];
  plannedTime?: string;
}

export interface PlanStep {
  instruction: string;
  distance: number;
}

export interface RunPlanInput {
  name: string;
  date: string;
  startTime: string;
  timeZoneLabel?: string;
  stops: PlanStop[];
  geometry?: { coordinates: [number, number][] };
  steps: PlanStep[];
  shareUrl?: string;
}

/** Google's encoded-polyline algorithm, as Mapbox's path overlay expects it. */
export function encodePolyline(points: [number, number][]): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const encodeSigned = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of points) {
    const latE5 = Math.round(lat * POLYLINE_PRECISION);
    const lngE5 = Math.round(lng * POLYLINE_PRECISION);
    encodeSigned(latE5 - prevLat);
    encodeSigned(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out;
}

/** Evenly thins a path to at most `max` points, always keeping the last one. */
export function samplePath(points: [number, number][], max: number = MAX_MAP_POINTS): [number, number][] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const sampled: [number, number][] = [];
  for (let i = 0; i < max - 1; i += 1) sampled.push(points[Math.round(i * step)]);
  sampled.push(points[points.length - 1]);
  return sampled;
}

/** Mapbox Static Images URL: the route as a violet line, every stop numbered. */
export function buildStaticMapUrl(input: RunPlanInput, accessToken: string): string | null {
  const path = input.geometry?.coordinates ?? input.stops.map(s => s.coordinates);
  if (path.length < 2) return null;
  const overlays: string[] = [];
  const line = samplePath(path as [number, number][]);
  overlays.push(`path-4+7C3AED-0.9(${encodeURIComponent(encodePolyline(line))})`);
  input.stops.slice(0, MAX_MAP_STOPS).forEach((stop, index) => {
    const colour = index === 0 ? '1E9E62' : 'D8232A';
    const [lng, lat] = stop.coordinates;
    overlays.push(`pin-s-${index + 1}+${colour}(${lng},${lat})`);
  });
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(',')}/auto/800x500@2x?padding=50&access_token=${encodeURIComponent(accessToken)}`;
}

/** Escapes text that comes from the organiser before it goes into HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

export function buildRunPlanSubject(input: RunPlanInput): string {
  return `Run plan: ${input.name} (${input.date})`;
}

/** The email body. `mapCid` names the inline map image, or is null if there is no map. */
export function buildRunPlanHtml(input: RunPlanInput, mapCid: string | null): string {
  const e = escapeHtml;
  const stopRows = input.stops.map((stop, index) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${index + 1}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb"><strong>${e(stop.name)}</strong>${stop.address ? `<br><span style="color:#6b7280">${e(stop.address)}</span>` : ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${stop.plannedTime ? e(stop.plannedTime) : ''}</td>
      </tr>`).join('');
  const stepRows = input.steps.map((step, index) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${index + 1}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${e(step.instruction)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:#6b7280">${formatDistance(step.distance)}</td>
      </tr>`).join('');
  const map = mapCid
    ? `<img src="cid:${mapCid}" alt="Map of the run route" width="600" style="width:100%;max-width:600px;border-radius:8px;display:block">`
    : '<p style="color:#6b7280">The map could not be drawn for this email. The stops and directions below are complete.</p>';
  const share = input.shareUrl ? `<p>Public tracking link: <a href="${e(input.shareUrl)}">${e(input.shareUrl)}</a></p>` : '';

  return `<!doctype html>
<html><body style="margin:0;padding:16px;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#0c1220">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:20px">
    <h1 style="font-size:22px;margin:0 0 4px;color:#d8232a">${e(input.name)}</h1>
    <p style="margin:0 0 16px;color:#4a5568">${e(input.date)} at ${e(input.startTime)}${input.timeZoneLabel ? ` ${e(input.timeZoneLabel)}` : ''}</p>
    ${map}
    ${share}
    <h2 style="font-size:17px;margin:20px 0 6px">Stops</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr><th align="left" style="padding:6px 10px">#</th><th align="left" style="padding:6px 10px">Stop</th><th align="left" style="padding:6px 10px">Planned</th></tr></thead>
      <tbody>${stopRows}</tbody>
    </table>
    <h2 style="font-size:17px;margin:20px 0 6px">Turn by turn</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr><th align="left" style="padding:6px 10px">#</th><th align="left" style="padding:6px 10px">Direction</th><th align="left" style="padding:6px 10px">Distance</th></tr></thead>
      <tbody>${stepRows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:12px;color:#6b7280">Check the route before the night. Roadworks and closures can change between now and the run.</p>
  </div>
</body></html>`;
}

export function buildRunPlanText(input: RunPlanInput): string {
  const stops = input.stops.map((stop, i) => `${i + 1}. ${stop.name}${stop.address ? ` (${stop.address})` : ''}${stop.plannedTime ? ` — ${stop.plannedTime}` : ''}`);
  const steps = input.steps.map((step, i) => `${i + 1}. ${step.instruction} (${formatDistance(step.distance)})`);
  return [
    input.name,
    `${input.date} at ${input.startTime}${input.timeZoneLabel ? ` ${input.timeZoneLabel}` : ''}`,
    '',
    'Stops',
    ...stops,
    '',
    'Turn by turn',
    ...steps,
  ].join('\n');
}
