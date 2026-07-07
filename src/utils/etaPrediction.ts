/**
 * Predictive ETA — learns from historical route timing to adjust estimates.
 *
 * Completed routes already carry the ground truth (estimatedDuration vs
 * actualDuration, waypoint estimated vs actual arrivals), so the "model" is a
 * simple ratio estimator built from a brigade's completed routes:
 *
 *   predicted = baseEstimate × blend(overallFactor, timeOfDayFactor)
 *
 * Confidence is derived from sample count and the spread of observed factors.
 * No external ML dependency — deliberately transparent and unit-testable.
 */

import type { Route } from '../types';

export type EtaConfidence = 'low' | 'medium' | 'high';

export interface EtaSample {
  /** actualDuration / estimatedDuration for one completed route */
  factor: number;
  /** Hour of day (0-23) the route started, for time-of-day bucketing */
  startHour: number | null;
  routeId: string;
  date: string;
}

export interface EtaModel {
  samples: EtaSample[];
  /** Median correction factor across all samples (1 = estimates are accurate) */
  overallFactor: number;
  /** Median factor per start-hour bucket (only buckets with >= 2 samples) */
  hourFactors: Record<number, number>;
  /** Spread of factors (interquartile range) — wide spread lowers confidence */
  spread: number;
}

export interface EtaPrediction {
  /** Adjusted duration in seconds */
  duration: number;
  /** Correction factor applied to the base estimate */
  factor: number;
  confidence: EtaConfidence;
  sampleCount: number;
}

/** Bounds to keep one weird route from poisoning the model. */
const MIN_FACTOR = 0.25;
const MAX_FACTOR = 4;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function startHourOf(route: Route): number | null {
  if (route.startedAt) {
    const d = new Date(route.startedAt);
    if (!Number.isNaN(d.getTime())) return d.getHours();
  }
  const match = /^(\d{1,2}):/.exec(route.startTime || '');
  if (match) {
    const h = parseInt(match[1], 10);
    if (h >= 0 && h <= 23) return h;
  }
  return null;
}

/** Extract a timing sample from a completed route, or null if unusable. */
export function sampleFromRoute(route: Route): EtaSample | null {
  if (route.status !== 'completed' && route.status !== 'archived') return null;
  if (!route.estimatedDuration || !route.actualDuration) return null;
  if (route.estimatedDuration <= 0 || route.actualDuration <= 0) return null;
  const factor = route.actualDuration / route.estimatedDuration;
  if (factor < MIN_FACTOR || factor > MAX_FACTOR) return null; // outlier — likely paused/abandoned run
  return { factor, startHour: startHourOf(route), routeId: route.id, date: route.date };
}

/** Build the brigade's ETA model from its route history. */
export function buildEtaModel(routes: Route[]): EtaModel {
  const samples = routes.map(sampleFromRoute).filter((s): s is EtaSample => s !== null);
  if (samples.length === 0) {
    return { samples: [], overallFactor: 1, hourFactors: {}, spread: 0 };
  }

  const factors = samples.map(s => s.factor);
  const overallFactor = median(factors);
  const spread = factors.length >= 4 ? quantile(factors, 0.75) - quantile(factors, 0.25) : 0;

  const byHour = new Map<number, number[]>();
  for (const s of samples) {
    if (s.startHour === null) continue;
    const list = byHour.get(s.startHour) ?? [];
    list.push(s.factor);
    byHour.set(s.startHour, list);
  }
  const hourFactors: Record<number, number> = {};
  for (const [hour, list] of byHour) {
    if (list.length >= 2) hourFactors[hour] = median(list);
  }

  return { samples, overallFactor, hourFactors, spread };
}

/**
 * Predict an adjusted duration for a route given the brigade's model.
 * `startHour` defaults to the route's own start hour when omitted.
 */
export function predictDuration(
  baseEstimateSeconds: number,
  model: EtaModel,
  startHour?: number | null
): EtaPrediction {
  const n = model.samples.length;
  if (n === 0 || baseEstimateSeconds <= 0) {
    return { duration: baseEstimateSeconds, factor: 1, confidence: 'low', sampleCount: n };
  }

  // Blend the hour-specific factor with the overall factor when available
  let factor = model.overallFactor;
  if (startHour != null && model.hourFactors[startHour] !== undefined) {
    factor = 0.5 * model.hourFactors[startHour] + 0.5 * model.overallFactor;
  }

  // Confidence: needs enough history and consistent behaviour
  let confidence: EtaConfidence = 'low';
  if (n >= 5 && model.spread < 0.25) confidence = 'high';
  else if (n >= 3 && model.spread < 0.5) confidence = 'medium';

  return {
    duration: Math.round(baseEstimateSeconds * factor),
    factor,
    confidence,
    sampleCount: n,
  };
}

/** Convenience: predict for a specific route using the brigade's history. */
export function predictRouteDuration(route: Route, allRoutes: Route[]): EtaPrediction | null {
  if (!route.estimatedDuration) return null;
  // Exclude the route itself so its own actuals don't self-confirm
  const model = buildEtaModel(allRoutes.filter(r => r.id !== route.id));
  if (model.samples.length === 0) return null;
  return predictDuration(route.estimatedDuration, model, startHourOf(route));
}

export const CONFIDENCE_LABELS: Record<EtaConfidence, string> = {
  low: 'Low confidence — little history yet',
  medium: 'Medium confidence — based on a few past runs',
  high: 'High confidence — consistent past run timing',
};
