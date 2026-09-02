/**
 * Fixed-window in-memory rate limiter for the realtime Functions
 * (/api/negotiate, /api/broadcast*) — launch-hardening item from the v1.0
 * epic. Keyed by client IP + limiter name. Mirrors server/src/utils/rateLimit.ts.
 *
 * State is per-instance: on scaled-out Functions each instance enforces the
 * limit independently — acceptable as an abuse brake rather than a strict
 * global quota.
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, WindowEntry>();

const MAX_TRACKED_KEYS = 10000;

/**
 * Mirrors server/src/utils/rateLimit.ts: only the RIGHTMOST X-Forwarded-For
 * hop is trustworthy on the production ingress (Azure Container Apps) — every
 * hop to the left is client-supplied and trivially forged. This file (local
 * dev only) keeps the same logic for parity even though nothing hostile is
 * expected to hit it.
 */
export function clientIp(request: HttpRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return request.headers.get('x-client-ip') || 'unknown';
}

/**
 * Check the rate limit for a request. Returns a 429 response when the client
 * has exceeded the limit, or null when the request may proceed.
 */
export function checkRateLimit(
  request: HttpRequest,
  name: string,
  limit: number,
  windowMs: number
): HttpResponseInit | null {
  const key = `${name}:${clientIp(request)}`;
  const now = Date.now();

  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now };
    if (!buckets.has(key) && buckets.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) {
        if (now - v.windowStart >= windowMs) buckets.delete(k);
      }
      // Still full → fail open rather than letting limiter overflow block
      // legitimate clients.
      if (buckets.size >= MAX_TRACKED_KEYS) return null;
    }
    buckets.set(key, entry);
  }

  entry.count++;
  if (entry.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
    return {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
      jsonBody: { error: 'Too many requests — please slow down' },
    };
  }

  return null;
}

/** Test hook: reset all limiter state. */
export function resetRateLimits(): void {
  buckets.clear();
}
