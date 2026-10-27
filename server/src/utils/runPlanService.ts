/**
 * Builds a run's plan (map, PDF, email) and sends it. Used by the organiser's
 * "email me the plan" button, the dashboard's other-address send, the PDF
 * download, and the automatic email 24 hours before the run.
 */
import { buildRunPlanHtml, buildRunPlanSubject, buildRunPlanText, buildStaticMapUrl, type RunPlanInput } from './runPlan.js';
import { buildRunPlanPdf } from './runPlanPdf.js';
import { sendRunPlanEmail, type SendResult } from './emailSender.js';

export interface RoutePlanSource {
  name?: string;
  date: string;
  startTime: string;
  timeZone?: string;
  waypoints: any[];
  navigationSteps?: any[];
  geometry?: { coordinates: [number, number][] };
  shareableLink?: string;
}

export interface BuiltPlan {
  input: RunPlanInput;
  pdf: Buffer;
  mapPng: Buffer | null;
  subject: string;
  html: string;
  text: string;
}

/** Turns a stored route into the plan: the map image is fetched here and attached. */
export async function buildPlan(route: RoutePlanSource): Promise<BuiltPlan> {
  const timeZone = route.timeZone || 'Australia/Sydney';
  const clockFormat = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone });
  const input: RunPlanInput = {
    name: route.name || 'Santa run',
    date: route.date,
    startTime: route.startTime,
    timeZoneLabel: `${timeZone.split('/').pop()?.replace(/_/g, ' ') ?? ''} time`,
    stops: route.waypoints.map((wp: any, index: number) => ({
      name: wp.name || `Stop ${index + 1}`,
      address: wp.address || undefined,
      coordinates: wp.coordinates as [number, number],
      plannedTime: wp.estimatedArrival ? clockFormat.format(new Date(wp.estimatedArrival)) : undefined,
    })),
    steps: (route.navigationSteps || []).map((step: any) => ({ instruction: step.instruction, distance: step.distance })),
    geometry: route.geometry,
    shareUrl: route.shareableLink || undefined,
  };

  // If the map can't be drawn the plan still goes out, without it.
  let mapPng: Buffer | null = null;
  const token = process.env.MAPBOX_TOKEN;
  const mapUrl = token ? buildStaticMapUrl(input, token) : null;
  if (mapUrl) {
    try {
      const response = await fetch(mapUrl);
      if (response.ok) mapPng = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.warn('[runPlan] map could not be fetched:', error);
    }
  }

  const pdf = await buildRunPlanPdf(input, mapPng);
  return {
    input,
    pdf,
    mapPng,
    subject: buildRunPlanSubject(input),
    html: buildRunPlanHtml(input, mapPng ? 'runmap' : null),
    text: buildRunPlanText(input),
  };
}

/** Sends a built plan to one address, with the PDF and the inline map. */
export async function sendPlan(plan: BuiltPlan, to: string): Promise<SendResult> {
  const attachments = [
    { name: 'run-plan.pdf', contentType: 'application/pdf', contentInBase64: plan.pdf.toString('base64') },
    ...(plan.mapPng ? [{ name: 'route-map.png', contentType: 'image/png', contentInBase64: plan.mapPng.toString('base64'), contentId: 'runmap' }] : []),
  ];
  return sendRunPlanEmail({ to, subject: plan.subject, html: plan.html, text: plan.text, attachments });
}

/** A deliberately simple address check: one @, something on each side, no spaces. */
export function isPlausibleEmail(address: string): boolean {
  return address.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}
