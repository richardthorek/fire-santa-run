import type { Context, Next } from 'hono';

/**
 * Fixed-window in-memory rate limiter for the realtime endpoints
 * (/api/negotiate, /api/broadcast*) — the launch-hardening item from the
 * v1.0 epic. Keyed by client IP + limiter name.
 *
 * In-memory state is per-process: on a scaled-out App Service each instance
 * enforces the limit independently, which is acceptable as an abuse brake
 * (the intent here) rather than a strict global quota. Front Door / App
 * Service-level rules can be layered on top for network-level enforcement.
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, WindowEntry>();

/** Cap total tracked keys so an attacker rotating IPs can't grow memory unboundedly. */
const MAX_TRACKED_KEYS = 10000;

function clientIp(c: Context): string {
  // App Service / Front Door put the client in the first x-forwarded-for hop
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return c.req.header('x-client-ip') || 'unknown';
}

export interface RateLimitOptions {
  /** Limiter name — separates buckets between endpoints */
  name: string;
  /** Max requests per window per client */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

/** Hono middleware enforcing a fixed-window per-IP rate limit. */
export function rateLimit({ name, limit, windowMs }: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const key = `${name}:${clientIp(c)}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
      // Opportunistic cleanup: when at capacity, drop expired entries first
      if (!buckets.has(key) && buckets.size >= MAX_TRACKED_KEYS) {
        for (const [k, v] of buckets) {
          if (now - v.windowStart >= windowMs) buckets.delete(k);
        }
        // Still full → refuse new tracking keys rather than grow: allow the
        // request through (fail-open) since dropping traffic on limiter
        // overflow would let an attacker DoS legitimate clients.
        if (buckets.size >= MAX_TRACKED_KEYS) {
          await next();
          return;
        }
      }
      buckets.set(key, entry);
    }

    entry.count++;
    if (entry.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json({ error: 'Too many requests — please slow down' }, 429);
    }

    await next();
  };
}

/** Test hook: reset all limiter state. */
export function resetRateLimits(): void {
  buckets.clear();
}
